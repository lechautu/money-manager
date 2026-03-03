import OpenAI from 'openai';
import { log } from './logger.js';
import type { ChatMessage } from './sessionStore.js';

const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o';
const MAX_RETRIES = parseInt(process.env.MAX_PROVIDER_RETRIES || '2', 10);

let client: OpenAI | null = null;

export function initLLMProvider() {
    client = new OpenAI({ apiKey: LLM_API_KEY, baseURL: LLM_BASE_URL });
    log('info', `LLM initialized: model=${LLM_MODEL}, baseURL=${LLM_BASE_URL}`);
}

export interface OpenAITool {
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, any> };
}

export function convertToolsToOpenAI(mcpTools: Array<{ name: string; description: string; inputSchema: Record<string, any> }>): OpenAITool[] {
    return mcpTools.map(t => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
}

function toOpenAIMessages(messages: ChatMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map(m => {
        if (m.role === 'tool') return { role: 'tool' as const, content: m.content || '', tool_call_id: m.toolCallId || '' };
        if (m.role === 'assistant' && m.toolCalls?.length) {
            return {
                role: 'assistant' as const, content: m.content,
                tool_calls: m.toolCalls.map(tc => ({ id: tc.id, type: 'function' as const, function: { name: tc.name, arguments: tc.arguments } })),
            };
        }
        return { role: m.role as 'system' | 'user' | 'assistant', content: m.content || '' };
    });
}

export interface LLMResponse {
    content: string | null;
    toolCalls: Array<{ id: string; name: string; arguments: string }>;
    finishReason: string;
}

export async function chatCompletion(messages: ChatMessage[], tools: OpenAITool[], opts: { traceId?: string } = {}): Promise<LLMResponse> {
    if (!client) throw new Error('LLM not initialized');
    let lastErr: any;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));

            const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
                model: LLM_MODEL,
                messages: toOpenAIMessages(messages),
            };
            if (tools.length > 0) { params.tools = tools; params.tool_choice = 'auto'; }

            const t0 = Date.now();
            const res = await client.chat.completions.create(params);
            const choice = res.choices[0];
            log('info', 'LLM response', { latency_ms: Date.now() - t0, finish_reason: choice?.finish_reason, trace_id: opts.traceId } as any);

            return {
                content: choice?.message?.content || null,
                toolCalls: (choice?.message?.tool_calls || []).map(tc => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments })),
                finishReason: choice?.finish_reason || 'stop',
            };
        } catch (err: any) {
            lastErr = err;
            if (err?.status === 429 || err?.code === 'ECONNREFUSED') continue;
            throw err;
        }
    }
    throw lastErr || new Error('LLM retries exhausted');
}

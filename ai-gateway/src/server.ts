import 'dotenv/config';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { log } from './logger.js';
import { initSessionStore } from './sessionStore.js';
import { initMCPClient } from './mcpClient.js';
import { initLLMProvider } from './llmProvider.js';
import { aiRoutes } from './routes.js';

const PORT = parseInt(process.env.PORT || '3300', 10);
const HOST = process.env.AI_GATEWAY_HOST || '127.0.0.1';
const TRUSTED_ORIGINS = (process.env.TRUSTED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map(o => o.trim()).filter(Boolean);

async function main() {
    log('info', 'Starting AI Gateway...');

    initSessionStore();
    initLLMProvider();

    // Connect to MCP (retry)
    let mcpOk = false;
    for (let i = 1; i <= 3; i++) {
        try {
            await initMCPClient();
            mcpOk = true;
            break;
        } catch (err: any) {
            log('warn', `MCP attempt ${i}/3 failed: ${err.message}`);
            if (i < 3) await new Promise(r => setTimeout(r, 2000 * i));
        }
    }
    if (!mcpOk) log('error', 'MCP Server unavailable. Starting without tools.');

    const app = express();
    const cors = (await import('cors')).default;
    app.use(cors({ origin: TRUSTED_ORIGINS, credentials: true }));
    app.use(express.json({ limit: '1mb' }));

    // TraceId
    app.use((req, _res, next) => { if (!req.headers['x-trace-id']) req.headers['x-trace-id'] = uuidv4(); next(); });

    // Health
    app.get('/healthz', (_req, res) => res.json({ status: 'ok', mcpConnected: mcpOk }));
    app.get('/version', (_req, res) => res.json({ app: 'mm2-ai-gateway', version: '1.0.0' }));

    // Origin guard for state-changing
    const SC = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
    app.use('/ai', (req, res, next) => {
        if (!SC.has(req.method.toUpperCase())) { next(); return; }
        const origin = req.headers.origin as string | undefined;
        if (!origin || !TRUSTED_ORIGINS.includes(origin)) {
            res.status(403).json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Missing or untrusted Origin' } });
            return;
        }
        next();
    });

    app.use('/ai', aiRoutes);

    app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
        log('error', `${req.method} ${req.path}: ${err.message}`);
        res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
    });

    app.listen(PORT, HOST, () => {
        console.log(`mm2 AI Gateway running on http://${HOST}:${PORT}`);
        console.log(`  MCP: ${mcpOk ? 'connected' : 'NOT connected'}`);
        console.log(`  Chat API: http://${HOST}:${PORT}/ai/chat`);
    });
}

main().catch(err => { console.error('Startup failed:', err); process.exit(1); });



import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ManifestTool {
    name: string;
    category: string;
    description: string;
    parameters: Record<string, any>;
    tier: number;
}

interface Manifest {
    manifest_version: string;
    app_name: string;
    last_updated: string;
    description: string;
    tools: ManifestTool[];
}

export interface RegisteredTool {
    name: string;
    description: string;
    inputSchema: Record<string, any>;
    tier: 0 | 1 | 2;
    category: string;
    annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        openWorldHint: boolean;
    };
}

function normalizeSchema(parameters: Record<string, any>): Record<string, any> {
    if (!parameters || Object.keys(parameters).length === 0) {
        return {
            type: 'object',
            properties: {},
            additionalProperties: false,
        };
    }
    return parameters;
}

function deriveAnnotations(tier: number) {
    switch (tier) {
        case 0:
            return { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
        case 1:
            return { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
        case 2:
            return { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
        default:
            throw new Error(`Invalid tier value: ${tier}`);
    }
}

export function loadAndValidateManifest(): { manifest: Manifest; tools: RegisteredTool[] } {
    const manifestPath = resolve(__dirname, '..', 'tools_manifest_v1.json');
    const raw = readFileSync(manifestPath, 'utf-8');
    const manifest: Manifest = JSON.parse(raw);

    // Validate unique names
    const nameSet = new Set<string>();
    const errors: string[] = [];

    for (const tool of manifest.tools) {
        if (nameSet.has(tool.name)) {
            errors.push(`Duplicate tool name: ${tool.name}`);
        }
        nameSet.add(tool.name);

        if (![0, 1, 2].includes(tool.tier)) {
            errors.push(`Invalid tier ${tool.tier} for tool ${tool.name}`);
        }

        if (tool.parameters && typeof tool.parameters !== 'object') {
            errors.push(`Parameters for ${tool.name} must be an object`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`Manifest validation failed:\n${errors.join('\n')}`);
    }

    const tools: RegisteredTool[] = manifest.tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: normalizeSchema(t.parameters),
        tier: t.tier as 0 | 1 | 2,
        category: t.category,
        annotations: deriveAnnotations(t.tier),
    }));

    return { manifest, tools };
}

export function getTierForTool(tools: RegisteredTool[], toolName: string): 0 | 1 | 2 | undefined {
    const tool = tools.find(t => t.name === toolName);
    return tool?.tier;
}

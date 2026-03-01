import { GatewayClient } from '../api/gateway';
import type { GatewayConfig } from '../api/gateway';
import toolsManifest from '../../instruct/05-AI-Tools/tools_manifest_v1.json';

export interface ToolExecutionOptions {
    remoteConfig?: GatewayConfig;
}

export const ToolExecutionService = {
    getToolInfo(name: string) {
        return toolsManifest.tools.find(t => t.name === name);
    },

    async executeTool(name: string, parameters: any, options: ToolExecutionOptions = {}): Promise<any> {
        const toolInfo = this.getToolInfo(name);

        if (!toolInfo) {
            throw new Error(`Tool '${name}' is not found in the manifest.`);
        }

        // Gateway Configuration (no JWT needed — security contract v3)
        if (!options.remoteConfig) {
            options.remoteConfig = {
                baseUrl: localStorage.getItem('mm2_gateway_url') || 'http://localhost:3200',
                approvalToken: 'approved'
            };
        }

        try {
            return await GatewayClient.callTool(name, parameters, options.remoteConfig);
        } catch (error: any) {
            console.error(`Error executing tool [${name}] via Gateway:`, error);
            return { status: 'error', message: error.message };
        }
    }
};

// Expose to global window object
(window as any).mm2_execute_tool = ToolExecutionService.executeTool.bind(ToolExecutionService);

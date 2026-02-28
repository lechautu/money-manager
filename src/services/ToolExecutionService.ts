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

        // Force Gateway Configuration
        if (!options.remoteConfig) {
            options.remoteConfig = {
                baseUrl: localStorage.getItem('mm2_gateway_url') || 'http://localhost:3200',
                authToken: localStorage.getItem('mm2_gateway_token') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsImlhdCI6MTc3MjI2NzEzMywiZXhwIjoxODAzODAzMTMzfQ.bZUaF5-wQSmN0A77CpljiKd-H6Roz-Ha2RXErN8gtg0',
                approvalToken: 'approved'
            };
        }

        try {
            // ALWAYS proxy to Gateway - No local fallback
            try {
                return await GatewayClient.callTool(name, parameters, options.remoteConfig);
            } catch (err: any) {
                // If the token in localStorage is invalid/expired, clear it (it might be an old session token)
                if (err.message.includes('token') && localStorage.getItem('mm2_gateway_token')) {
                    console.warn('[ToolExecution] Gateway token looks invalid. Clearing from localStorage.');
                    localStorage.removeItem('mm2_gateway_token');
                }
                throw err;
            }
        } catch (error: any) {
            console.error(`Error executing tool [${name}] via Gateway:`, error);
            return { status: 'error', message: error.message };
        }
    }
};

// Expose to global window object
(window as any).mm2_execute_tool = ToolExecutionService.executeTool.bind(ToolExecutionService);

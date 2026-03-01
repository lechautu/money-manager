export interface GatewayConfig {
    baseUrl: string;
    approvalToken?: string;
}

export const GatewayClient = {
    async callTool(toolName: string, parameters: any, config: GatewayConfig) {
        // Determine method (matching the proxy logic)
        let method = 'POST';
        let url = `${config.baseUrl}/api/v1/${toolName}`;
        let body: string | undefined = JSON.stringify(parameters);

        if (toolName.startsWith('get_') || toolName.startsWith('search_') || toolName === 'has_password') {
            method = 'GET';
            body = undefined;
            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(parameters)) {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, String(value));
                }
            }
            const qs = searchParams.toString();
            if (qs) url += `?${qs}`;
        } else if (toolName.startsWith('delete_') || toolName.startsWith('clear_')) {
            const deleteTools = [
                'delete_account', 'delete_category', 'delete_subcategory',
                'delete_transaction', 'delete_recurring_rule', 'delete_installment_plan',
                'delete_budget', 'clear_month_budgets'
            ];
            if (deleteTools.includes(toolName)) {
                method = 'DELETE';
            }
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            // No Authorization header needed — security contract v3 uses
            // Origin-based trust for localhost WebUI (browser auto-sets Origin)
        };

        if (config.approvalToken) {
            if (config.approvalToken === 'approved' || config.approvalToken === 'confirm') {
                headers['X-MM-Approval'] = config.approvalToken;
            } else {
                headers['X-MM-Approval-Token'] = config.approvalToken;
            }
        }

        const response = await fetch(url, {
            method,
            headers,
            body
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error?.message || `Gateway error: ${response.status}`);
        }

        return result;
    }
};

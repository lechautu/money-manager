export interface GatewayConfig {
    baseUrl: string;
    authToken: string;
    approvalToken?: string;
}

export const GatewayClient = {
    async callTool(toolName: string, parameters: any, config: GatewayConfig) {
        // Determine method (keeping it simple for now, matching the proxy logic we added)
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
            'Authorization': `Bearer ${config.authToken}`,
        };

        if (config.approvalToken) {
            if (config.approvalToken === 'approved') {
                headers['X-MM-Approval'] = 'approved';
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

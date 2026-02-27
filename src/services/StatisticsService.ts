import { ToolExecutionService } from './ToolExecutionService';

export const StatisticsService = {
    async getDashboardSummary(month: string) {
        const res = await ToolExecutionService.executeTool('get_dashboard_summary', { month });
        return res.data;
    },

    async getRecentTransactions(limit: number = 5) {
        // use search_transactions with limit
        const res = await ToolExecutionService.executeTool('search_transactions', { limit, sortBy: 'date', sortOrder: 'desc' });
        return res.data;
    },

    async getExpenseByCategory(month: string) {
        const res = await ToolExecutionService.executeTool('get_spending_analytics', { month });
        return res.data;
    },

    async getDailySpending(month: string) {
        const res = await ToolExecutionService.executeTool('get_daily_spending', { month });
        return res.data;
    },

    async getMonthlyTrends(startMonth: string, endMonth: string, _filters: { accountIds?: string[] } = {}) {
        // This is a trend tool. We can add one or use generic search with grouping logic if we have it.
        // For now, let's assume we use search items and group client-side if missing, or use get_cashflow_trend.
        const res = await ToolExecutionService.executeTool('get_cashflow_trend', { startDate: startMonth + '-01', endDate: endMonth + '-31' });
        return res.data;
    },

    async getCategoryMovers(
        currentStart: string, currentEnd: string,
        compareStart: string, compareEnd: string,
        _filters: { accountIds?: string[], type?: 'income' | 'expense' } = {}
    ) {
        const res = await ToolExecutionService.executeTool('get_category_movers', {
            currentStart, currentEnd, compareStart, compareEnd
        });
        return res.data;
    },

    async getCashflowTrend(startDate: string, endDate: string) {
        const res = await ToolExecutionService.executeTool('get_cashflow_trend', { startDate, endDate });
        return res.data;
    },

    async getPendingSummary() {
        const res = await ToolExecutionService.executeTool('get_pending_summary', {});
        return res.data;
    },

    async getUpcomingPayments(days: number = 30) {
        const res = await ToolExecutionService.executeTool('get_upcoming_payments', { days });
        return res.data;
    }
}

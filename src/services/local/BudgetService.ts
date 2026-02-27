import { run } from '../../db/client';

export const LocalBudgetService = {
    async getBudgetsForMonth(month: string) {
        return await run(
            `SELECT b.*, c.name as category_name, sc.name as sub_category_name
             FROM budgets b
             JOIN categories c ON b.category_id = c.id
             LEFT JOIN sub_categories sc ON b.sub_category_id = sc.id
             WHERE b.month = ?`, [month]
        );
    },

    async getMonthSummary(month: string) {
        // Budget summary: budgeted vs actual
        const budgets = await this.getBudgetsForMonth(month);
        const actualsRows = await run(
            `SELECT COALESCE(SUM(ABS(amount)), 0) as total
             FROM transactions WHERE month = ? AND amount < 0 AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored'`, [month]
        );

        const totalBudget = budgets.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
        const totalSpent = actualsRows[0]?.total || 0;

        return { totalBudget, totalSpent };
    },

    async setBudget(_month: string, _categoryId: string, _subCategoryId: string | null, _amount: number, _id?: string) {
        // stub
    },

    async deleteBudget(_id: string) {
        // stub
    },

    async clearMonthBudgets(_month: string) {
        // stub
    },

    async cloneMonthBudget(_sourceMonth: string, _targetMonth: string) {
        // stub
    },

    async generateBudgetsFromAutomation(_month: string) {
        // stub
    }
};

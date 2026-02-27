import { ToolExecutionService } from './ToolExecutionService';

export interface Budget {
    id: string;
    month: string; // YYYY-MM
    category_id: string;
    sub_category_id?: string | null;
    amount: number;
    category_name: string;
    sub_category_name?: string | null;
    spent?: number; // Calculated field
}

export const BudgetService = {
    async getBudgetsForMonth(month: string): Promise<Budget[]> {
        const res = await ToolExecutionService.executeTool('get_budgets', { month });
        return res.data;
    },

    async setBudget(month: string, categoryId: string, subCategoryId: string | null, amount: number, id?: string): Promise<void> {
        await ToolExecutionService.executeTool('set_category_budget', { month, categoryId, subCategoryId, amount, id });
    },

    async deleteBudget(id: string): Promise<void> {
        await ToolExecutionService.executeTool('delete_budget', { id });
    },

    async getMonthSummary(month: string) {
        const res = await ToolExecutionService.executeTool('get_monthly_summary', { month });
        return res.data;
    },

    async generateBudgetsFromAutomation(month: string): Promise<void> {
        await ToolExecutionService.executeTool('generate_budgets_from_automation', { month });
    },

    async cloneMonthBudget(sourceMonth: string, targetMonth: string): Promise<void> {
        await ToolExecutionService.executeTool('clone_month_budget', { sourceMonth, targetMonth });
    },

    async clearMonthBudgets(month: string): Promise<void> {
        await ToolExecutionService.executeTool('clear_month_budgets', { month });
    },

    async bulkDeleteBudgets(ids: string[]): Promise<void> {
        for (const id of ids) {
            await this.deleteBudget(id);
        }
    }
};

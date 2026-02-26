import { AccountService } from './AccountService';
import { TransactionService } from './TransactionService';
import { CategoryService } from './CategoryService';
import { BudgetService } from './BudgetService';
import { RecurringService } from './RecurringService';
import { InstallmentService } from './InstallmentService';
import { StatisticsService } from './StatisticsService';
import { ForecastService } from './ForecastService';
import { SettingsService } from './SettingsService';
import { AuditService } from './AuditService';
import { ImportExportService } from './ImportExportService';
import toolsManifest from '../../instruct/05-AI-Tools/tools_manifest_v1.json';

type Tier = 0 | 1 | 2;

export const ToolExecutionService = {
    getToolInfo(name: string) {
        return toolsManifest.tools.find(t => t.name === name);
    },

    async executeTool(name: string, parameters: any): Promise<any> {
        const toolInfo = this.getToolInfo(name);

        if (!toolInfo) {
            throw new Error(`Tool '${name}' is not found in the manifest.`);
        }

        const tier = toolInfo.tier as Tier;

        // Tier 2 requires user confirmation
        if (tier === 2) {
            const confirmed = window.confirm(`[SECURITY TIER 2] Hành động hệ thống nhạy cảm.\nTool: ${toolInfo.name}\nMô tả: ${toolInfo.description}\nBạn có chắc chắn muốn thực hiện?`);
            if (!confirmed) {
                return { status: 'error', message: 'User cancelled execution for Tier 2 tool.' };
            }
        }

        try {
            let result: any = null;

            switch (name) {
                // ACCOUNTS
                case 'get_accounts':
                    result = await AccountService.getAll();
                    break;
                case 'create_account':
                    result = await AccountService.create(parameters);
                    break;
                case 'update_account':
                    const { id: accId, ...accData } = parameters;
                    await AccountService.update(accId, accData);
                    result = { success: true };
                    break;
                case 'delete_account':
                    await AccountService.delete(parameters.id);
                    result = { success: true };
                    break;
                case 'get_account_balances':
                    result = await TransactionService.getBalances();
                    break;

                // CATEGORIES
                case 'get_categories':
                    const mainCats = await CategoryService.getAll();
                    const subCats = await CategoryService.getAllSubCategories();
                    result = { main: mainCats, sub: subCats };
                    break;
                case 'create_category':
                    result = await CategoryService.createCategory(parameters.name);
                    break;
                case 'create_subcategory':
                    result = await CategoryService.createSubCategory(parameters.categoryId, parameters.name);
                    break;
                case 'update_category':
                    await CategoryService.updateCategory(parameters.id, parameters.name);
                    result = { success: true };
                    break;
                case 'update_subcategory':
                    await CategoryService.updateSubCategory(parameters.id, parameters.name);
                    result = { success: true };
                    break;
                case 'move_subcategory':
                    await CategoryService.moveSubCategory(parameters.subCategoryId, parameters.newCategoryId);
                    result = { success: true };
                    break;
                case 'delete_category':
                    await CategoryService.deleteCategory(parameters.id);
                    result = { success: true };
                    break;
                case 'delete_subcategory':
                    await CategoryService.deleteSubCategory(parameters.id);
                    result = { success: true };
                    break;

                // TRANSACTIONS
                case 'record_transaction':
                    result = await TransactionService.create(parameters);
                    break;
                case 'transfer_funds':
                    result = await TransactionService.transfer(
                        parameters.fromAccountId,
                        parameters.toAccountId,
                        parameters.amount,
                        parameters.date,
                        parameters.categoryId,
                        parameters.subCategoryId,
                        parameters.note
                    );
                    break;
                case 'search_transactions':
                    result = await TransactionService.getAll(parameters);
                    break;
                case 'update_transaction_status':
                    await TransactionService.update(parameters.id, { status: parameters.status });
                    result = { success: true };
                    break;
                case 'update_transaction':
                    const { id: txId, ...txData } = parameters;
                    await TransactionService.update(txId, txData);
                    result = { success: true };
                    break;
                case 'delete_transaction':
                    await TransactionService.delete(parameters.id);
                    result = { success: true };
                    break;
                case 'bulk_delete_transactions':
                    await TransactionService.bulkDelete(parameters.ids);
                    result = { success: true };
                    break;
                case 'restore_transaction':
                    await TransactionService.restore(parameters.id);
                    result = { success: true };
                    break;
                case 'bulk_restore_transactions':
                    await TransactionService.bulkRestore(parameters.ids);
                    result = { success: true };
                    break;

                // RECURRING
                case 'create_recurring_rule':
                    result = await RecurringService.create(parameters);
                    break;
                case 'get_recurring_rules':
                    result = await RecurringService.getAll();
                    break;
                case 'update_recurring_rule':
                    const { id: rrId, ...rrData } = parameters;
                    await RecurringService.update(rrId, rrData);
                    result = { success: true };
                    break;
                case 'delete_recurring_rule':
                    await RecurringService.delete(parameters.id);
                    result = { success: true };
                    break;
                case 'trigger_recurring_instance':
                    await RecurringService.manualTrigger(parameters.ruleId, parameters.date);
                    result = { success: true };
                    break;
                case 'get_recurring_instances':
                    result = await RecurringService.getAllInstances();
                    break;
                case 'generate_recurring_instances':
                    await RecurringService.generateInstances();
                    result = { success: true };
                    break;

                // INSTALLMENTS
                case 'create_installment_plan':
                    result = await InstallmentService.create(parameters);
                    break;
                case 'get_installment_plans':
                    result = await InstallmentService.getAll();
                    break;
                case 'get_installment_schedule':
                    result = await InstallmentService.getPaymentsByPlan(parameters.planId);
                    break;
                case 'pay_installment':
                    await InstallmentService.markPaid(parameters.paymentId, parameters.transactionId);
                    result = { success: true };
                    break;
                case 'delete_installment_plan':
                    await InstallmentService.delete(parameters.id);
                    result = { success: true };
                    break;
                case 'check_overdue_installments':
                    await InstallmentService.checkOverdue();
                    result = { success: true };
                    break;

                // BUDGET
                case 'get_budgets':
                    result = await BudgetService.getBudgetsForMonth(parameters.month);
                    break;
                case 'set_category_budget':
                    await BudgetService.setBudget(parameters.month, parameters.categoryId, parameters.subCategoryId || null, parameters.amount, parameters.id);
                    result = { success: true };
                    break;
                case 'delete_budget':
                    await BudgetService.deleteBudget(parameters.id);
                    result = { success: true };
                    break;
                case 'clear_month_budgets':
                    await BudgetService.clearMonthBudgets(parameters.month);
                    result = { success: true };
                    break;
                case 'clone_month_budget':
                    await BudgetService.cloneMonthBudget(parameters.sourceMonth, parameters.targetMonth);
                    result = { success: true };
                    break;
                case 'generate_budgets_from_automation':
                    await BudgetService.generateBudgetsFromAutomation(parameters.month);
                    result = { success: true };
                    break;

                // ANALYTICS & STATS
                case 'get_dashboard_summary':
                    result = await StatisticsService.getDashboardSummary(parameters.month);
                    break;
                case 'get_spending_analytics':
                    result = await StatisticsService.getExpenseByCategory(parameters.month);
                    break;
                case 'get_cashflow_trend':
                    result = await StatisticsService.getCashflowTrend(parameters.startDate, parameters.endDate);
                    break;
                case 'get_daily_spending':
                    result = await StatisticsService.getDailySpending(parameters.month);
                    break;
                case 'get_category_movers':
                    result = await StatisticsService.getCategoryMovers(
                        parameters.currentStart, parameters.currentEnd,
                        parameters.compareStart, parameters.compareEnd
                    );
                    break;
                case 'get_pending_summary':
                    result = await StatisticsService.getPendingSummary();
                    break;
                case 'get_upcoming_payments':
                    result = await StatisticsService.getUpcomingPayments(parameters.days);
                    break;
                case 'get_monthly_summary':
                    result = await BudgetService.getMonthSummary(parameters.month);
                    break;

                // FORECAST
                case 'get_financial_forecast':
                    result = await ForecastService.getForecast(parameters.months);
                    break;
                case 'get_forecast_details':
                    result = await ForecastService.getForecastDetails(parameters.targetMonthStr);
                    break;

                // SYSTEM & SETTINGS
                case 'get_audit_logs':
                    result = await AuditService.getLogs(parameters.limit, parameters.offset);
                    break;
                case 'export_system_data':
                    result = await ImportExportService.getExportData();
                    break;
                case 'import_system_data':
                    throw new Error("Dữ liệu nhập quá lớn để gọi qua API tự động. Vui lòng import qua file JSON trên UI.");
                case 'get_settings':
                    result = await SettingsService.getSettings();
                    break;
                case 'set_date_format':
                    await SettingsService.setDateFormat(parameters.format);
                    result = { success: true };
                    break;
                case 'has_password':
                    const hasPwd = await SettingsService.hasPassword();
                    result = { hasPassword: hasPwd };
                    break;
                case 'set_lock_enabled':
                    await SettingsService.setLockEnabled(parameters.enabled);
                    result = { success: true };
                    break;

                default:
                    throw new Error(`Execution block for tool '${name}' is not defined.`);
            }

            return { status: 'success', data: result };

        } catch (error: any) {
            console.error(`Error executing tool [${name}]:`, error);
            return { status: 'error', message: error.message };
        }
    }
};

// Expose to global window object
(window as any).mm2_execute_tool = ToolExecutionService.executeTool.bind(ToolExecutionService);

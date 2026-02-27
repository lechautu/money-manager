import { LocalAccountService } from './local/AccountService';
import { LocalSettingsService } from './local/SettingsService';
import { LocalCategoryService } from './local/CategoryService';
import { LocalStatisticsService } from './local/StatisticsService';
import { LocalTransactionService } from './local/TransactionService';
import { LocalBudgetService } from './local/BudgetService';
import { RecurringService } from './RecurringService';
import { InstallmentService } from './InstallmentService';
import { ForecastService } from './ForecastService';
import { AuditService } from './AuditService';
import { ImportExportService } from './ImportExportService';
import { GatewayClient } from '../api/gateway';
import type { GatewayConfig } from '../api/gateway';
import toolsManifest from '../../instruct/05-AI-Tools/tools_manifest_v1.json';

type Tier = 0 | 1 | 2;

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

        // Global override for "Remote-Only" Mode (Migration result)
        if (!options.remoteConfig && localStorage.getItem('mm2_use_gateway') === 'true') {
            options.remoteConfig = {
                baseUrl: localStorage.getItem('mm2_gateway_url') || 'http://localhost:3200',
                authToken: localStorage.getItem('mm2_gateway_token') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsImlhdCI6MTc3MjE2NTk3NywiZXhwIjoxNzcyMjUyMzc3fQ.2cr4NLf1I85g-WERa4y_ziG_84sKDaclgQgkZDAQm9U',
                approvalToken: 'approved'
            };
        }

        // If remote config is provided, proxy to Gateway
        if (options.remoteConfig) {
            return await GatewayClient.callTool(name, parameters, options.remoteConfig);
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
                    result = await LocalAccountService.getAll();
                    break;
                case 'create_account':
                    result = await LocalAccountService.create(parameters);
                    break;
                case 'update_account':
                    const { id: accId, ...accData } = parameters;
                    await LocalAccountService.update(accId, accData);
                    result = { success: true };
                    break;
                case 'delete_account':
                    await LocalAccountService.delete(parameters.id);
                    result = { success: true };
                    break;
                case 'get_account_balances':
                    result = await LocalTransactionService.getBalances();
                    break;

                // CATEGORIES
                case 'get_categories':
                    const mainCats = await LocalCategoryService.getAll();
                    const subCats = await LocalCategoryService.getAllSubCategories();
                    result = { main: mainCats, sub: subCats };
                    break;
                case 'create_category':
                    result = await LocalCategoryService.createCategory(parameters.name);
                    break;
                case 'create_subcategory':
                    result = await LocalCategoryService.createSubCategory(parameters.categoryId, parameters.name);
                    break;
                case 'update_category':
                    await LocalCategoryService.updateCategory(parameters.id, parameters.name);
                    result = { success: true };
                    break;
                case 'update_subcategory':
                    await LocalCategoryService.updateSubCategory(parameters.id, parameters.name);
                    result = { success: true };
                    break;
                case 'move_subcategory':
                    await LocalCategoryService.moveSubCategory(parameters.subCategoryId, parameters.newCategoryId);
                    result = { success: true };
                    break;
                case 'delete_category':
                    await LocalCategoryService.deleteCategory(parameters.id);
                    result = { success: true };
                    break;
                case 'delete_subcategory':
                    await LocalCategoryService.deleteSubCategory(parameters.id);
                    result = { success: true };
                    break;

                // TRANSACTIONS
                case 'record_transaction':
                    result = await LocalTransactionService.create(parameters);
                    break;
                case 'transfer_funds':
                    result = await LocalTransactionService.transfer(
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
                    result = await LocalTransactionService.getAll(parameters);
                    break;
                case 'update_transaction_status':
                    await LocalTransactionService.update(parameters.id, { status: parameters.status });
                    result = { success: true };
                    break;
                case 'update_transaction':
                    const { id: txId, ...txData } = parameters;
                    await LocalTransactionService.update(txId, txData);
                    result = { success: true };
                    break;
                case 'delete_transaction':
                    await LocalTransactionService.delete(parameters.id);
                    result = { success: true };
                    break;
                case 'bulk_delete_transactions':
                    await LocalTransactionService.bulkDelete(parameters.ids);
                    result = { success: true };
                    break;
                case 'restore_transaction':
                    await LocalTransactionService.restore(parameters.id);
                    result = { success: true };
                    break;
                case 'bulk_restore_transactions':
                    await LocalTransactionService.bulkRestore(parameters.ids);
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
                    result = await LocalBudgetService.getBudgetsForMonth(parameters.month);
                    break;
                case 'set_category_budget':
                    await LocalBudgetService.setBudget(parameters.month, parameters.categoryId, parameters.subCategoryId || null, parameters.amount, parameters.id);
                    result = { success: true };
                    break;
                case 'delete_budget':
                    await LocalBudgetService.deleteBudget(parameters.id);
                    result = { success: true };
                    break;
                case 'clear_month_budgets':
                    await LocalBudgetService.clearMonthBudgets(parameters.month);
                    result = { success: true };
                    break;
                case 'clone_month_budget':
                    await LocalBudgetService.cloneMonthBudget(parameters.sourceMonth, parameters.targetMonth);
                    result = { success: true };
                    break;
                case 'generate_budgets_from_automation':
                    await LocalBudgetService.generateBudgetsFromAutomation(parameters.month);
                    result = { success: true };
                    break;

                // ANALYTICS & STATS
                case 'get_dashboard_summary':
                    result = await LocalStatisticsService.getDashboardSummary(parameters.month);
                    break;
                case 'get_spending_analytics':
                    result = await LocalStatisticsService.getExpenseByCategory(parameters.month);
                    break;
                case 'get_cashflow_trend':
                    result = await LocalStatisticsService.getCashflowTrend(parameters.startDate, parameters.endDate);
                    break;
                case 'get_daily_spending':
                    result = await LocalStatisticsService.getDailySpending(parameters.month);
                    break;
                case 'get_category_movers':
                    result = await LocalStatisticsService.getCategoryMovers(
                        parameters.currentStart, parameters.currentEnd,
                        parameters.compareStart, parameters.compareEnd
                    );
                    break;
                case 'get_pending_summary':
                    result = await LocalStatisticsService.getPendingSummary();
                    break;
                case 'get_upcoming_payments':
                    result = await LocalStatisticsService.getUpcomingPayments(parameters.days);
                    break;
                case 'get_monthly_summary':
                    result = await LocalBudgetService.getMonthSummary(parameters.month);
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
                    result = await LocalSettingsService.getSettings();
                    break;
                case 'set_date_format':
                    await LocalSettingsService.setDateFormat(parameters.format);
                    result = { success: true };
                    break;
                case 'has_password':
                    const hasPwd = await LocalSettingsService.hasPassword();
                    result = { hasPassword: hasPwd };
                    break;
                case 'set_lock_enabled':
                    await LocalSettingsService.setLockEnabled(parameters.enabled);
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

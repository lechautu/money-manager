import { Router } from 'express';
import { BudgetService } from '../services/BudgetService.js';
import { approvalGuard } from '../middleware/approval.js';
import { auditLog } from '../middleware/audit.js';

export const budgetRoutes = Router();

budgetRoutes.get('/get_budgets', (req, res) => {
    try { res.json({ data: BudgetService.getBudgetsForMonth(req.query.month as string || new Date().toISOString().substring(0, 7)) }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

budgetRoutes.post('/set_category_budget', auditLog('set_category_budget', 1, 'budget'), (req, res) => {
    try { res.json({ data: BudgetService.setBudget(req.body.month, req.body.categoryId, req.body.subCategoryId || null, req.body.amount) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

budgetRoutes.delete('/delete_budget', approvalGuard('delete_budget'), auditLog('delete_budget', 2, 'budget'), (req, res) => {
    try { BudgetService.deleteBudget(req.body.id); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

budgetRoutes.delete('/clear_month_budgets', approvalGuard('clear_month_budgets'), auditLog('clear_month_budgets', 2, 'budget'), (req, res) => {
    try { BudgetService.clearMonthBudgets(req.body.month); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

budgetRoutes.post('/clone_month_budget', auditLog('clone_month_budget', 1, 'budget'), (req, res) => {
    try { BudgetService.cloneMonthBudget(req.body.sourceMonth, req.body.targetMonth); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

budgetRoutes.post('/generate_budgets_from_automation', auditLog('generate_budgets_from_automation', 1, 'budget'), (req, res) => {
    try { res.json({ data: BudgetService.generateFromAutomation(req.body.month) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

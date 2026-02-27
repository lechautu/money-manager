import { Router } from 'express';
import { RecurringService } from '../services/RecurringService.js';
import { approvalGuard } from '../middleware/approval.js';
import { auditLog } from '../middleware/audit.js';

export const recurringRoutes = Router();

recurringRoutes.get('/get_recurring_rules', (_req, res) => {
    try { res.json({ data: RecurringService.getAll() }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

recurringRoutes.get('/get_recurring_instances', (req, res) => {
    try { res.json({ data: RecurringService.getInstances(req.query.ruleId as string) }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

recurringRoutes.post('/create_recurring_rule', auditLog('create_recurring_rule', 1, 'recurring'), (req, res) => {
    try { res.json({ data: RecurringService.create(req.body) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

recurringRoutes.post('/update_recurring_rule', auditLog('update_recurring_rule', 1, 'recurring'), (req, res) => {
    try { const { id, ...data } = req.body; RecurringService.update(id, data); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

recurringRoutes.delete('/delete_recurring_rule', approvalGuard('delete_recurring_rule'), auditLog('delete_recurring_rule', 2, 'recurring'), (req, res) => {
    try { RecurringService.delete(req.body.id); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

recurringRoutes.post('/generate_recurring_instances', auditLog('generate_recurring_instances', 1, 'recurring'), (req, res) => {
    try { res.json({ data: RecurringService.generateInstances(req.body.ruleId) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

recurringRoutes.post('/trigger_recurring_instance', auditLog('trigger_recurring_instance', 1, 'recurring'), (req, res) => {
    try { res.json({ data: RecurringService.triggerInstance(req.body.ruleId, req.body.date) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

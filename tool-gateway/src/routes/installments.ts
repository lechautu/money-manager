import { Router } from 'express';
import { InstallmentService } from '../services/InstallmentService.js';
import { approvalGuard } from '../middleware/approval.js';
import { auditLog } from '../middleware/audit.js';

export const installmentRoutes = Router();

installmentRoutes.get('/get_installment_plans', (_req, res) => {
    try { res.json({ data: InstallmentService.getAll() }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

installmentRoutes.get('/get_installment_schedule', (req, res) => {
    try { res.json({ data: InstallmentService.getSchedule(req.query.planId as string) }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

installmentRoutes.get('/get_pending_installment_count', (_req, res) => {
    try { res.json({ data: { count: InstallmentService.getPendingCount() } }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

installmentRoutes.post('/create_installment_plan', auditLog('create_installment_plan', 1, 'installment'), (req, res) => {
    try { res.json({ data: InstallmentService.create(req.body) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

installmentRoutes.post('/update_installment_plan', auditLog('update_installment_plan', 1, 'installment'), (req, res) => {
    try { res.json({ data: InstallmentService.update(req.body.id, req.body) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

installmentRoutes.post('/check_overdue_installments', auditLog('check_overdue_installments', 1, 'installment'), (_req, res) => {
    try { res.json({ data: InstallmentService.checkOverdue() }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

installmentRoutes.post('/pay_installment', auditLog('pay_installment', 1, 'installment'), (req, res) => {
    try {
        if (req.body.transactionId) {
            res.json({ data: InstallmentService.markPaid(req.body.paymentId, req.body.transactionId) });
        } else {
            res.json({ data: InstallmentService.payInstallment(req.body.paymentId, req.body.fromAccountId, req.body.toAccountId) });
        }
    }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

installmentRoutes.delete('/delete_installment_plan', approvalGuard('delete_installment_plan'), auditLog('delete_installment_plan', 2, 'installment'), (req, res) => {
    try { InstallmentService.delete(req.body.id); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});
installmentRoutes.post('/link_installment_transaction', auditLog('link_installment_transaction', 1, 'installment'), (req, res) => {
    try { res.json({ data: InstallmentService.linkTransaction(req.body.paymentId, req.body.transactionId, req.body.type) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

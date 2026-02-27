import { Router } from 'express';
import { TransactionService } from '../services/TransactionService.js';
import { approvalGuard } from '../middleware/approval.js';
import { auditLog } from '../middleware/audit.js';

export const transactionRoutes = Router();

transactionRoutes.get('/search_transactions', (req, res) => {
    try { res.json({ data: TransactionService.getAll(req.query as any) }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

transactionRoutes.post('/record_transaction', auditLog('record_transaction', 1, 'transaction'), (req, res) => {
    try { res.json({ data: TransactionService.create(req.body) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

transactionRoutes.post('/update_transaction', auditLog('update_transaction', 1, 'transaction'), (req, res) => {
    try { const { id, ...data } = req.body; TransactionService.update(id, data); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

transactionRoutes.post('/update_transaction_status', auditLog('update_transaction_status', 1, 'transaction'), (req, res) => {
    try { TransactionService.update(req.body.id, { status: req.body.status }); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

transactionRoutes.post('/transfer_funds', auditLog('transfer_funds', 1, 'transaction'), (req, res) => {
    try {
        const r = TransactionService.transfer(req.body.fromAccountId, req.body.toAccountId, req.body.amount, req.body.date, req.body.categoryId, req.body.subCategoryId, req.body.note);
        res.json({ data: r });
    } catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

transactionRoutes.post('/restore_transaction', auditLog('restore_transaction', 1, 'transaction'), (req, res) => {
    try { TransactionService.restore(req.body.id); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

transactionRoutes.post('/bulk_restore_transactions', auditLog('bulk_restore_transactions', 1, 'transaction'), (req, res) => {
    try { TransactionService.bulkRestore(req.body.ids); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

transactionRoutes.delete('/delete_transaction', approvalGuard('delete_transaction'), auditLog('delete_transaction', 2, 'transaction'), (req, res) => {
    try { TransactionService.delete(req.body.id); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

transactionRoutes.post('/bulk_delete_transactions', approvalGuard('bulk_delete_transactions'), auditLog('bulk_delete_transactions', 2, 'transaction'), (req, res) => {
    try { TransactionService.bulkDelete(req.body.ids); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

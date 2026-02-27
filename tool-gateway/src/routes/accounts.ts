import { Router } from 'express';
import { AccountService } from '../services/AccountService.js';
import { TransactionService } from '../services/TransactionService.js';
import { approvalGuard } from '../middleware/approval.js';
import { auditLog } from '../middleware/audit.js';

export const accountRoutes = Router();

accountRoutes.get('/get_accounts', (_req, res) => {
    try { res.json({ data: AccountService.getAll() }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

accountRoutes.get('/get_account_balances', (_req, res) => {
    try { res.json({ data: TransactionService.getBalances() }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

accountRoutes.post('/create_account', auditLog('create_account', 1, 'account'), (req, res) => {
    try { res.json({ data: AccountService.create(req.body) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

accountRoutes.post('/update_account', auditLog('update_account', 1, 'account'), (req, res) => {
    try {
        const { id, ...data } = req.body;
        AccountService.update(id, data);
        res.json({ data: { success: true } });
    } catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

accountRoutes.delete('/delete_account', approvalGuard('delete_account'), auditLog('delete_account', 2, 'account'), (req, res) => {
    try {
        AccountService.delete(req.body.id);
        res.json({ data: { success: true } });
    } catch (e: any) { res.status(400).json({ error: { code: 'CONFLICT', message: e.message } }); }
});

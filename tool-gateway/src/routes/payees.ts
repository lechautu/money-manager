import { Router } from 'express';
import { PayeeService } from '../services/PayeeService.js';
import { auditLog } from '../middleware/audit.js';

export const payeeRoutes = Router();

payeeRoutes.get('/get_payees', (req, res) => {
    try {
        const includeArchived = req.query.includeArchived === 'true';
        const data = PayeeService.getAll(includeArchived);
        res.json({ data });
    } catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

payeeRoutes.post('/create_payee', auditLog('create_payee', 1, 'payee'), (req, res) => {
    try { res.json({ data: PayeeService.create(req.body.name) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

payeeRoutes.post('/update_payee', auditLog('update_payee', 1, 'payee'), (req, res) => {
    try { res.json({ data: PayeeService.update(req.body.id, req.body.name) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

payeeRoutes.post('/archive_payee', auditLog('archive_payee', 1, 'payee'), (req, res) => {
    try { res.json({ data: PayeeService.archive(req.body.id, req.body.isArchived) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

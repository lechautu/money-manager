import { Router } from 'express';
import { CategoryService } from '../services/CategoryService.js';
import { approvalGuard } from '../middleware/approval.js';
import { auditLog } from '../middleware/audit.js';

export const categoryRoutes = Router();

categoryRoutes.get('/get_categories', (_req, res) => {
    try {
        const main = CategoryService.getAll();
        const sub = CategoryService.getAllSubCategories();
        res.json({ data: { main, sub } });
    } catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

categoryRoutes.post('/create_category', auditLog('create_category', 1, 'category'), (req, res) => {
    try { res.json({ data: CategoryService.createCategory(req.body.name) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

categoryRoutes.post('/create_subcategory', auditLog('create_subcategory', 1, 'subcategory'), (req, res) => {
    try { res.json({ data: CategoryService.createSubCategory(req.body.categoryId, req.body.name) }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

categoryRoutes.post('/update_category', auditLog('update_category', 1, 'category'), (req, res) => {
    try { CategoryService.updateCategory(req.body.id, req.body.name); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

categoryRoutes.post('/update_subcategory', auditLog('update_subcategory', 1, 'subcategory'), (req, res) => {
    try { CategoryService.updateSubCategory(req.body.id, req.body.name); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

categoryRoutes.post('/move_subcategory', auditLog('move_subcategory', 1, 'subcategory'), (req, res) => {
    try { CategoryService.moveSubCategory(req.body.subCategoryId, req.body.newCategoryId); res.json({ data: { success: true } }); }
    catch (e: any) {
        console.error('ERROR in moveSubCategory:', e);
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } });
    }
});

categoryRoutes.delete('/delete_category', approvalGuard('delete_category'), auditLog('delete_category', 2, 'category'), (req, res) => {
    try { CategoryService.deleteCategory(req.body.id); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'CONFLICT', message: e.message } }); }
});

categoryRoutes.delete('/delete_subcategory', approvalGuard('delete_subcategory'), auditLog('delete_subcategory', 2, 'subcategory'), (req, res) => {
    try { CategoryService.deleteSubCategory(req.body.id); res.json({ data: { success: true } }); }
    catch (e: any) { res.status(400).json({ error: { code: 'CONFLICT', message: e.message } }); }
});

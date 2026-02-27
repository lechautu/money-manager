import { run } from '../../db/client';
import { v4 as uuidv4 } from 'uuid';

export const LocalCategoryService = {
    async getAll(): Promise<any[]> {
        return await run('SELECT * FROM categories ORDER BY sort_order, name');
    },

    async getAllSubCategories(): Promise<any[]> {
        return await run('SELECT * FROM sub_categories ORDER BY sort_order, name');
    },

    async createCategory(name: string): Promise<any> {
        const id = uuidv4();
        const now = new Date().toISOString();
        const category = { id, name, sort_order: 0, is_archived: 0, created_at: now, updated_at: now };
        await run('INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [id, name, now, now]);
        return category;
    },

    async createSubCategory(categoryId: string, name: string): Promise<any> {
        const id = uuidv4();
        const now = new Date().toISOString();
        const subCategory = { id, category_id: categoryId, name, sort_order: 0, is_archived: 0, created_at: now, updated_at: now };
        await run('INSERT INTO sub_categories (id, category_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [id, categoryId, name, now, now]);
        return subCategory;
    },

    async updateCategory(id: string, name: string): Promise<void> {
        const now = new Date().toISOString();
        await run('UPDATE categories SET name = ?, updated_at = ? WHERE id = ?', [name, now, id]);
    },

    async updateSubCategory(id: string, name: string): Promise<void> {
        const now = new Date().toISOString();
        await run('UPDATE sub_categories SET name = ?, updated_at = ? WHERE id = ?', [name, now, id]);
    },

    async moveSubCategory(subCategoryId: string, newCategoryId: string): Promise<void> {
        const now = new Date().toISOString();
        await run('UPDATE sub_categories SET category_id = ?, updated_at = ? WHERE id = ?', [newCategoryId, now, subCategoryId]);
        await run('UPDATE transactions SET category_id = ?, updated_at = ? WHERE sub_category_id = ?', [newCategoryId, now, subCategoryId]);
        await run('UPDATE transaction_splits SET category_id = ? WHERE sub_category_id = ?', [newCategoryId, subCategoryId]);
        await run('UPDATE recurring_rules SET category_id = ?, updated_at = ? WHERE sub_category_id = ?', [newCategoryId, now, subCategoryId]);
        await run('UPDATE installment_plans SET payment_category_id = ?, updated_at = ? WHERE payment_sub_category_id = ?', [newCategoryId, now, subCategoryId]);
    },

    async deleteCategory(id: string): Promise<void> {
        await run('DELETE FROM categories WHERE id = ?', [id]);
    },

    async deleteSubCategory(id: string): Promise<void> {
        await run('DELETE FROM sub_categories WHERE id = ?', [id]);
    }
};

import { all, get, run, transaction } from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';

export const CategoryService = {
    getAll() {
        return all('SELECT * FROM categories ORDER BY sort_order, name');
    },

    getAllSubCategories() {
        return all('SELECT * FROM sub_categories ORDER BY sort_order, name');
    },

    createCategory(name: string) {
        const id = uuidv4();
        const now = new Date().toISOString();
        run('INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [id, name, now, now]);
        return get('SELECT * FROM categories WHERE id = ?', [id]);
    },

    createSubCategory(categoryId: string, name: string) {
        const id = uuidv4();
        const now = new Date().toISOString();
        run('INSERT INTO sub_categories (id, category_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [id, categoryId, name, now, now]);
        return get('SELECT * FROM sub_categories WHERE id = ?', [id]);
    },

    updateCategory(id: string, name: string) {
        const now = new Date().toISOString();
        run('UPDATE categories SET name = ?, updated_at = ? WHERE id = ?', [name, now, id]);
    },

    updateSubCategory(id: string, name: string) {
        const now = new Date().toISOString();
        run('UPDATE sub_categories SET name = ?, updated_at = ? WHERE id = ?', [name, now, id]);
    },

    moveSubCategory(subCategoryId: string, newCategoryId: string) {
        const now = new Date().toISOString();
        transaction(() => {
            try {
                // Update sub_category itself
                run('UPDATE sub_categories SET category_id = ?, updated_at = ? WHERE id = ?', [newCategoryId, now, subCategoryId]);
            } catch (error: any) {
                if (error.message?.includes('UNIQUE') && error.message?.includes('category_id, name')) {
                    throw new Error('A sub-category with this name already exists in the target category.');
                }
                throw error;
            }

            // Update associated entities
            run('UPDATE transactions SET category_id = ?, updated_at = ? WHERE sub_category_id = ?', [newCategoryId, now, subCategoryId]);
            run('UPDATE transaction_splits SET category_id = ? WHERE sub_category_id = ?', [newCategoryId, subCategoryId]);
            run('UPDATE recurring_rules SET category_id = ?, updated_at = ? WHERE sub_category_id = ?', [newCategoryId, now, subCategoryId]);
            run('UPDATE installment_plans SET payment_category_id = ?, updated_at = ? WHERE payment_sub_category_id = ?', [newCategoryId, now, subCategoryId]);
            run('UPDATE budgets SET category_id = ? WHERE sub_category_id = ?', [newCategoryId, subCategoryId]);
        });
    },

    deleteCategory(id: string) {
        try {
            run('DELETE FROM categories WHERE id = ?', [id]);
        } catch (error: any) {
            if (error.message?.includes('FOREIGN KEY') || error.message?.includes('constraint')) {
                throw new Error('Cannot delete category: it is referenced by transactions, rules, or has sub-categories.');
            }
            throw error;
        }
    },

    deleteSubCategory(id: string) {
        try {
            run('DELETE FROM sub_categories WHERE id = ?', [id]);
        } catch (error: any) {
            if (error.message?.includes('FOREIGN KEY') || error.message?.includes('constraint')) {
                throw new Error('Cannot delete sub-category: it is referenced by transactions or rules.');
            }
            throw error;
        }
    },
};

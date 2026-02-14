import { run } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

export interface Category {
    id: string;
    name: string;
    sort_order: number;
    is_archived: number;
    created_at: string;
    updated_at: string;
}

export interface SubCategory {
    id: string;
    category_id: string;
    name: string;
    sort_order: number;
    is_archived: number;
    created_at: string;
    updated_at: string;
}

export const CategoryService = {
    async getAll(): Promise<Category[]> {
        return await run('SELECT * FROM categories ORDER BY sort_order, name');
    },

    async getSubCategories(categoryId: string): Promise<SubCategory[]> {
        return await run('SELECT * FROM sub_categories WHERE category_id = ? ORDER BY sort_order, name', [categoryId]);
    },

    async getAllSubCategories(): Promise<SubCategory[]> {
        return await run('SELECT * FROM sub_categories ORDER BY sort_order, name');
    },

    async createCategory(name: string): Promise<Category> {
        const id = uuidv4();
        const now = new Date().toISOString();
        const category: Category = { id, name, sort_order: 0, is_archived: 0, created_at: now, updated_at: now };
        await run(
            'INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
            [id, name, now, now]
        );
        return category;
    },

    async createSubCategory(categoryId: string, name: string): Promise<SubCategory> {
        const id = uuidv4();
        const now = new Date().toISOString();
        const subCategory: SubCategory = {
            id, category_id: categoryId, name, sort_order: 0, is_archived: 0, created_at: now, updated_at: now
        };
        await run(
            'INSERT INTO sub_categories (id, category_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            [id, categoryId, name, now, now]
        );
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
        // 1. Update sub_categories
        await run('UPDATE sub_categories SET category_id = ?, updated_at = ? WHERE id = ?', [newCategoryId, now, subCategoryId]);

        // 2. Update transactions
        await run('UPDATE transactions SET category_id = ?, updated_at = ? WHERE sub_category_id = ?', [newCategoryId, now, subCategoryId]);

        // 3. Update transaction_splits
        await run('UPDATE transaction_splits SET category_id = ? WHERE sub_category_id = ?', [newCategoryId, subCategoryId]);

        // 4. Update recurring_rules
        await run('UPDATE recurring_rules SET category_id = ?, updated_at = ? WHERE sub_category_id = ?', [newCategoryId, now, subCategoryId]);

        // 5. Update installment_plans
        await run('UPDATE installment_plans SET payment_category_id = ?, updated_at = ? WHERE payment_sub_category_id = ?', [newCategoryId, now, subCategoryId]);
    },

    async deleteCategory(id: string): Promise<void> {
        try {
            await run('DELETE FROM categories WHERE id = ?', [id]);
        } catch (error: any) {
            if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
                throw new Error('Cannot delete category because it is being used by transactions, rules, or has sub-categories.');
            }
            throw error;
        }
    },

    async deleteSubCategory(id: string): Promise<void> {
        try {
            await run('DELETE FROM sub_categories WHERE id = ?', [id]);
        } catch (error: any) {
            if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
                throw new Error('Cannot delete sub-category because it is being used by transactions or rules.');
            }
            throw error;
        }
    }
};

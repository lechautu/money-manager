import { ToolExecutionService } from './ToolExecutionService';

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
        const res = await ToolExecutionService.executeTool('get_categories', {});
        return res.data.main;
    },

    async getSubCategories(categoryId: string): Promise<SubCategory[]> {
        const all = await this.getAllSubCategories();
        return all.filter(s => s.category_id === categoryId);
    },

    async getAllSubCategories(): Promise<SubCategory[]> {
        const res = await ToolExecutionService.executeTool('get_categories', {});
        return res.data.sub;
    },

    async createCategory(name: string): Promise<Category> {
        const res = await ToolExecutionService.executeTool('create_category', { name });
        return res.data;
    },

    async createSubCategory(categoryId: string, name: string): Promise<SubCategory> {
        const res = await ToolExecutionService.executeTool('create_subcategory', { categoryId, name });
        return res.data;
    },

    async updateCategory(id: string, name: string): Promise<void> {
        await ToolExecutionService.executeTool('update_category', { id, name });
    },

    async updateSubCategory(id: string, name: string): Promise<void> {
        await ToolExecutionService.executeTool('update_subcategory', { id, name });
    },

    async moveSubCategory(subCategoryId: string, newCategoryId: string): Promise<void> {
        await ToolExecutionService.executeTool('move_subcategory', { subCategoryId, newCategoryId });
    },

    async deleteCategory(id: string): Promise<void> {
        await ToolExecutionService.executeTool('delete_category', { id });
    },

    async deleteSubCategory(id: string): Promise<void> {
        await ToolExecutionService.executeTool('delete_subcategory', { id });
    }
};

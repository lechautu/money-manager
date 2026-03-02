import { all, get, run } from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';

export const PayeeService = {
    getAll(includeArchived = false) {
        if (includeArchived) {
            return all('SELECT * FROM payees ORDER BY name');
        }
        return all('SELECT * FROM payees WHERE is_archived = 0 ORDER BY name');
    },

    getById(id: string) {
        return get('SELECT * FROM payees WHERE id = ?', [id]);
    },

    create(name: string) {
        const trimmed = name.trim();
        if (!trimmed) throw new Error('Payee name is required');

        const normalizedName = trimmed.toLowerCase();

        // Check for duplicate by normalized name
        const existing = get(
            'SELECT * FROM payees WHERE normalized_name = ? AND is_archived = 0',
            [normalizedName]
        );
        if (existing) {
            return existing; // Return existing instead of creating duplicate
        }

        const id = uuidv4();
        const now = new Date().toISOString();
        run(
            'INSERT INTO payees (id, name, normalized_name, is_archived, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
            [id, trimmed, normalizedName, now, now]
        );
        return get('SELECT * FROM payees WHERE id = ?', [id]);
    },

    update(id: string, name: string) {
        const trimmed = name.trim();
        if (!trimmed) throw new Error('Payee name is required');

        const now = new Date().toISOString();
        const normalizedName = trimmed.toLowerCase();
        run(
            'UPDATE payees SET name = ?, normalized_name = ?, updated_at = ? WHERE id = ?',
            [trimmed, normalizedName, now, id]
        );
        return get('SELECT * FROM payees WHERE id = ?', [id]);
    },

    archive(id: string, isArchived: boolean) {
        const now = new Date().toISOString();
        run(
            'UPDATE payees SET is_archived = ?, updated_at = ? WHERE id = ?',
            [isArchived ? 1 : 0, now, id]
        );
        return get('SELECT * FROM payees WHERE id = ?', [id]);
    },

    search(query: string) {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return this.getAll();
        return all(
            'SELECT * FROM payees WHERE is_archived = 0 AND normalized_name LIKE ? ORDER BY name',
            [`%${normalized}%`]
        );
    },
};

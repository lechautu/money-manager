import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = resolve(process.env.DB_PATH || './data/mm2.db');
let db: SqlJsDatabase;

export async function initDatabase(): Promise<void> {
    const SQL = await initSqlJs();
    const dbDir = dirname(DB_PATH);
    mkdirSync(dbDir, { recursive: true });

    if (existsSync(DB_PATH)) {
        const buffer = readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Initialize schema
    const schemaPath = resolve(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    // FORCE SYNC: Drop tables that had schema changes to ensure they are recreated correctly
    // This is temporary for the migration phase to resolve NOT NULL constraint errors
    const forceResetTables = ['installment_payments', 'transaction_splits', 'budgets', 'recurring_instances', 'settings', 'audit_logs'];
    if (!get("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_synced_v3'")) {
        for (const table of forceResetTables) {
            try { db.exec(`DROP TABLE IF EXISTS ${table}`); } catch (e) { }
        }
        db.exec(schema); // Re-run schema to recreate dropped tables
        db.exec("CREATE TABLE IF NOT EXISTS schema_synced_v3 (id INTEGER PRIMARY KEY)");
    }

    // Migration stubs: Ensure all tables match expected local schema
    const migrations = [
        "ALTER TABLE sub_categories ADD COLUMN is_archived INTEGER DEFAULT 0",
        "ALTER TABLE installment_plans ADD COLUMN auto_add INTEGER DEFAULT 0",
        "ALTER TABLE installment_plans ADD COLUMN notify_before_days INTEGER DEFAULT 3",
        "ALTER TABLE recurring_rules ADD COLUMN notify_before_days INTEGER DEFAULT 3",
        "ALTER TABLE installment_payments ADD COLUMN due_month TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE installment_payments ADD COLUMN paid_at TEXT",
        "ALTER TABLE installment_payments ADD COLUMN expense_transaction_id TEXT",
        "ALTER TABLE settings ADD COLUMN password_salt TEXT",
        "ALTER TABLE settings ADD COLUMN password_verifier TEXT",
        "ALTER TABLE audit_logs ADD COLUMN action TEXT NOT NULL DEFAULT 'unknown'",
        "ALTER TABLE audit_logs ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'unknown'",
        "ALTER TABLE audit_logs ADD COLUMN entity_id TEXT",
        "ALTER TABLE audit_logs ADD COLUMN details TEXT",
        "ALTER TABLE transactions ADD COLUMN payee_id TEXT",
        "ALTER TABLE recurring_rules ADD COLUMN payee_id TEXT",
        "ALTER TABLE installment_plans ADD COLUMN payee_id TEXT",
        "ALTER TABLE installment_plans ADD COLUMN default_status TEXT DEFAULT 'posted'"
    ];
    for (const m of migrations) {
        try { db.exec(m); } catch (e) { /* ignore if column exists */ }
    }

    // Sync legacy auto_pay to new auto_add if both exist and auto_add is 0
    try {
        db.exec("UPDATE installment_plans SET auto_add = auto_pay WHERE auto_add = 0");
    } catch (e) {
        // One of the columns might not exist, ignore
    }

    saveDatabase();
}

export function saveDatabase(): void {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
}

// Helper: run SELECT query, return array of rows
export function all<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
}

// Helper: run SELECT query, return first row or undefined
export function get<T = any>(sql: string, params: any[] = []): T | undefined {
    const rows = all<T>(sql, params);
    return rows.length > 0 ? rows[0] : undefined;
}

let transactionDepth = 0;

// Helper: run INSERT/UPDATE/DELETE
export function run(sql: string, params: any[] = []) {
    db.run(sql, params);
    if (transactionDepth === 0) saveDatabase();
}

// Helper: execute raw SQL (used for multi-statement like schema)
export function exec(sql: string) {
    db.exec(sql);
    if (transactionDepth === 0) saveDatabase();
}

// Helper: run in a "transaction" (BEGIN/COMMIT/ROLLBACK)
export function transaction<T>(fn: () => T): T {
    if (transactionDepth === 0) {
        db.run('BEGIN');
    }
    transactionDepth++;
    try {
        const result = fn();
        transactionDepth--;
        if (transactionDepth === 0) {
            db.run('COMMIT');
            saveDatabase();
        }
        return result;
    } catch (err) {
        transactionDepth--;
        if (transactionDepth === 0) {
            try {
                db.run('ROLLBACK');
            } catch (rollbackErr) {
                // Ignore rollback errors to preserve the original error because SQLite
                // might auto-rollback on certain constraints.
            }
        }
        throw err;
    }
}

export function getDb(): SqlJsDatabase {
    return db;
}

import { run, exec } from './client';
import { SCHEMA_V1 } from './schema';

export async function migrate() {
    // Check if meta table exists
    let metaExists = false;
    try {
        const result = await run("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'");
        if (result.length > 0) metaExists = true;
    } catch (e) {
        // Assume not exists
    }

    if (!metaExists) {
        console.log('Initializing Database Schema V1...');
        await exec(SCHEMA_V1);

        // Insert initial meta
        const now = new Date().toISOString();
        await run('INSERT INTO meta (schema_version, created_at, updated_at) VALUES (?, ?, ?)', [1, now, now]);

        // Initialize settings singleton
        await run('INSERT INTO settings (id, lock_enabled, updated_at) VALUES (?, ?, ?)', ['singleton', 0, now]);

        console.log('Database Schema Initialized.');
    } else {
        // Check version
        const rows = await run('SELECT schema_version FROM meta LIMIT 1');
        if (rows.length > 0) {
            const version = rows[0].schema_version;
            console.log(`Current Schema Version: ${version}`);

            // Migration: Add generated_transaction_id to installment_payments
            try {
                // Check if column exists
                const cols = await run("PRAGMA table_info(installment_payments)");
                const hasCol = cols.some((c: any) => c.name === 'generated_transaction_id');

                if (!hasCol) {
                    console.log('Migrating: Adding generated_transaction_id to installment_payments...');
                    await run("ALTER TABLE installment_payments ADD COLUMN generated_transaction_id TEXT REFERENCES transactions(id) ON DELETE RESTRICT");
                    console.log('Migration Complete.');
                }

                // Check for 'transfer' in check constraint? Hard to check.
                // We'll blindly try to migrate if we detect the old constraint scheme?
                // Actually, let's just do a quick check if we can insert a transfer.
                try {
                    // We can't easily check constraint definition in code without parsing sql.
                    // But we can check if we've already done this "v1.1" migration.
                    // Let's use a meta flag or just check if a dummy insert fails? No that's messy.
                    // Let's just run the table recreation if we haven't yet.
                    // A safe way is to check `sqlite_master` for the sql definition.
                    const masterParams = await run("SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'");
                    const currentSql = masterParams[0]?.sql || '';
                    console.log("[Migration] Current Transactions Table SQL:", currentSql);

                    if (!currentSql.includes("transfer")) {
                        console.log("Migrating: Updating transactions table source constraint...");
                        await run("PRAGMA foreign_keys=OFF");
                        await run("BEGIN TRANSACTION");
                        try {
                            await run("ALTER TABLE transactions RENAME TO transactions_old");
                            await run(`
                                CREATE TABLE transactions (
                                    id TEXT PRIMARY KEY,
                                    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
                                    date TEXT NOT NULL,
                                    month TEXT NOT NULL,
                                    amount REAL NOT NULL,
                                    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
                                    sub_category_id TEXT REFERENCES sub_categories(id) ON DELETE RESTRICT,
                                    status TEXT NOT NULL CHECK(status IN ('posted','pending','ignored')),
                                    note TEXT,
                                    source TEXT CHECK(source IN ('manual','recurring','installment','transfer')),
                                    source_ref_id TEXT,
                                    created_at TEXT NOT NULL,
                                    updated_at TEXT NOT NULL
                                )
                             `);
                            // Copy data
                            await run(`
                                INSERT INTO transactions 
                                (id, account_id, date, month, amount, category_id, sub_category_id, status, note, source, source_ref_id, created_at, updated_at)
                                SELECT id, account_id, date, month, amount, category_id, sub_category_id, status, note, source, source_ref_id, created_at, updated_at
                                FROM transactions_old
                             `);

                            // Recreate indices
                            await run("CREATE INDEX IF NOT EXISTS idx_tx_month ON transactions(month)");
                            await run("CREATE INDEX IF NOT EXISTS idx_tx_account_month ON transactions(account_id, month)");
                            await run("CREATE INDEX IF NOT EXISTS idx_tx_category_month ON transactions(category_id, month)");
                            await run("CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status)");
                            await run("CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date)");

                            await run("DROP TABLE transactions_old");
                            await run("COMMIT");
                            console.log("Migration: Transactions table updated.");
                        } catch (err) {
                            console.error("Migration failed, rolling back:", err);
                            await run("ROLLBACK");
                        }
                        await run("PRAGMA foreign_keys=ON");
                    }

                    // Migration V2: Add to_account_id and consolidate transfers
                    const cols2 = await run("PRAGMA table_info(transactions)");
                    const hasToAcc = cols2.some((c: any) => c.name === 'to_account_id');

                    if (!hasToAcc) {
                        console.log("Migrating: Adding to_account_id to transactions...");
                        await run("ALTER TABLE transactions ADD COLUMN to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT");

                        // Consolidate Transfer Pairs
                        // Find all 'transfer' source transactions that are Expenses (amount < 0) and have a source_ref_id
                        console.log("Migrating: Consolidating transfer pairs...");
                        const transfers = await run("SELECT * FROM transactions WHERE source = 'transfer' AND amount < 0 AND source_ref_id IS NOT NULL");

                        await run("BEGIN TRANSACTION");
                        try {
                            for (const tx of transfers) {
                                // Find the linked income transaction
                                const linked = await run("SELECT * FROM transactions WHERE id = ?", [tx.source_ref_id]);
                                if (linked.length > 0) {
                                    const incomeTx = linked[0];
                                    // Update the expense transaction with to_account_id
                                    await run("UPDATE transactions SET to_account_id = ?, source_ref_id = NULL WHERE id = ?", [incomeTx.account_id, tx.id]);
                                    // Delete the income transaction
                                    await run("DELETE FROM transactions WHERE id = ?", [incomeTx.id]);
                                }
                            }
                            // Also clean up any orphan 'transfer' income transactions (amount > 0) that might remain?
                            // Maybe risky. Let's stick to pairs we found.

                            await run("COMMIT");
                            console.log("Migration: Transfers consolidated.");
                        } catch (err) {
                            console.error("Migration V2 failed:", err);
                            await run("ROLLBACK");
                        }
                    }

                    // Migration V3: Repair Foreign Keys broken by V1.1 (transactions rename)
                    // When transactions was renamed to transactions_old, FKs in other tables might have followed it.
                    // We need to point them back to 'transactions'.
                    const tablesToCheck = ['installment_payments', 'recurring_instances'];
                    for (const table of tablesToCheck) {
                        try {
                            const result = await run(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`);
                            if (result.length > 0 && result[0].sql.includes('transactions_old')) {
                                console.log(`Migrating: Repairing FKs for ${table}...`);
                                await run("PRAGMA foreign_keys=OFF");
                                await run("BEGIN TRANSACTION");

                                // 1. Rename current broken table
                                const oldName = `${table}_old_repair`;
                                await run(`ALTER TABLE ${table} RENAME TO ${oldName}`);

                                // 2. Create new table with correct schema (fetched from SCHEMA_V1 or defined dynamically)
                                // Since we don't have the exact create statement handy in a variable for each,
                                // we can reconstruct it. But it's safer to use the known schema from schema.ts
                                // However, schema.ts might not be perfectly up to date with older migrations if we had many.
                                // Fortunately, for these tables, the schema in schema.ts seems current.
                                // Let's reproduce the CREATE statements here to be safe and explicit.

                                if (table === 'installment_payments') {
                                    await run(`
                                        CREATE TABLE installment_payments (
                                            id TEXT PRIMARY KEY,
                                            plan_id TEXT NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
                                            due_date TEXT NOT NULL,
                                            due_month TEXT NOT NULL,
                                            amount REAL NOT NULL,
                                            status TEXT NOT NULL CHECK(status IN ('upcoming','due','overdue','paid')),
                                            paid_at TEXT,
                                            linked_transaction_id TEXT UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
                                            generated_transaction_id TEXT REFERENCES transactions(id) ON DELETE RESTRICT
                                        )
                                    `);
                                    await run(`CREATE INDEX IF NOT EXISTS idx_ip_plan_due_month ON installment_payments(plan_id, due_month)`);
                                    await run(`CREATE INDEX IF NOT EXISTS idx_ip_due_month ON installment_payments(due_month)`);
                                    await run(`CREATE INDEX IF NOT EXISTS idx_ip_status ON installment_payments(status)`);

                                    // Copy data
                                    await run(`INSERT INTO installment_payments SELECT * FROM ${oldName}`);
                                } else if (table === 'recurring_instances') {
                                    await run(`
                                        CREATE TABLE recurring_instances (
                                            id TEXT PRIMARY KEY,
                                            rule_id TEXT NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,
                                            month TEXT NOT NULL,
                                            generated_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
                                            created_at TEXT NOT NULL,
                                            UNIQUE(rule_id, month)
                                        )
                                    `);
                                    // No index on date/status as they don't exist. Maybe month?
                                    // schema.ts doesn't explicitly define indices for recurring_instances other than PK and Unique constraint implies index.

                                    // Copy data
                                    await run(`INSERT INTO recurring_instances SELECT * FROM ${oldName}`);
                                }

                                await run(`DROP TABLE ${oldName}`);
                                await run("COMMIT");
                                console.log(`Migration: ${table} repaired.`);
                            }
                        } catch (err) {
                            console.error(`Migration Repair for ${table} failed:`, err);
                            await run("ROLLBACK");
                        }
                    }

                    await run("PRAGMA foreign_keys=ON");

                } catch (e) {
                    console.error("Error checking/migrating transactions table:", e);
                }

            } catch (e) {
                console.error('Migration failed:', e);
            }
        }
    }
}

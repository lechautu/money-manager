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


                    // Migration V4: Add is_split and transaction_splits table
                    // Also make category_id nullable in transactions table
                    const cols3 = await run("PRAGMA table_info(transactions)");
                    const hasIsSplit = cols3.some((c: any) => c.name === 'is_split');

                    if (!hasIsSplit) {
                        console.log("Migrating: V4 - Split Transactions support...");

                        // 1. Create transaction_splits table
                        await run(`
                            CREATE TABLE IF NOT EXISTS transaction_splits (
                                id TEXT PRIMARY KEY,
                                transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
                                category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
                                sub_category_id TEXT REFERENCES sub_categories(id) ON DELETE RESTRICT,
                                amount REAL NOT NULL,
                                note TEXT
                            )
                        `);
                        await run("CREATE INDEX IF NOT EXISTS idx_split_tx_id ON transaction_splits(transaction_id)");

                        // 2. Recreate transactions table to add is_split and make category_id nullable
                        console.log("Migrating: Updating transactions table schema...");
                        await run("PRAGMA foreign_keys=OFF");
                        await run("BEGIN TRANSACTION");
                        try {
                            await run("ALTER TABLE transactions RENAME TO transactions_old_v4");

                            // Note: category_id is now nullable (removed NOT NULL)
                            await run(`
                                CREATE TABLE transactions (
                                    id TEXT PRIMARY KEY,
                                    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
                                    date TEXT NOT NULL,
                                    month TEXT NOT NULL,
                                    amount REAL NOT NULL,
                                    category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
                                    sub_category_id TEXT REFERENCES sub_categories(id) ON DELETE RESTRICT,
                                    to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
                                    status TEXT NOT NULL CHECK(status IN ('posted','pending','ignored')),
                                    note TEXT,
                                    source CHECK(source IN ('manual','recurring','installment','transfer')),
                                    source_ref_id TEXT,
                                    is_split INTEGER NOT NULL DEFAULT 0,
                                    created_at TEXT NOT NULL,
                                    updated_at TEXT NOT NULL
                                )
                             `);

                            // Copy data
                            // We need to list columns explicitly to avoid issues if schema changed order
                            await run(`
                                INSERT INTO transactions 
                                (id, account_id, date, month, amount, category_id, sub_category_id, to_account_id, status, note, source, source_ref_id, created_at, updated_at, is_split)
                                SELECT id, account_id, date, month, amount, category_id, sub_category_id, to_account_id, status, note, source, source_ref_id, created_at, updated_at, 0
                                FROM transactions_old_v4
                             `);

                            // Recreate indices
                            await run("CREATE INDEX IF NOT EXISTS idx_tx_month ON transactions(month)");
                            await run("CREATE INDEX IF NOT EXISTS idx_tx_account_month ON transactions(account_id, month)");
                            await run("CREATE INDEX IF NOT EXISTS idx_tx_category_month ON transactions(category_id, month)");
                            await run("CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status)");
                            await run("CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date)");

                            // Check and Repair FKs in other tables causing them to point to new transactions table
                            // Since we renamed to transactions_old_v4, FKs might follow.
                            // We reuse the logic from V3 but applied here for V4.
                            const tablesToRepair = ['installment_payments', 'recurring_instances', 'transaction_splits'];

                            for (const table of tablesToRepair) {
                                // transaction_splits was just created, so it should point to 'transactions', which is the new table.
                                // But installment_payments and recurring_instances might differ.
                                if (table === 'transaction_splits') continue;

                                const result = await run(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`);
                                if (result.length > 0 && result[0].sql.includes('transactions_old_v4')) {
                                    console.log(`Migrating: Repairing FKs for ${table} (V4)...`);
                                    const oldName = `${table}_old_v4_repair`;
                                    await run(`ALTER TABLE ${table} RENAME TO ${oldName}`);

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
                                        await run(`INSERT INTO recurring_instances SELECT * FROM ${oldName}`);
                                    }

                                    await run(`DROP TABLE ${oldName}`);
                                }
                            }

                            await run("DROP TABLE transactions_old_v4");
                            await run("COMMIT");
                            console.log("Migration V4: Complete.");
                        } catch (err) {
                            console.error("Migration V4 failed, rolling back:", err);
                            await run("ROLLBACK");
                        }
                        await run("PRAGMA foreign_keys=ON");
                    }

                    // Fix for V4 migration issue: transaction_splits references transactions_old_v4
                    // This happens because transaction_splits was created before transactions table rename in V4
                    try {
                        const fkList = await run("PRAGMA foreign_key_list(transaction_splits)");
                        const referencesOldTable = fkList.some((fk: any) => fk.table === 'transactions_old_v4');

                        if (referencesOldTable) {
                            console.log("Migrating: Repairing transaction_splits FK...");
                            await run("PRAGMA foreign_keys=OFF"); // Disable to safely move tables
                            try {
                                // Rename broken table
                                const repairTable = 'transaction_splits_repair_v4';
                                await run(`DROP TABLE IF EXISTS ${repairTable}`); // Ensure cleanup
                                await run(`ALTER TABLE transaction_splits RENAME TO ${repairTable}`);

                                // Create correct table
                                await run(`
                                    CREATE TABLE transaction_splits (
                                        id TEXT PRIMARY KEY,
                                        transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
                                        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
                                        sub_category_id TEXT REFERENCES sub_categories(id) ON DELETE RESTRICT,
                                        amount REAL NOT NULL,
                                        note TEXT
                                    )
                                `);
                                await run("CREATE INDEX IF NOT EXISTS idx_split_tx_id ON transaction_splits(transaction_id)");

                                // Attempt to restore data
                                try {
                                    await run(`INSERT INTO transaction_splits SELECT * FROM ${repairTable}`);
                                } catch (e) {
                                    console.warn("Could not restore transaction_splits data (likely empty or invalid):", e);
                                }

                                await run(`DROP TABLE ${repairTable}`);
                                console.log("Migrating: transaction_splits repaired successfully.");
                            } finally {
                                await run("PRAGMA foreign_keys=ON");
                            }
                        }
                    } catch (e) {
                        console.error("Error repairing transaction_splits:", e);
                    }

                } catch (e) {
                    console.error("Error checking/migrating transactions table:", e);
                }


                // Migration V5: Add deleted_at to transactions and create audit_logs
                const cols4 = await run("PRAGMA table_info(transactions)");
                const hasDeletedAt = cols4.some((c: any) => c.name === 'deleted_at');

                if (!hasDeletedAt) {
                    console.log("Migrating: V5 - Soft Delete support...");
                    await run("ALTER TABLE transactions ADD COLUMN deleted_at TEXT");
                    console.log("Migration V5: added deleted_at to transactions.");
                }

                // Check for audit_logs table
                const auditLogsTable = await run("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'");
                if (auditLogsTable.length === 0) {
                    console.log("Migrating: V5 - Create audit_logs table...");
                    await run(`
                            CREATE TABLE IF NOT EXISTS audit_logs (
                                id TEXT PRIMARY KEY,
                                action TEXT NOT NULL,
                                entity_type TEXT NOT NULL,
                                entity_id TEXT,
                                details TEXT,
                                created_at TEXT NOT NULL
                            )
                        `);
                    await run("CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at)");
                    console.log("Migration V5: created audit_logs table.");
                }

                // Migration V6: Budget by Sub-category
                const budgetCols = await run("PRAGMA table_info(budgets)");
                const hasSubCatCol = budgetCols.some((c: any) => c.name === 'sub_category_id');

                if (!hasSubCatCol) {
                    console.log("Migrating: V6 - Budget by Sub-category...");
                    await run("PRAGMA foreign_keys=OFF");
                    await run("BEGIN TRANSACTION");
                    try {
                        await run("ALTER TABLE budgets RENAME TO budgets_old");
                        await run(`
                            CREATE TABLE budgets (
                                id TEXT PRIMARY KEY,
                                month TEXT NOT NULL,
                                category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
                                sub_category_id TEXT REFERENCES sub_categories(id) ON DELETE RESTRICT,
                                amount REAL NOT NULL,
                                UNIQUE(month, category_id, sub_category_id)
                            )
                        `);
                        await run("CREATE INDEX IF NOT EXISTS idx_budget_month ON budgets(month)");
                        await run("CREATE INDEX IF NOT EXISTS idx_budget_cat_sub ON budgets(category_id, sub_category_id)");

                        // Copy data
                        await run(`
                            INSERT INTO budgets (id, month, category_id, amount)
                            SELECT id, month, category_id, amount
                            FROM budgets_old
                        `);

                        await run("DROP TABLE budgets_old");
                        await run("COMMIT");
                        console.log("Migration V6: Complete.");
                    } catch (err) {
                        console.error("Migration V6 failed, rolling back:", err);
                        await run("ROLLBACK");
                    }
                    await run("PRAGMA foreign_keys=ON");
                }

                // Migration V7: Recurring Transfer Support
                const recurringCols = await run("PRAGMA table_info(recurring_rules)");
                const hasTypeCol = recurringCols.some((c: any) => c.name === 'type');

                if (!hasTypeCol) {
                    console.log("Migrating: V7 - Recurring Transfer support...");
                    await run("PRAGMA foreign_keys=OFF");
                    await run("BEGIN TRANSACTION");
                    try {
                        await run("ALTER TABLE recurring_rules RENAME TO recurring_rules_old");
                        await run(`
                            CREATE TABLE recurring_rules (
                                id TEXT PRIMARY KEY,
                                name TEXT NOT NULL,
                                type TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('income', 'expense', 'transfer')),
                                account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
                                to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
                                amount REAL NOT NULL,
                                category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
                                sub_category_id TEXT REFERENCES sub_categories(id) ON DELETE RESTRICT,
                                start_month TEXT NOT NULL,
                                end_month TEXT,
                                day_of_month INTEGER NOT NULL DEFAULT 1 CHECK(day_of_month BETWEEN 1 AND 28),
                                default_status TEXT NOT NULL DEFAULT 'pending' CHECK(default_status IN ('pending','posted')),
                                is_active INTEGER NOT NULL DEFAULT 1,
                                created_at TEXT NOT NULL,
                                updated_at TEXT NOT NULL
                            )
                        `);

                        // Copy data, inferring type from amount
                        await run(`
                            INSERT INTO recurring_rules 
                            (id, name, type, account_id, amount, category_id, sub_category_id, start_month, end_month, day_of_month, default_status, is_active, created_at, updated_at)
                            SELECT id, name, CASE WHEN amount >= 0 THEN 'income' ELSE 'expense' END, account_id, amount, category_id, sub_category_id, start_month, end_month, day_of_month, default_status, is_active, created_at, updated_at
                            FROM recurring_rules_old
                        `);

                        // Repair FK in recurring_instances
                        const instancesSql = await run("SELECT sql FROM sqlite_master WHERE type='table' AND name='recurring_instances'");
                        if (instancesSql.length > 0 && instancesSql[0].sql.includes('recurring_rules_old')) {
                            await run("ALTER TABLE recurring_instances RENAME TO recurring_instances_old_v7");
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
                            await run("INSERT INTO recurring_instances SELECT * FROM recurring_instances_old_v7");
                            await run("DROP TABLE recurring_instances_old_v7");
                        }

                        await run("DROP TABLE recurring_rules_old");
                        await run("COMMIT");
                        console.log("Migration V7: Complete.");
                    } catch (err) {
                        console.error("Migration V7 failed, rolling back:", err);
                        await run("ROLLBACK");
                    }
                    await run("PRAGMA foreign_keys=ON");
                }

                // Migration V8: Multi-Frequency Recurring Rules
                const recurringColsV8 = await run("PRAGMA table_info(recurring_rules)");
                const hasFrequencyCol = recurringColsV8.some((c: any) => c.name === 'frequency');

                if (!hasFrequencyCol) {
                    console.log("Migrating: V8 - Multi-Frequency Recurring support...");
                    await run("PRAGMA foreign_keys=OFF");
                    await run("BEGIN TRANSACTION");
                    try {
                        // 1. Recreate recurring_rules
                        await run("ALTER TABLE recurring_rules RENAME TO recurring_rules_old_v8");
                        await run(`
                            CREATE TABLE recurring_rules (
                                id TEXT PRIMARY KEY,
                                name TEXT NOT NULL,
                                type TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('income', 'expense', 'transfer')),
                                frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
                                account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
                                to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
                                amount REAL NOT NULL,
                                category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
                                sub_category_id TEXT REFERENCES sub_categories(id) ON DELETE RESTRICT,
                                start_date TEXT NOT NULL,
                                end_month TEXT,
                                default_status TEXT NOT NULL DEFAULT 'pending' CHECK(default_status IN ('pending','posted')),
                                is_active INTEGER NOT NULL DEFAULT 1,
                                created_at TEXT NOT NULL,
                                updated_at TEXT NOT NULL
                            )
                        `);

                        // Copy data, merging start_month and day_of_month into start_date
                        await run(`
                            INSERT INTO recurring_rules 
                            (id, name, type, frequency, account_id, to_account_id, amount, category_id, sub_category_id, start_date, end_month, default_status, is_active, created_at, updated_at)
                            SELECT id, name, type, 'monthly', account_id, to_account_id, amount, category_id, sub_category_id, 
                                   start_month || '-' || printf('%02d', day_of_month), 
                                   end_month, default_status, is_active, created_at, updated_at
                            FROM recurring_rules_old_v8
                        `);

                        // 2. Recreate recurring_instances
                        await run("ALTER TABLE recurring_instances RENAME TO recurring_instances_old_v8");
                        await run(`
                            CREATE TABLE recurring_instances (
                                id TEXT PRIMARY KEY,
                                rule_id TEXT NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,
                                date TEXT NOT NULL,
                                generated_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
                                created_at TEXT NOT NULL,
                                UNIQUE(rule_id, date)
                            )
                        `);

                        // Copy data, converting month to full date using the old rules' day_of_month
                        await run(`
                            INSERT INTO recurring_instances (id, rule_id, date, generated_transaction_id, created_at)
                            SELECT i.id, i.rule_id, 
                                   i.month || '-' || printf('%02d', r.day_of_month), 
                                   i.generated_transaction_id, i.created_at
                            FROM recurring_instances_old_v8 i
                            JOIN recurring_rules_old_v8 r ON i.rule_id = r.id
                        `);

                        await run("DROP TABLE recurring_rules_old_v8");
                        await run("DROP TABLE recurring_instances_old_v8");
                        await run("COMMIT");
                        console.log("Migration V8: Complete.");
                    } catch (err) {
                        console.error("Migration V8 failed, rolling back:", err);
                        await run("ROLLBACK");
                    }
                    await run("PRAGMA foreign_keys=ON");
                }

                // Migration V9: Recurring End Conditions
                const recurringColsV9 = await run("PRAGMA table_info(recurring_rules)");
                const hasMaxInstancesCol = recurringColsV9.some((c: any) => c.name === 'max_instances');

                if (!hasMaxInstancesCol) {
                    console.log("Migrating: V9 - Recurring End Conditions...");
                    await run("PRAGMA foreign_keys=OFF");
                    await run("BEGIN TRANSACTION");
                    try {
                        await run("ALTER TABLE recurring_rules RENAME TO recurring_rules_old_v9");
                        await run(`
                            CREATE TABLE recurring_rules (
                                id TEXT PRIMARY KEY,
                                name TEXT NOT NULL,
                                type TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('income', 'expense', 'transfer')),
                                frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
                                account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
                                to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
                                amount REAL NOT NULL,
                                category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
                                sub_category_id TEXT REFERENCES sub_categories(id) ON DELETE RESTRICT,
                                start_date TEXT NOT NULL,
                                end_date TEXT,
                                max_instances INTEGER,
                                default_status TEXT NOT NULL DEFAULT 'pending' CHECK(default_status IN ('pending','posted')),
                                is_active INTEGER NOT NULL DEFAULT 1,
                                created_at TEXT NOT NULL,
                                updated_at TEXT NOT NULL
                            )
                        `);

                        // Copy data, converting end_month (YYYY-MM) to end_date (YYYY-MM-28)
                        await run(`
                            INSERT INTO recurring_rules 
                            (id, name, type, frequency, account_id, to_account_id, amount, category_id, sub_category_id, start_date, end_date, max_instances, default_status, is_active, created_at, updated_at)
                            SELECT id, name, type, frequency, account_id, to_account_id, amount, category_id, sub_category_id, start_date, 
                                   CASE WHEN end_month IS NOT NULL THEN end_month || '-28' ELSE NULL END, 
                                   NULL, default_status, is_active, created_at, updated_at
                            FROM recurring_rules_old_v9
                        `);

                        await run("DROP TABLE recurring_rules_old_v9");
                        await run("COMMIT");
                        console.log("Migration V9: Complete.");
                    } catch (err) {
                        console.error("Migration V9 failed, rolling back:", err);
                        await run("ROLLBACK");
                    }
                    await run("PRAGMA foreign_keys=ON");
                }

                // Migration V10: Fix broken Foreign Key in recurring_instances 
                // (caused by V9 rename without following update)
                const instanceSchemaResult = await run("SELECT sql FROM sqlite_master WHERE name = 'recurring_instances'");
                const isBrokenFK = instanceSchemaResult.length > 0 && instanceSchemaResult[0].sql.includes('recurring_rules_old_v9');

                if (isBrokenFK) {
                    console.log("Migrating: V10 - Fixing broken Foreign Key in recurring_instances...");
                    await run("PRAGMA foreign_keys=OFF");
                    await run("BEGIN TRANSACTION");
                    try {
                        await run("ALTER TABLE recurring_instances RENAME TO recurring_instances_old_v10");
                        await run(`
                            CREATE TABLE recurring_instances (
                                id TEXT PRIMARY KEY,
                                rule_id TEXT NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,
                                date TEXT NOT NULL,
                                generated_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
                                created_at TEXT NOT NULL,
                                UNIQUE(rule_id, date)
                            )
                        `);

                        await run(`
                            INSERT INTO recurring_instances (id, rule_id, date, generated_transaction_id, created_at)
                            SELECT id, rule_id, date, generated_transaction_id, created_at FROM recurring_instances_old_v10
                        `);

                        await run("DROP TABLE recurring_instances_old_v10");
                        await run("COMMIT");
                        console.log("Migration V10: Complete.");
                    } catch (err) {
                        console.error("Migration V10 failed, rolling back:", err);
                        await run("ROLLBACK");
                    }
                    await run("PRAGMA foreign_keys=ON");
                }

                // Migration V11: Recurring Auto-Add Toggle
                const recurringColsV11 = await run("PRAGMA table_info(recurring_rules)");
                const hasAutoAddCol = recurringColsV11.some((c: any) => c.name === 'auto_add');

                if (!hasAutoAddCol) {
                    console.log("Migrating: V11 - Recurring Auto-Add Toggle...");
                    await run("ALTER TABLE recurring_rules ADD COLUMN auto_add INTEGER NOT NULL DEFAULT 1");
                    console.log("Migration V11: Complete.");
                }

                // Migration V12: Account Initial Balance
                const accountColsV12 = await run("PRAGMA table_info(accounts)");
                const hasInitialBalanceCol = accountColsV12.some((c: any) => c.name === 'initial_balance');

                if (!hasInitialBalanceCol) {
                    console.log("Migrating: V12 - Account Initial Balance...");
                    await run("ALTER TABLE accounts ADD COLUMN initial_balance REAL NOT NULL DEFAULT 0");
                    console.log("Migration V12: Complete.");
                }

                // Migration V13: Cleanup Future Recurring (One-time cleanup of auto-generated records)
                const todayStr = new Date().toISOString().slice(0, 10);
                const futureInst = await run("SELECT generated_transaction_id FROM recurring_instances WHERE date > ?", [todayStr]);
                if (futureInst.length > 0) {
                    console.log(`Migrating: V13 - Cleaning up ${futureInst.length} future recurring instances...`);
                    const ids = futureInst.map((i: any) => i.generated_transaction_id).filter((id: any) => id);

                    // Delete from recurring_instances first to satisfy FKs (ON DELETE RESTRICT)
                    await run("DELETE FROM recurring_instances WHERE date > ?", [todayStr]);

                    if (ids.length > 0) {
                        const placeholders = ids.map(() => '?').join(',');

                        // Clear references in installment_payments if any
                        await run(`UPDATE installment_payments SET generated_transaction_id = NULL WHERE generated_transaction_id IN (${placeholders})`, ids);

                        await run(`DELETE FROM transaction_splits WHERE transaction_id IN (${placeholders})`, ids);
                        await run(`DELETE FROM transactions WHERE id IN (${placeholders})`, ids);
                    }
                    console.log("Migration V13: Complete.");
                }

                // Migration V14: Date Format Setting
                const settingsColsV14 = await run("PRAGMA table_info(settings)");
                const hasDateFormatCol = settingsColsV14.some((c: any) => c.name === 'date_format');

                if (!hasDateFormatCol) {
                    console.log("Migrating: V14 - Date Format Setting...");
                    await run("ALTER TABLE settings ADD COLUMN date_format TEXT NOT NULL DEFAULT 'dd/MM/yyyy'");
                    console.log("Migration V14: Complete.");
                }

            } catch (e) {
                console.error('Migration failed:', e);
            }
        }
    }
}

export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS meta (
    schema_version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('bank','credit','debit')),
    currency TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sub_categories (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    date TEXT NOT NULL,
    month TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    sub_category_id TEXT REFERENCES sub_categories(id) ON DELETE RESTRICT,
    to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK(status IN ('posted','pending','ignored')),
    note TEXT,
    source TEXT CHECK(source IN ('manual','recurring','installment','transfer')),
    source_ref_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_month ON transactions(month);
CREATE INDEX IF NOT EXISTS idx_tx_account_month ON transactions(account_id, month);
CREATE INDEX IF NOT EXISTS idx_tx_category_month ON transactions(category_id, month);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);

CREATE TABLE IF NOT EXISTS installment_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    credit_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    total_amount REAL NOT NULL,
    tenor_months INTEGER NOT NULL CHECK(tenor_months >= 1),
    start_date TEXT NOT NULL,
    notify_before_days INTEGER NOT NULL DEFAULT 0,
    payment_source_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
    payment_category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    payment_sub_category_id TEXT REFERENCES sub_categories(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS installment_payments (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
    due_date TEXT NOT NULL,
    due_month TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('upcoming','due','overdue','paid')),
    paid_at TEXT,
    linked_transaction_id TEXT UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
    generated_transaction_id TEXT REFERENCES transactions(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ip_plan_due_month ON installment_payments(plan_id, due_month);
CREATE INDEX IF NOT EXISTS idx_ip_due_month ON installment_payments(due_month);
CREATE INDEX IF NOT EXISTS idx_ip_status ON installment_payments(status);

CREATE TABLE IF NOT EXISTS recurring_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    amount REAL NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    sub_category_id TEXT REFERENCES sub_categories(id) ON DELETE RESTRICT,
    start_month TEXT NOT NULL,
    end_month TEXT,
    day_of_month INTEGER NOT NULL DEFAULT 1 CHECK(day_of_month BETWEEN 1 AND 28),
    default_status TEXT NOT NULL DEFAULT 'pending' CHECK(default_status IN ('pending','posted')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_instances (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    generated_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL,
    UNIQUE(rule_id, month)
);

CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    amount REAL NOT NULL,
    UNIQUE(month, category_id)
);

CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    lock_enabled INTEGER NOT NULL DEFAULT 0,
    password_salt TEXT,
    password_verifier TEXT,
    updated_at TEXT NOT NULL
);
`;

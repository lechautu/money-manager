CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('bank','credit','debit')),
    currency TEXT NOT NULL,
    initial_balance REAL NOT NULL DEFAULT 0,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sub_categories (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS payees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    normalized_name TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    to_account_id TEXT REFERENCES accounts(id),
    date TEXT NOT NULL,
    month TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT REFERENCES categories(id),
    sub_category_id TEXT REFERENCES sub_categories(id),
    status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('posted','pending','ignored')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','recurring','installment','transfer')),
    source_ref_id TEXT,
    is_split INTEGER DEFAULT 0,
    note TEXT,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_splits (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES categories(id),
    sub_category_id TEXT REFERENCES sub_categories(id),
    amount REAL NOT NULL,
    note TEXT
);

CREATE TABLE IF NOT EXISTS recurring_rules (
    id TEXT PRIMARY KEY,
    name TEXT,
    frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','biweekly','monthly','quarterly','yearly')),
    type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
    amount REAL NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    max_instances INTEGER,
    auto_add INTEGER DEFAULT 1,
    default_status TEXT DEFAULT 'pending',
    is_active INTEGER DEFAULT 1,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    to_account_id TEXT REFERENCES accounts(id),
    category_id TEXT REFERENCES categories(id),
    sub_category_id TEXT REFERENCES sub_categories(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_instances (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    generated_transaction_id TEXT UNIQUE REFERENCES transactions(id),
    created_at TEXT NOT NULL,
    UNIQUE(rule_id, date)
);

CREATE TABLE IF NOT EXISTS installment_plans (
    id TEXT PRIMARY KEY,
    name TEXT,
    credit_account_id TEXT NOT NULL REFERENCES accounts(id),
    payment_source_account_id TEXT REFERENCES accounts(id),
    total_amount REAL NOT NULL,
    tenor_months INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    payment_category_id TEXT REFERENCES categories(id),
    payment_sub_category_id TEXT REFERENCES sub_categories(id),
    notify_before_days INTEGER DEFAULT 3,
    auto_add INTEGER DEFAULT 1,
    default_status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS installment_payments (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
    due_date TEXT NOT NULL,
    due_month TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming','due','overdue','paid')),
    paid_at TEXT,
    linked_transaction_id TEXT UNIQUE REFERENCES transactions(id),
    generated_transaction_id TEXT REFERENCES transactions(id),
    expense_transaction_id TEXT REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id),
    sub_category_id TEXT REFERENCES sub_categories(id),
    amount REAL NOT NULL,
    UNIQUE(month, category_id, sub_category_id)
);

CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    date_format TEXT DEFAULT 'dd/MM/yyyy',
    lock_enabled INTEGER DEFAULT 0,
    password_hash TEXT,
    password_salt TEXT,
    password_verifier TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    trace_id TEXT,
    actor_user_id TEXT,
    caller_type TEXT DEFAULT 'mcp',
    tool_name TEXT,
    tier INTEGER,
    resource_type TEXT,
    resource_ids TEXT,
    result TEXT,
    error_code TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    tool_name TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TEXT NOT NULL
);

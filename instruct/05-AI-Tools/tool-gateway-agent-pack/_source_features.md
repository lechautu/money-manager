# Money Manager Technical Context

This document provides a comprehensive technical overview of the Money Manager application, intended for use as context for LLM agents.

## 1. System Architecture
*   **Frontend**: React 19, TypeScript, Vite.
*   **Styling**: TailwindCSS via `@tailwindcss/postcss`.
*   **State Management**: React Context (`UndoProvider`, `DateProvider`, `ToastProvider`) + Local Component State.
*   **Database**: `wa-sqlite` (WebAssembly SQLite) with `IDBBatchAtomicVFS` for indexedDB persistence.
    *   **Implication**: Database runs entirely in the browser main thread (or worker, currently main thread inferred from code). Data persists to IndexedDB.
*   **Routing**: `react-router-dom` v7.

## 2. Database Schema (SQLite)

### Core Entities
```sql
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('bank','credit','debit')),
    currency TEXT NOT NULL,
    initial_balance REAL NOT NULL DEFAULT 0,
    -- ... timestamps
);

CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0
    -- ... timestamps
);

CREATE TABLE sub_categories (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id),
    name TEXT NOT NULL,
    UNIQUE(category_id, name)
);

CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES accounts(id),
    to_account_id TEXT REFERENCES accounts(id), -- For transfers only
    date TEXT NOT NULL, -- YYYY-MM-DD
    month TEXT NOT NULL, -- YYYY-MM
    amount REAL NOT NULL, -- Negative for expense, Positive for income
    category_id TEXT REFERENCES categories(id),
    sub_category_id TEXT REFERENCES sub_categories(id),
    status TEXT CHECK(status IN ('posted','pending','ignored')),
    source TEXT CHECK(source IN ('manual','recurring','installment','transfer')),
    source_ref_id TEXT, -- ID of recurring_rule or installment_payment
    is_split INTEGER DEFAULT 0,
    note TEXT,
    deleted_at TEXT -- Soft delete
);

CREATE TABLE transaction_splits (
    id TEXT PRIMARY KEY,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES categories(id),
    sub_category_id TEXT REFERENCES sub_categories(id),
    amount REAL NOT NULL, -- Positive value usually, overrides main tx category logic
    note TEXT
);
```

### Automation Entities
```sql
CREATE TABLE recurring_rules (
    id TEXT PRIMARY KEY,
    frequency TEXT CHECK(frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
    type TEXT CHECK(type IN ('income', 'expense', 'transfer')),
    amount REAL,
    start_date TEXT,
    end_date TEXT,
    max_instances INTEGER,
    auto_add INTEGER DEFAULT 1, -- 1=Auto create transaction, 0=Manual trigger only
    account_id TEXT REFERENCES accounts(id),
    category_id TEXT REFERENCES categories(id)
);

CREATE TABLE recurring_instances (
    id TEXT PRIMARY KEY,
    rule_id TEXT REFERENCES recurring_rules(id),
    date TEXT NOT NULL,
    generated_transaction_id TEXT UNIQUE REFERENCES transactions(id)
);

CREATE TABLE installment_plans (
    id TEXT PRIMARY KEY,
    credit_account_id TEXT REFERENCES accounts(id), -- Account owing the money
    total_amount REAL,
    tenor_months INTEGER,
    start_date TEXT,
    payment_source_account_id TEXT REFERENCES accounts(id), -- Account paying the bill
    payment_category_id TEXT REFERENCES categories(id)
);

CREATE TABLE installment_payments (
    id TEXT PRIMARY KEY,
    plan_id TEXT REFERENCES installment_plans(id),
    due_date TEXT,
    amount REAL,
    status TEXT CHECK(status IN ('upcoming','due','overdue','paid')),
    linked_transaction_id TEXT REFERENCES transactions(id), -- The payment transaction
    generated_transaction_id TEXT REFERENCES transactions(id) -- The monthly expense transaction (if auto-generated)
);
```

### Planning
```sql
CREATE TABLE budgets (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL, -- YYYY-MM
    category_id TEXT REFERENCES categories(id),
    sub_category_id TEXT REFERENCES sub_categories(id),
    amount REAL NOT NULL,
    UNIQUE(month, category_id, sub_category_id)
);
```

## 3. Feature Implementation Details

### A. Transactions & Balances
*   **Balance Calculation**:
    *   `Posted Balance`: Sum of transactions where `status = 'posted'`.
    *   `Effective Balance`: Sum of transactions where `status IN ('posted', 'pending')`.
    *   **Transfers**: Handled by summing `amount` for `account_id` (usually negative) AND `ABS(amount)` for `to_account_id` (incoming).
*   **Split Transactions**:
    *   Flag `is_split = 1` in `transactions` table.
    *   Actual breakdown stored in `transaction_splits`.
    *   **Reporting**: Charts/Analytics must query `transaction_splits` for accurate category breakdown, NOT the main transaction record when `is_split=1`.

### B. Recurring Transactions
*   **Logic**: `RecurringService.generateInstances()` runs on app load (or via service call).
*   **Horizon**: Checks from `start_date` up to `TODAY`. Does *not* pre-generate future transactions in the DB to avoid clutter.
*   **Cycle**: `next_date` calculated using `date-fns` (addDays, addMonths, etc.) based on frequency.
*   **Idempotency**: Checked via `recurring_instances(rule_id, date)` unique constraint to prevent duplicate generation.

### C. Installments
*   **Concept**: Tracks loan/credit payments over time.
*   **Flow**:
    1.  Create Plan -> Generates `installment_payments` (schedule) for full tenor.
    2.  `checkOverdue()` runs on load -> Marks `upcoming` payments as `due`/`overdue` based on date.
    3.  **Auto-Expense**: If a payment is due, system auto-creates an "Expense" transaction on the `credit_account_id` (representing the obligation/spending for that month) if configured.
    4.  **Payment**: User creates a "Transfer" transaction from `payment_source` to `credit_account` to pay off the debt. This transaction is linked to the `installment_payment` via `linked_transaction_id`.

### D. Analytics & Dashboard
*   **Net Cashflow**: Calculated from `transactions` (Income vs Expense). Transfers excluded.
*   **Expense Structure (Pie Chart)**: Aggregates `ABS(amount)` from `transactions` (non-split) UNION `transaction_splits`.
*   **Trend**: Daily aggregation of Income/Expense.

### E. Import/Export
*   **Format**: JSON Dump of all tables keyed by table name.
*   **Restore**:
    *   `PRAGMA foreign_keys = OFF`
    *   Delete all rows from all tables.
    *   Insert rows from JSON.
    *   `PRAGMA foreign_keys = ON`
    *   Reload page.

## 4. Key Services
*   `TransactionService`: CRUD, complicated filtering, balance aggregation.
*   `RecurringService`: Rule management, instance generation engine.
*   `InstallmentService`: Plan management, payment schedule generation, overdue checking.
*   `BudgetService`: Budget setting, comparison of Budget vs Actual (Actual derived from transaction aggregation).
*   `StatisticsService`: Read-only heavy aggregation queries for UI visualization.

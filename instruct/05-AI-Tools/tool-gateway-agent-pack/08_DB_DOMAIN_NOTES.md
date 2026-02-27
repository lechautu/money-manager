# DB & Domain Notes (from features.md)

This gateway must preserve the existing SQLite schema semantics used by the current local-first client.

## Key tables (core)
- accounts, categories, sub_categories
- transactions (supports transfer via to_account_id)
- transaction_splits (for is_split=1)
- budgets
- recurring_rules, recurring_instances
- installment_plans, installment_payments

## Transaction semantics
- `transactions.amount`: negative for expense, positive for income.
- `status`: posted | pending | ignored
- `source`: manual | recurring | installment | transfer
- Transfers:
  - Outgoing leg: account_id has negative amount
  - Incoming effect for to_account_id is `ABS(amount)` for balance computation (per current client logic)

## Analytics semantics
- Net cashflow excludes transfers.
- Expense structure: union of non-split transactions + splits for split transactions.

## Import/Export semantics
- Export: JSON dump keyed by table name.
- Import: overwrite-all flow; must be Tier 2.

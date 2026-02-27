# Implementation Plan & Task Breakdown

## Milestone M0 — Service skeleton
- Project setup (Node.js/Express or Fastify; choose one).
- Config management (env vars).
- Middleware:
  - JSON parsing + request size limits
  - Validation
  - AuthN (Bearer)
  - TraceId propagation (`X-Trace-Id`)
  - Error envelope standardization
- Health endpoints:
  - `GET /healthz`, `GET /readyz`

## Milestone M1 — Core domain (Accounts, Categories, Transactions)
### Accounts
- Implement tools: `get_accounts`, `create_account`, `update_account`, `delete_account`, `get_account_balances`
- Balance rules:
  - Posted balance: sum posted
  - Effective balance: sum posted + pending
  - Transfer handling as in `features.md`

### Categories / Subcategories
- Implement tools: get/create/update/move/delete
- Enforce constraints:
  - unique names in a category
  - cannot delete if referenced (or soft-delete; document decision)

### Transactions
- Implement tools:
  - search/get analytics base queries
  - `record_transaction`, `update_transaction`, `update_transaction_status`
  - `transfer_funds` (must be atomic)
  - `delete_transaction`, `restore_transaction`, `bulk_delete_transactions`, `bulk_restore_transactions`
- Split invariants:
  - if `is_split=1`: validate `sum(splits)=ABS(amount)` (or explicit rule chosen)
  - analytics must read from splits for category breakdown

## Milestone M2 — Budgets + Analytics
- Budgets:
  - set/clone/delete/clear month budgets
- Analytics:
  - dashboard summary, monthly summary, cashflow trend, spending analytics, daily spending, category movers, pending summary, upcoming payments
- Ensure transfers excluded where required.

## Milestone M3 — Recurring + Installments
- Recurring:
  - CRUD rules
  - generate instances (idempotent)
  - trigger instance
- Installments:
  - create plan -> generate schedule
  - check overdue
  - pay installment (linking transfer tx)

## Milestone M4 — Import/Export + hardening
- `export_system_data` (Tier 0)
- `import_system_data` (Tier 2) + approval token mandatory
- Add rate limiting, WAF-friendly headers, improved audit coverage.

## Cross-cutting: DB transactions
- Any multi-step mutation must run in a DB transaction:
  - transfer
  - delete + cascade/soft-delete logic
  - import overwrite

## Cross-cutting: compatibility with MCP
- Keep stable mapping from tool name -> endpoint.
- If you change REST paths to resource-style, update MCP mapping accordingly.

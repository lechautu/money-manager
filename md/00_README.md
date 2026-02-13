# Money Management (MVP1) — Agent Instruction Pack (v3)

## What's new in v3
- Import/Export updated to **SQLite database file**: `.db` / `.sqlite` (NOT JSON).
- Storage recommendation updated to **SQLite WASM (wa-sqlite) + OPFS**.
- Keeps v2 UX: **Inline Category/Sub-category creation inside Transaction modal**.

## Key MVP1 Decisions
- Local-first, offline: **SQLite WASM (wa-sqlite)**.
- Persistence: **OPFS** when available; fallback to in-memory.
- Import/Export: **download/upload `.sqlite`**; Import = **Replace all**.
- Password gate = **UI lock** only (no DB encryption in MVP1).
- Multi-currency totals are shown **per currency** (no conversion in MVP1).
- Transaction statuses: `posted`, `pending`, `ignored` (affect balance rules).
- Timezone for "today" cutoff: **Asia/Ho_Chi_Minh**.
- Recurring generation horizon: **current month + 3 months** (idempotent).

## File Map
- `01_scope_and_acceptance.md`
- `02_routes_screens_ui_contract.md`
- `03_data_model_sql_schema.md`
- `04_domain_services_contract.md`
- `05_recurring_installment_algorithms.md`
- `06_import_export_sqlite_contract.md`
- `07_password_gate_security.md`
- `08_testing_and_qa.md`
- `99_delivery_checklist.md`

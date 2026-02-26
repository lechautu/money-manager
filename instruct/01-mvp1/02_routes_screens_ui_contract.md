# Routes, Screens & UI Contract — MVP1

## Routes (suggested)
- /unlock
- /dashboard
- /accounts, /accounts/[id]
- /transactions
- /installments, /installments/[id]
- /recurring
- /analytics
- /budget
- /forecast
- /settings

## Global UI Requirements
- Navigation: sidebar (desktop) / bottom nav (mobile).
- States: loading, empty, error on every screen.
- Confirm dialogs for delete/import replace.
- Forms: Enter submit, Esc close modal, inline validation errors.

## Transactions — Inline Category/Sub-category Creation (inside Transaction modal)
- Category and Sub-category selectors each has a “+ Add” action.
- Add Category creates a new category (name required, unique) and auto-selects it.
- Add Sub-category creates under current selected category; if none selected, user must select/create first.
- Archived items are not selectable for new transactions; editing existing shows archived as readonly.
- Duplicate/validation/storage failures show inline errors; transaction modal stays open.

## Settings — Import/Export Database (.sqlite/.db)
### Export
- Button “Export database” downloads `money-mgmt.sqlite`.

### Import
- Button “Import database” opens file picker limited to `.sqlite/.db`.
- Pre-check shows filename + optional schema version + optional row counts.
- Confirm “Replace all data” required.
- On success: toast + reload all views.
- On failure: error message; keep current DB unchanged.

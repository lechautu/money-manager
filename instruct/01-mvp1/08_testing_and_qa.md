# Testing & QA — MVP1

## SQLite Import/Export
- Export produces non-empty `.sqlite` file.
- Import valid file replaces data.
- Import invalid integrity fails and keeps old data.
- Import unsupported schema_version fails and keeps old data.

## Inline category creation (Transaction modal)
- Create category -> auto-selected.
- Create sub-category -> auto-selected.
- Duplicate -> inline error.

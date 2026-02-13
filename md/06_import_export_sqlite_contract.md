# Import/Export Contract — MVP1 (SQLite file)

## Export
- Output: single file `money-mgmt.sqlite` (or `.db`).
- Ensure DB is consistent before exporting.
- OPFS: read DB file bytes -> trigger download.
- In-memory fallback: export bytes from sqlite engine.

## Import (Replace All)
- Accept: `.sqlite` / `.db`.
- Pre-check (isolated open):
  - read meta.schema_version
  - (optional) collect row counts
- Validation:
  - schema_version supported
  - `PRAGMA integrity_check;` returns 'ok'
- Replace:
  - close current connection
  - swap underlying DB file (OPFS) or replace in-memory bytes
  - reopen and rehydrate app state

## Failure behavior
- If validation fails: do NOT replace current DB.
- Return error code: SCHEMA_UNSUPPORTED or INTEGRITY_CHECK_FAILED

## UI requirements
- Import shows confirm dialog: “Replace all data”.
- On success: toast + reload.
- On failure: show message + keep existing data.

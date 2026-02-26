# Domain Services Contract — MVP1 (SQLite)

## Error codes
- VALIDATION_ERROR
- NOT_FOUND
- REFERENTIAL_INTEGRITY_VIOLATION
- DUPLICATE_KEY
- STORAGE_ERROR
- SCHEMA_UNSUPPORTED
- INTEGRITY_CHECK_FAILED

## Balance rules
- postedBalance: sum(amount) where status='posted'
- effectiveBalance: sum(amount) where status IN ('posted','pending')

## CategoryService notes (inline create)
- createCategory(name): must return DUPLICATE_KEY if name exists.
- createSubCategory(categoryId, name): DUPLICATE_KEY if (categoryId,name) exists.
- Must be callable from inside Transaction modal; return errors suitable for inline display.

## Import/Export DB
- exportDb(): returns bytes of sqlite database file.
- importDbReplace(bytes):
  - validate schema_version (meta table)
  - run PRAGMA integrity_check
  - replace DB atomically if possible

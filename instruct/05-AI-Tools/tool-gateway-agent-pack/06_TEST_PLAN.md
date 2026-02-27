# Test Plan (DoD-level)

## Unit tests (services)
- Transaction invariants:
  - split sum equals parent amount
  - status transitions (pending->posted) update balances accordingly
  - transfer atomicity: both legs applied or none
- Recurring idempotency:
  - calling generate twice does not create duplicates
- Installment schedule correctness:
  - generated payment count equals tenor
  - overdue transitions based on date
- Budget uniqueness:
  - UNIQUE(month, category_id, sub_category_id) honored; update vs conflict

## Integration tests (DB + HTTP)
- Auth required for all endpoints (except health).
- Ownership enforcement:
  - user A cannot access user B resources
- Tier 2 enforcement:
  - missing approval token -> 403/401
  - invalid token/scope/expired token -> 403
  - valid token -> success

## Contract tests (MCP compatibility)
- For each tool:
  - request schema accepted/rejected as expected
  - response envelope stable

## Load / abuse tests (light)
- Rate limiting triggers for bulk endpoints.
- Large payload import rejected beyond size limit (configurable).

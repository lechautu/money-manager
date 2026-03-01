# Payee PRD + UI Spec (Money Manager)

This package contains:
- `PRD-Payee.md` — Product requirements for Payee (Merchant)
- `UI-Spec-Payee.md` — UI/UX specification (Category-parity, inline add, placements)

These documents assume:
- Payee is stored by **id** similar to Category.
- Payee applies to **primary transactions only** (not split lines).
- Recurring/Installment templates include payee and propagate to generated instances.
- Tool Gateway + MCP server APIs are updated to accept and expose `payee_id`.


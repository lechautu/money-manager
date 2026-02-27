# PRD — Payee (Merchant)

**Feature name:** Payee (Merchant)  
**Status:** Draft (v1)  
**Owners:** Product / Engineering  
**Applies to:** Money Manager (client) + Tool Gateway + MCP Server  

---

## 1. Background & Problem

Users want to understand **who** they spend money on and **who** they receive money from, with questions like:

- “I spent how much with *Shopee* this month?”
- “Total income received from *Company X* this year?”
- “What is my net flow with *Person Y*?”

Today, this information is typically stored as free-text (e.g., note/description), which is inconsistent and not reliable for filtering, aggregation, or automation.

---

## 2. Goals

1. Introduce a **first-class Payee entity** (merchant/person/org) with a stable **ID** (similar to Category).
2. Allow each **primary transaction** to have **0..1 payee**.
3. Support Payee on **Recurring** and **Installment** templates and propagate into generated instances.
4. Enable **filtering** and **aggregation** by payee (expense/income/net) for a given period.
5. Update **Tool Gateway / MCP Server** APIs to support payee CRUD and payee linkage on transaction-like entities.

---

## 3. Non-Goals (Out of Scope for v1)

- Automatic payee inference from notes/bank imports
- Payee rules engine (e.g., “if contains Netflix”)
- Payee icons/logos
- Multiple payees per transaction
- Payee on split lines (splits)
- Payee for transfer transactions (unless explicitly added later)

---

## 4. Scope

### 4.1 Payee assignment
- Each **primary transaction** (not split lines) can reference **0..1 `payee_id`**.
- Existing transactions created before this feature must default to **`payee_id = null`**.
- **Split transactions:** payee is stored on the **parent** transaction only.
- Payee applies to:
  - Income / Expense
  - Recurring templates and their generated instances
  - Installment plans and their generated instances

### 4.2 Payee management
- Payees are managed via CRUD-like operations, with **archive/unarchive** preferred over delete.

### 4.3 API/tooling changes
- Tool Gateway & MCP Server must expose and accept payee data according to updated schemas.

---

## 5. User Stories

### 5.1 Transaction workflows
- As a user, I can select a **payee** when creating or editing an income/expense transaction.
- As a user, I can clear payee (set to none).
- As a user, I can filter the transaction list by a selected payee.

### 5.2 Payee management
- As a user, I can create a new payee.
- As a user, I can rename a payee and see the updated name in all historical transactions.
- As a user, I can archive/unarchive a payee.

### 5.3 Recurring / Installment
- As a user, I can set payee on a recurring template and have future generated transactions inherit it.
- As a user, I can set payee on an installment plan and have future generated transactions inherit it.

---

## 6. Functional Requirements

### 6.1 Payee entity
**Minimum fields**
- `id: string` (uuid or equivalent)
- `name: string` (required)
- `normalized_name: string` (recommended)
- `is_archived: boolean` (default `false`)
- `created_at`, `updated_at`

**Behavior**
- Names are user-defined.
- Duplicate names may exist, but the UI should discourage duplicates via suggestions (see UI Spec).
- Listing defaults to non-archived; optional include-archived.

### 6.2 Payee CRUD
- Create payee (name required)
- Rename payee
- Archive/unarchive payee
- List/search payees

### 6.3 Transaction linkage
- Add optional `payee_id` to primary transaction model.
- Split lines do **not** have payee fields.
- For transfer transactions: payee remains null and not shown (v1).

### 6.4 Recurring templates
- Add optional `payee_id` on recurring template.
- Generated instances copy template’s `payee_id` **at generation time**.
- Editing template payee affects **future generations only**.

### 6.5 Installment plans
- Add optional `payee_id` on installment plan.
- Generated installment transactions copy plan’s `payee_id` **at generation time**.
- Editing plan payee affects **future (uncreated/unpaid) instances only** by default.

### 6.6 Aggregation & filtering
- Provide a payee-level aggregation for a time range:
  - Expense total
  - Income total
  - Net (income + expense)
  - Transaction count
- Filter transaction list by payee.

---

## 7. Data Model & Migration

### 7.1 Tables
**payees**
- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `normalized_name TEXT`
- `is_archived INTEGER NOT NULL DEFAULT 0`
- `created_at TEXT`
- `updated_at TEXT`

**transactions (primary)**
- Add `payee_id TEXT NULL`
- Index: `transactions(payee_id)` recommended

**recurring_templates**
- Add `payee_id TEXT NULL`

**installment_plans**
- Add `payee_id TEXT NULL`

### 7.2 Migration rules
- Add new `payees` table and new `payee_id` columns.
- Backfill all existing rows with `payee_id = NULL`.
- Add relevant indices.
- No inference from notes for v1.

---

## 8. Tool Gateway / MCP Server Requirements

### 8.1 New/Updated API surface (logical)
**Payees**
- `list_payees(query?, include_archived?)`
- `create_payee(name)`
- `update_payee(id, name?)`
- `archive_payee(id, is_archived)`

**Transactions**
- Update `create_transaction` / `update_transaction` schemas:
  - `payee_id?: string | null`

**Recurring / Installment**
- Update create/update schemas:
  - `payee_id?: string | null`

### 8.2 Backward compatibility
- `payee_id` is additive and optional.
- Tool Gateway should accept missing `payee_id` as null.
- MCP tool schema should be updated accordingly (version bump if you enforce strict schema versions).

---

## 9. Edge Cases

- Duplicate payee names: allowed, but the UI should suggest existing matches and prevent accidental duplicates by normalized compare (Category-parity).
- Renaming to an existing name: allowed (optionally warn).
- Archiving an in-use payee: allowed; historical tx still reference it.
- Transaction referencing an archived payee:
  - Must still display payee name in transaction UI.
  - Picker defaults to non-archived but can show archived indicator on selected value.

---

## 10. Acceptance Criteria

### Payee CRUD
1. User can create a payee with a non-empty name.
2. User can rename a payee; historical transactions display new name.
3. User can archive/unarchive a payee.
4. Archived payees do not appear in default pickers, but existing transactions still show them.

### Transactions
5. User can set/clear payee on income/expense transaction.
6. Split transaction stores payee on parent only; UI is consistent.
7. All pre-existing transactions remain valid and show payee as empty.

### Recurring / Installments
8. Recurring template supports payee; generated future transactions inherit it.
9. Installment plan supports payee; generated future transactions inherit it.

### Filtering/Aggregation
10. User can filter transactions by payee.
11. Payee aggregation totals match the filtered transaction list totals for the same period.

### Tool Gateway / MCP Server
12. Tools accept/pay back `payee_id` correctly for transactions, recurring templates, and installment plans.
13. Payee CRUD tools operate correctly and return stable IDs.

---

## 11. QA Checklist

- Migration: existing DB loads without crash; payee field appears empty.
- Create payee → pick it → persists after reload.
- Archive payee → hidden in pickers, still shows on existing tx.
- Recurring generation inherits payee.
- Installment generation inherits payee.
- Aggregation totals reconcile with transaction list sums.

---

## 12. Release Notes (draft)

- Added Payees (Merchants) to track “paid to / received from”.
- Transactions can optionally include a payee.
- Recurring and installment transactions inherit payees from their templates.
- Added filtering and reporting by payee.

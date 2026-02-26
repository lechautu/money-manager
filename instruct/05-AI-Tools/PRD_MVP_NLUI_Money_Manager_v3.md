# PRD: MVP Natural Language UI (NLUI) for Money Manager

## 1) Overview

### Product intent
Enable users to manage personal finances using natural language (international-first), translating chat commands into deterministic app actions via existing tools (manifest) while preserving **local-first data ownership**.

### MVP definition
A chat interface that can **record**, **query**, and **safely delete** transactions using LLM planning + **client-side tool execution**, with **entity resolution** (name → id), **inline numbered disambiguation**, **canonical sign enforcement**, and **confirmation gates** (Tier 2), plus **Undo** for soft-delete.

### Language scope
Language is **not a MVP concern**. The system should work for international users; language understanding is delegated to the OpenAI LLM agent. The product must not hardcode assumptions about a specific user language.

---

## 2) Goals and Non-goals

### Goals
1. Users can issue natural language commands (e.g., “pay 15k coffee from Vietcombank”) and see correct results in the app.
2. Tool execution is **deterministic and safe**:
   - Client validates, resolves, and executes; LLM never directly touches DB.
3. Handle missing IDs via **client entity resolution** and **inline numbered disambiguation**.
4. Enforce **Tier-2 confirmation** for destructive/sensitive actions (e.g., bulk delete, import).
5. Keep LLM payload minimal (privacy + cost).
6. **Explicitly cover required edge cases** listed in §13.

### Non-goals (MVP)
- No cross-session “LLM memory” dependency.
- No server-side DB access or server-side tool execution.
- No complex multi-user collaboration, shared accounts, or cloud sync.
- No advanced budgeting/forecast conversations (can be added later).

---

## 3) Target Users & Use Cases

### Target users
- Users who already track transactions but want faster input and correction without navigating multiple screens.
- Users comfortable typing short commands.

### Primary use cases (MVP)
1. **Record an expense/income** using account name and category keywords.
2. **Query spending summaries** (month, category).
3. **Delete a set of transactions** safely (search → preview → confirm → delete + Undo).

---

## 4) User Stories

### US-1 Record transaction by natural language
**As a user**, I can type “pay 15k coffee from Vietcombank” and the app records an expense transaction to the correct account/category.

**Acceptance criteria**
- If the account name matches exactly one account, the transaction is recorded without additional questions.
- If multiple accounts match, the app asks me to select which one using an **inline numbered reply**.
- If category/subcategory not found, the app proposes valid alternatives or a “create subcategory” flow (optional if available in tools).
- **Canonical sign enforcement**: expense is always recorded as negative, income as positive (see §5.3 and §12).

### US-2 Query monthly spending
**As a user**, I can ask “How much did I spend on food this month?” and get a number and relevant breakdown.

**Acceptance criteria**
- App returns a concise answer and a preview link/navigation to underlying transactions or analytics page (UI hint).
- No destructive action is executed.
- Large analytics outputs are summarized and capped (see §13.F2).

### US-3 Delete transactions safely
**As a user**, I can type “Delete yesterday’s food transactions” and the app shows a preview list, then deletes only after I confirm.

**Acceptance criteria**
- Always performs search first and shows preview (top N items + total count).
- Requires explicit confirmation before deletion.
- After deletion, the app confirms count deleted and provides an **Undo CTA** if soft-delete exists (see §5.6).

---

## 5) Functional Requirements

### 5.1 Client Chat UI
- Chat input supports free-form natural language.
- Renders assistant responses and tool-driven UI hints:
  - preview list (transactions)
  - selection list (disambiguation candidates shown as inline numbered options)
  - confirm dialog (Tier-2)
  - Undo CTA after delete (if soft-delete)
- Must support:
  - parsing inline numbered replies for disambiguation
  - handling “out-of-flow” user replies while selection/confirm is pending (see §13.B3)

### 5.2 Gateway (OpenAI broker)
- Holds OpenAI API key, selects model, and orchestrates tool-calling.
- Loads tool manifest and policy; builds an LLM tool view (filtered by policy).
- Returns either:
  - assistant message, or
  - `tool_calls` JSON for client to execute.
- Handles transient OpenAI errors (retry/backoff) and rate limiting (429).

### 5.3 Client Tool Runtime (Deterministic executor)
For each tool call from gateway:
1. Validate payload (schema + required fields).
2. Enforce policy tier:
   - Tier 0: read-only
   - Tier 1: write/update (non-destructive)
   - Tier 2: destructive/sensitive → must require confirmation
3. Resolve entities:
   - `account_name` → `account_id`
   - `category_name/subcategory_name` → ids
   - handle ambiguous matches with standardized error contract
4. **Canonical sign enforcement for `record_transaction`**:
   - Expense → `amount = -abs(amount)`
   - Income → `amount = +abs(amount)`
   - If intent is unclear → request clarification (see §13.A1)
5. Execute tool locally and return standardized tool result.
6. Enforce idempotency for writes using `request_id` (recommended and required for retry safety; see §13.G2).

### 5.4 Entity Resolution & Disambiguation
- Resolver uses local DB to match names.
- Normalization must handle diacritics and whitespace variations.
- Rules:
  - 1 match → auto-resolve
  - >1 matches → return `NEEDS_DISAMBIGUATION` with ranked candidates
  - 0 match → return `NOT_FOUND` with suggestions (if possible)

### 5.5 Entity Cache (Client-generated)
- Client maintains a lightweight cache/index:
  - normalized name → ids
  - recency/frequency stats to rank candidates
- Must handle cache staleness (rename/delete/import) by validating IDs before execution and refreshing when needed (see §13.B6).

### 5.6 Confirmation Gate (Tier 2) + Undo
- Tier-2 actions must follow:
  1) search
  2) preview
  3) confirm
  4) execute
- Confirmation state is maintained on client (MVP).
- If deletion is soft-delete, after a successful delete batch:
  - show **Undo CTA**
  - Undo restores only the most recent delete batch (client keeps `last_deleted_ids` in session state)
  - Undo is best-effort and reports restored count vs requested count (see §13.E5)

---

## 6) Tooling (MVP tool subset)

The system must integrate with existing app tools (from manifest). MVP should minimally support:

### Read (Tier 0)
- `get_accounts`
- `get_categories`
- `search_transactions`
- `get_monthly_summary` (or `get_spending_analytics`, depending on availability)

### Write (Tier 1)
- `record_transaction`
- `update_transaction_status` (optional)

### Destructive/Sensitive (Tier 2)
- `bulk_delete_transactions`

> The manifest and policy are treated as source-of-truth; the gateway filters exposure based on policy.

---

## 7) Interaction Flows

### Flow A: Record expense (no entity memory)
1. User: “pay 15k coffee from Vietcombank”
2. Gateway calls LLM → receives tool_call intent (may include names, may miss ids)
3. Client runtime resolves `Vietcombank` to `account_id`:
   - unique → proceeds
   - ambiguous → inline numbered disambiguation
4. Client enforces canonical amount sign (expense negative, income positive)
5. Client executes `record_transaction`
6. LLM returns confirmation message

### Flow B: Inline numbered disambiguation
- Runtime returns `NEEDS_DISAMBIGUATION(field, candidates[])`.
- Assistant presents:
  - “Reply with a number”
  - numbered candidates
- Client parses selection from user reply:
  - accepts `1`, `2`, `#1`, `option 2`, and similar numeric selection phrases
- Next turn includes a structured selection payload:
  - `{ field, selected_id }`
- Invalid selection must re-prompt with valid range (see §13.B2).

### Flow C: Delete with Undo
1. User: “delete yesterday food transactions”
2. LLM tool_call: `search_transactions`
3. UI shows preview + asks confirm
4. User confirms
5. Execute `bulk_delete_transactions`
6. Confirm completion + show **Undo CTA**
7. If user clicks Undo → restore `last_deleted_ids` (soft-delete reversal) + confirm restored count

---

## 8) Data Contracts

### Tool calls (Gateway → Client)
- `tool_call_id`, `name`, `arguments`

### Tool results (Client → Gateway)
Standard envelope:
- `ok: boolean`
- `data: object` if ok
- `error: { code, message }` if not ok
- optional: `candidates[]`, `suggestions[]`, `audit_id`

**Required error codes**
- `NEEDS_DISAMBIGUATION`
- `NOT_FOUND`
- `REQUIRES_CONFIRM`
- `VALIDATION_ERROR`

---

## 9) Non-functional Requirements

### Privacy & Minimization
- Do not send full transaction histories to LLM.
- Only send:
  - user utterance
  - minimal context (timezone, today, currency)
  - tool results strictly required (preview lists capped)

### Reliability
- Gateway must handle:
  - OpenAI errors (retry/backoff on transient errors)
  - rate limiting (429)
- Client must handle:
  - invalid tool_call payloads gracefully
  - idempotency via `request_id` for critical operations (required for retry safety)

### Performance targets (MVP)
- P50 command latency (record/query): ~1 LLM round-trip + local execution
- Delete flow: 2-step interaction (search + confirm)

### Security
- API key only in gateway.
- Logging redaction: no raw financial payload in server logs.
- Prompt injection resistance: Tier enforcement and confirm gate must be enforced in client runtime regardless of LLM output.

---

## 10) Success Metrics (MVP)

### Core metrics
- **Task success rate**: % of commands that complete without manual correction
- **Disambiguation rate**: % of commands requiring user selection
- **Average turns per task**: target ≤ 2 for record/query; ≤ 3 for delete
- **User-perceived latency**: time to actionable preview/confirmation

### Guardrail metrics
- Tier-2 accidental execution rate: **0**
- Tool call validation failure rate
- Duplicate write rate on retry: **0** (idempotency)

---

## 11) Rollout Plan

### Phase 1 (MVP)
- Record transaction (expense/income) + account resolution + sign enforcement
- Query monthly summary
- Safe delete (preview + confirm + Undo if soft-delete)
- Required edge-case coverage (see §13)

### Phase 2 (post-MVP)
- Recurring rules creation via NLUI
- Installments via NLUI
- Budget adjustments via NLUI
- Better language understanding (synonyms, richer date parsing)

---

## 12) Decisions & Acceptance Additions

### 12.1 Canonical sign enforcement
**Decision:** If `record_transaction` relies on amount sign, client runtime enforces sign deterministically.

**Acceptance**
- “pay 15k coffee” results in `amount = -15000` regardless of LLM proposal.
- “receive 15k” results in `amount = +15000`.

### 12.2 Disambiguation UI: inline numbered reply
**Decision:** Disambiguation is handled via inline numbered reply.

**Acceptance**
- User can reply with a number to select.
- Invalid selection prompts user to choose a valid number.

### 12.3 Undo CTA for delete (soft-delete)
**Decision:** If soft-delete exists, show an Undo CTA after delete.

**Acceptance**
- Undo restores the most recent delete batch.
- Undo confirms the restored count.

---

## 13) Required Edge Case Coverage

All cases below are **mandatory** to handle in MVP implementation.

### A) NL parsing & intent ambiguity
- **A1** Unclear expense vs income → request clarification (numbered options).
- **A2** Amount parse failure (e.g., “15kk”) → `VALIDATION_ERROR(field=amount)` with format hints.
- **A3** Amount = 0 or extreme outlier → reject or require explicit confirmation (implementation-defined).
- **A4** Currency ambiguity (symbols/foreign currency) → ask user; do not silently convert.
- **A5** Relative dates + timezone boundaries → normalize using `client_context.timezone` and `today`.

### B) Entity resolution (name → id)
- **B1** Ambiguous account/category → `NEEDS_DISAMBIGUATION` with ranked candidates.
- **B2** Invalid numbered selection → re-prompt with valid range; keep pending state.
- **B3** User sends unrelated intent while selection pending → offer continue/cancel or cancel pending (implementation-defined but must not mis-apply selection).
- **B4** Entity not found → `NOT_FOUND` with suggestions (choose existing / create if enabled).
- **B5** Category/subcategory not found → fallback suggestions (use parent / create subcategory if enabled).
- **B6** Cache stale after rename/delete/import → validate IDs before execution; refresh cache slice and re-resolve.
- **B7** diacritics/spacing mismatch → normalization (lowercase, trim, collapse spaces, strip diacritics for matching).

### C) Tool call robustness (LLM outputs)
- **C1** Missing required fields → schema validate, attempt resolve, else `VALIDATION_ERROR`.
- **C2** Param naming mismatch (camelCase/snake_case) → alias mapping layer.
- **C3** Hallucinated IDs → reject unknown IDs; attempt interpret as name if plausible.
- **C4** Tier-2 tool proposed without confirm → block with `REQUIRES_CONFIRM`.
- **C5** Multiple mutating calls in one turn → enforce max-mutate limit or require explicit user intent.

### D) Canonical sign enforcement
- **D1** LLM proposes wrong sign → runtime corrects.
- **D2** User enters negative but intent is income (or vice versa) → intent wins; runtime corrects.
- **D3** If intent uncertain but sign present → must follow a deterministic rule (either ask user or define “sign implies type”); implementation must be consistent.

### E) Delete + Undo (Tier 2 safety)
- **E1** Search returns 0 results → inform user + offer refine.
- **E2** Search returns too many results → preview top N + ask refine.
- **E3** User confirms by mistake → Undo CTA available (soft-delete).
- **E4** Undo after expiry/state loss → inform user; do not partially undo silently.
- **E5** Partial restore failures → report restored_count vs requested_count.
- **E6** Direct delete call without provenance preview → blocked.

### F) Query & analytics
- **F1** Ambiguous time ranges (“this month”, “last week”) → normalize or ask user.
- **F2** Large analytics output → cap tool results and summarize; provide navigation to full view.

### G) Session & reliability
- **G1** Network failure mid-flow → retry supported with `request_id`.
- **G2** Duplicate execution on retry → idempotency required for writes.
- **G3** LLM rate-limited/timeout → gateway backoff; client provides fallback UX.

### H) Security / prompt injection
- **H1** User attempts policy bypass (“delete everything”) → ignored; runtime tier rules always enforced.
- **H2** Data exfiltration attempts (export full data into chat) → minimize payload; treat export/import as sensitive; never dump raw export into conversation.

---

## 14) Implementation Checklist (DoD)
- [ ] Resolver normalization (diacritics + whitespace)
- [ ] `NEEDS_DISAMBIGUATION` protocol + numbered reply parsing
- [ ] Pending selection handling (continue/cancel) without mis-applying actions
- [ ] Canonical sign enforcement before execution
- [ ] Tier-2 confirm + preview provenance required
- [ ] Undo restore for last delete batch (soft-delete) + result reporting
- [ ] Idempotency via `request_id` for writes
- [ ] Param alias mapping + unknown ID validation
- [ ] Limit or gate multiple mutating tool calls per turn

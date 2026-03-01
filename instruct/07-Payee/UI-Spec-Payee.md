# UI Spec — Payee (Merchant)

**Feature name:** Payee (Merchant)  
**Status:** Draft (v1)  
**Design principle:** **Category-parity** for list management + inline add in pickers

---

## 1. Navigation

### Main Menu
- Add menu item **Payees** positioned **adjacent to Categories** in the main menu.
- Visual style and row layout match Categories.

### Route
- `/#/payees` (or equivalent, consistent with existing routing conventions)

---

## 2. Payees Management Screen

### Layout (Category-parity)
- Screen layout mirrors Categories management screen:
  - Header with title and primary action
  - Search (if Categories has search)
  - Flat list of items
- Key difference:
  - **No sub-payees / no hierarchy**

### Header
- Title: **Payees**
- Primary action: **+ Add**

### List
Each row:
- Payee name
- Optional trailing metadata (e.g., usage count) — optional for v1

### Row interactions
- Tap/click row → open edit surface (drawer/dialog) like Categories
- Supported actions:
  - Rename
  - Archive / Unarchive
- Prefer **archive** rather than delete in UI.

### Archived handling (Category-parity)
- If Categories supports an “Archived” section or a “Show archived” toggle, replicate for Payees.
- Default list/picker should show **non-archived** only.

### Empty states
- No payees: show empty state + CTA “Add payee”
- No results: show “No matching payees”

---

## 3. Payee Picker (Dropdown) — Transaction/Recurring/Installment

### Placement
- In **Transaction**, **Installment**, and **Recurring** create/edit forms:
  - Payee dropdown appears **immediately above Category selector**.

### Field properties
- Label: **Payee**
- Optional (nullable)
- Clearable (sets `payee_id = null`)

### Data source
- Default: non-archived payees
- Selected value may be archived (must still render with an archived indicator)

---

## 4. Inline Add (Category-parity)

### Requirement
Payee dropdown supports inline add **exactly like Category**.

### Flow
1. User opens dropdown and types.
2. Dropdown filters existing payees by substring (case-insensitive).
3. If input doesn’t match an existing payee (per normalized compare), show special row:
   - `+ Add "{input}"`
4. User selects the row:
   - Create payee
   - Immediately set `payee_id` to the created payee’s id
   - Close dropdown

### Validation (Category-parity)
- Trim whitespace.
- Disable `+ Add` if trimmed input is empty.
- Duplicate prevention:
  - If normalized input matches an existing payee, do **not** create a new one; select the existing payee instead.

### Keyboard interactions (Category-parity)
- Arrow keys move highlight including the `+ Add` row
- Enter selects highlighted row
- Esc closes dropdown
- Tab confirms selection and exits

---

## 5. Archived Payees in Picker

### Display
If the current value references an archived payee:
- Show payee name in the field
- Add a subtle indicator such as “(Archived)” or muted-chip style

### List
- Archived payees are excluded from default picker list.
- If Categories picker supports “Show archived” inside picker, replicate (optional).

---

## 6. Component Contract (Implementation-facing)

### Payee picker binding
- `value: string | null`  (payee_id)
- `onChange(payeeId: string | null)`
- `onCreatePayee(name: string) -> Promise<{ id: string }>`
- `items: Payee[]` where `Payee = { id, name, is_archived }`

### Normalization (must match Category logic)
- Use the same normalization function used by Category name comparisons (trim, collapse spaces, case-fold; whatever Categories uses).

---

## 7. Screens that must include Payee picker

1. Transaction Create/Edit (Income/Expense)
2. Recurring Template Create/Edit
3. Installment Plan Create/Edit

---

## 8. Acceptance Criteria (UI)

1. Payees menu item is visible next to Categories and navigates to Payees screen.
2. Payees screen mirrors Categories management UI and supports rename + archive/unarchive.
3. Payee dropdown appears above Category selector on Transaction/Recurring/Installment forms.
4. Dropdown supports inline add like Category:
   - `+ Add "{input}"` appears when appropriate
   - Selecting it creates + selects payee
   - Duplicate prevention selects existing payee instead of creating
5. Archived payees do not appear in default picker list but still render if already selected.

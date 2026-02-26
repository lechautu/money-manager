# Scope & Acceptance — MVP1

## MUST-HAVE Features (MVP1)
1. Accounts
   - CRUD accounts: name, type (bank/credit/debit), currency.
   - Balances derived from transactions:
     - postedBalance = sum(amount where status='posted')
     - effectiveBalance = sum(amount where status in ['posted','pending'])
   - Total balance shown per currency (no FX conversion).

2. Transactions
   - CRUD transactions with: date, account, amount, category/subcategory, status, note.
   - Filtering: month, account, status, category, search note.
   - Category selection must be from predefined list (no free-text).
   - UX add-on: user can create Category/Sub-category inline while adding/editing a transaction.

3. Categories/Sub-categories
   - CRUD category + subcategory.
   - Archive supported; archived options hidden from create selectors.
   - Prevent deletion when referenced; suggest archive instead.

4. Installments
   - CRUD plan: totalAmount, tenorMonths, startDate, notifyBeforeDays.
   - Auto-generate payment schedule (monthly).
   - Mark paid: (A) create payment transaction OR (B) link existing transaction.
   - Overdue detection.

5. Recurring Monthly
   - CRUD recurring rules; auto-generate monthly transactions.
   - Idempotent generation (ruleId + month unique).
   - Default status for generated tx = pending (unless configured).

6. Analytics (monthly)
   - Month summary: total income, total expense, net.
   - Breakdown expense by category (table) + pie chart.

7. Budget (monthly)
   - Budget per category per month.
   - Warning when spent (posted+pending expenses) exceeds budget.

8. Forecast
   - Monthly projections (6–12 months view): include future tx + recurring + unpaid installments.
   - Multi-currency separated.

9. Settings
   - Password gate (UI lock): unlock screen, change password.
   - Import/Export DB:
     - Export `.sqlite`.
     - Import `.sqlite/.db`, schema/integrity validation, REPLACE ALL.

## Definition of Done
- Offline works; no backend.
- Import/export `.sqlite` works; invalid import does not replace.
- No duplicate recurring instances.
- Balances consistent across screens.

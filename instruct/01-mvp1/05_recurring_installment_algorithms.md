# Algorithms — Recurring & Installments (MVP1)

Timezone: Asia/Ho_Chi_Minh

## Recurring generation (idempotent)
- Horizon: current month + 3 months.
- Unique(rule_id, month) in recurring_instances.
- Generated transaction date = month + day_of_month (1..28).

## Installment schedule
- amount = round(total/tenor,2) with last payment adjustment.
- Payment links enforce:
  - one payment -> one transaction
  - one transaction -> one payment (linked_transaction_id UNIQUE)

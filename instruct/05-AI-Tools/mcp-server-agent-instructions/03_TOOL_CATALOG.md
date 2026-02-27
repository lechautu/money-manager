# Tool Catalog & Tier Mapping

Manifest contains **58 tools**:
- Tier 0: 23
- Tier 1: 25
- Tier 2: 10

## 1) Tier 0 (read-only)
Annotations:
- `readOnlyHint: true`

Tools:
- `export_system_data`
- `get_account_balances`
- `get_accounts`
- `get_audit_logs`
- `get_budgets`
- `get_cashflow_trend`
- `get_categories`
- `get_category_movers`
- `get_daily_spending`
- `get_dashboard_summary`
- `get_financial_forecast`
- `get_forecast_details`
- `get_installment_plans`
- `get_installment_schedule`
- `get_monthly_summary`
- `get_pending_summary`
- `get_recurring_instances`
- `get_recurring_rules`
- `get_settings`
- `get_spending_analytics`
- `get_upcoming_payments`
- `has_password`
- `search_transactions`

Note:
- `export_system_data` is Tier 0 by manifest but can still be exfiltration-sensitive. Do not auto-skip approvals for it unless explicitly decided.

## 2) Tier 1 (write/update)
Annotations:
- `readOnlyHint: false`
- `destructiveHint: false`
- `openWorldHint: false`

Tools:
- `bulk_restore_transactions`
- `check_overdue_installments`
- `clone_month_budget`
- `create_account`
- `create_category`
- `create_installment_plan`
- `create_recurring_rule`
- `create_subcategory`
- `generate_budgets_from_automation`
- `generate_recurring_instances`
- `move_subcategory`
- `pay_installment`
- `record_transaction`
- `restore_transaction`
- `set_category_budget`
- `set_date_format`
- `set_lock_enabled`
- `transfer_funds`
- `trigger_recurring_instance`
- `update_account`
- `update_category`
- `update_recurring_rule`
- `update_subcategory`
- `update_transaction`
- `update_transaction_status`

## 3) Tier 2 (destructive/sensitive)
Annotations:
- `readOnlyHint: false`
- `destructiveHint: true`
- `openWorldHint: false`

Tools:
- `bulk_delete_transactions`
- `clear_month_budgets`
- `delete_account`
- `delete_budget`
- `delete_category`
- `delete_installment_plan`
- `delete_recurring_rule`
- `delete_subcategory`
- `delete_transaction`
- `import_system_data`

## 4) Schema normalization
If `parameters` is `{}`:
- treat as empty object schema:
  - `type: object`
  - `properties: {}`
  - `additionalProperties: false`

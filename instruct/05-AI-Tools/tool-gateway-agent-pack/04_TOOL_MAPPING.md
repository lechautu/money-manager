# Tool → REST Mapping (Draft)
- Generated: 2026-02-26
- Source: tools_manifest_v1.json (58 tools)
- Note: Path/method are **proposed defaults**. Implementation agent may refactor to resource-based REST paths; ensure MCP mapping updated accordingly.

| Tool | Category | Tier | Method | Path (proposed) | Notes |
|---|---|---:|---|---|---|
| `get_accounts` | Accounts | 0 | GET | `/api/v1/get_accounts` | read-only |
| `create_account` | Accounts | 1 | POST | `/api/v1/create_account` | write |
| `update_account` | Accounts | 1 | POST | `/api/v1/update_account` | write |
| `get_account_balances` | Accounts | 0 | GET | `/api/v1/get_account_balances` | read-only |
| `record_transaction` | Transactions | 1 | POST | `/api/v1/record_transaction` | write |
| `transfer_funds` | Transactions | 1 | POST | `/api/v1/transfer_funds` | write |
| `search_transactions` | Transactions | 0 | GET | `/api/v1/search_transactions` | read-only |
| `bulk_delete_transactions` | Transactions | 2 | POST | `/api/v1/bulk_delete_transactions` | destructive (requires approval token) |
| `update_transaction_status` | Transactions | 1 | POST | `/api/v1/update_transaction_status` | write |
| `create_recurring_rule` | Recurring | 1 | POST | `/api/v1/create_recurring_rule` | write |
| `get_recurring_rules` | Recurring | 0 | GET | `/api/v1/get_recurring_rules` | read-only |
| `trigger_recurring_instance` | Recurring | 1 | POST | `/api/v1/trigger_recurring_instance` | write |
| `create_installment_plan` | Installments | 1 | POST | `/api/v1/create_installment_plan` | write |
| `get_installment_schedule` | Installments | 0 | GET | `/api/v1/get_installment_schedule` | read-only |
| `pay_installment` | Installments | 1 | POST | `/api/v1/pay_installment` | write |
| `get_categories` | Categories | 0 | GET | `/api/v1/get_categories` | read-only |
| `create_category` | Categories | 1 | POST | `/api/v1/create_category` | write |
| `create_subcategory` | Categories | 1 | POST | `/api/v1/create_subcategory` | write |
| `get_budgets` | Budget | 0 | GET | `/api/v1/get_budgets` | read-only |
| `set_category_budget` | Budget | 1 | POST | `/api/v1/set_category_budget` | write |
| `get_spending_analytics` | Analytics | 0 | GET | `/api/v1/get_spending_analytics` | read-only |
| `get_financial_forecast` | Analytics | 0 | GET | `/api/v1/get_financial_forecast` | read-only |
| `get_monthly_summary` | Analytics | 0 | GET | `/api/v1/get_monthly_summary` | read-only |
| `get_audit_logs` | System | 0 | GET | `/api/v1/get_audit_logs` | read-only |
| `export_system_data` | System | 0 | GET | `/api/v1/export_system_data` | read-only |
| `import_system_data` | System | 2 | POST | `/api/v1/import_system_data` | destructive (requires approval token) |
| `update_category` | Categories | 1 | POST | `/api/v1/update_category` | write |
| `update_subcategory` | Categories | 1 | POST | `/api/v1/update_subcategory` | write |
| `move_subcategory` | Categories | 1 | POST | `/api/v1/move_subcategory` | write |
| `delete_category` | Categories | 2 | DELETE | `/api/v1/delete_category` | destructive (requires approval token) |
| `delete_subcategory` | Categories | 2 | DELETE | `/api/v1/delete_subcategory` | destructive (requires approval token) |
| `update_transaction` | Transactions | 1 | POST | `/api/v1/update_transaction` | write |
| `delete_transaction` | Transactions | 2 | DELETE | `/api/v1/delete_transaction` | destructive (requires approval token) |
| `restore_transaction` | Transactions | 1 | POST | `/api/v1/restore_transaction` | write |
| `bulk_restore_transactions` | Transactions | 1 | POST | `/api/v1/bulk_restore_transactions` | write |
| `delete_account` | Accounts | 2 | DELETE | `/api/v1/delete_account` | destructive (requires approval token) |
| `update_recurring_rule` | Recurring | 1 | POST | `/api/v1/update_recurring_rule` | write |
| `delete_recurring_rule` | Recurring | 2 | DELETE | `/api/v1/delete_recurring_rule` | destructive (requires approval token) |
| `get_recurring_instances` | Recurring | 0 | GET | `/api/v1/get_recurring_instances` | read-only |
| `generate_recurring_instances` | Recurring | 1 | POST | `/api/v1/generate_recurring_instances` | write |
| `get_installment_plans` | Installments | 0 | GET | `/api/v1/get_installment_plans` | read-only |
| `delete_installment_plan` | Installments | 2 | DELETE | `/api/v1/delete_installment_plan` | destructive (requires approval token) |
| `check_overdue_installments` | Installments | 1 | POST | `/api/v1/check_overdue_installments` | write |
| `delete_budget` | Budget | 2 | DELETE | `/api/v1/delete_budget` | destructive (requires approval token) |
| `clear_month_budgets` | Budget | 2 | DELETE | `/api/v1/clear_month_budgets` | destructive (requires approval token) |
| `clone_month_budget` | Budget | 1 | POST | `/api/v1/clone_month_budget` | write |
| `generate_budgets_from_automation` | Budget | 1 | POST | `/api/v1/generate_budgets_from_automation` | write |
| `get_dashboard_summary` | Analytics | 0 | GET | `/api/v1/get_dashboard_summary` | read-only |
| `get_cashflow_trend` | Analytics | 0 | GET | `/api/v1/get_cashflow_trend` | read-only |
| `get_daily_spending` | Analytics | 0 | GET | `/api/v1/get_daily_spending` | read-only |
| `get_category_movers` | Analytics | 0 | GET | `/api/v1/get_category_movers` | read-only |
| `get_pending_summary` | Analytics | 0 | GET | `/api/v1/get_pending_summary` | read-only |
| `get_upcoming_payments` | Analytics | 0 | GET | `/api/v1/get_upcoming_payments` | read-only |
| `get_forecast_details` | Analytics | 0 | GET | `/api/v1/get_forecast_details` | read-only |
| `get_settings` | System | 0 | GET | `/api/v1/get_settings` | read-only |
| `set_date_format` | System | 1 | POST | `/api/v1/set_date_format` | write |
| `has_password` | System | 0 | GET | `/api/v1/has_password` | read-only |
| `set_lock_enabled` | System | 1 | POST | `/api/v1/set_lock_enabled` | write |

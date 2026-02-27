# Tools Execution Policy

Tài liệu này quy định chính sách thực thi (Execution Policy) và phân loại Security Tier cho từng tool trong `tools_manifest_v1.json`.

## Phân loại Tier (Security Tiers)

1. **Tier 0 (Read-only)**
   - **Mô tả**: Các tool chỉ thực hiện truy vấn, đọc dữ liệu, không làm thay đổi trạng thái của hệ thống.
   - **Chính sách**: Chạy **không cần confirm** từ user (chạy trực tiếp).
   - **Danh sách tool**:
     - `get_accounts`
     - `get_account_balances`
     - `search_transactions`
     - `get_recurring_rules`
     - `get_recurring_instances`
     - `get_installment_plans`
     - `get_installment_schedule`
     - `get_categories`
     - `get_budgets`
     - `get_spending_analytics`
     - `get_financial_forecast`
     - `get_forecast_details`
     - `get_monthly_summary`
     - `get_dashboard_summary`
     - `get_cashflow_trend`
     - `get_daily_spending`
     - `get_category_movers`
     - `get_pending_summary`
     - `get_upcoming_payments`
     - `get_audit_logs`
     - `export_system_data`
     - `get_settings`
     - `has_password`

2. **Tier 1 (Write/Update)**
   - **Mô tả**: Các tool thực hiện thêm mới, chỉnh sửa trạng thái hệ thống nhưng không phá hủy dữ liệu (non-destructive).
   - **Chính sách**: Chỉ cần **validate** dữ liệu hợp lệ (AI có thể tự quyết định thực hiện nếu tham số chuẩn xác hoặc cơ chế backend tự validate).
   - **Danh sách tool**:
     - `create_account`
     - `update_account`
     - `create_category`
     - `create_subcategory`
     - `update_category`
     - `update_subcategory`
     - `move_subcategory`
     - `record_transaction`
     - `update_transaction`
     - `transfer_funds`
     - `update_transaction_status`
     - `restore_transaction`
     - `bulk_restore_transactions`
     - `create_recurring_rule`
     - `update_recurring_rule`
     - `trigger_recurring_instance`
     - `generate_recurring_instances`
     - `create_installment_plan`
     - `pay_installment`
     - `check_overdue_installments`
     - `set_category_budget`
     - `clone_month_budget`
     - `generate_budgets_from_automation`
     - `set_date_format`
     - `set_lock_enabled`

3. **Tier 2 (Destructive/Sensitive)**
   - **Mô tả**: Các tool có khả năng xóa dữ liệu (ngay cả xóa đơn) hoặc ghi đè toàn bộ dữ liệu hệ thống.
   - **Chính sách**: **Yêu cầu user confirm** rõ ràng trước khi thực hiện.
   - **Danh sách tool**:
     - `delete_account`
     - `delete_category`
     - `delete_subcategory`
     - `delete_transaction`
     - `bulk_delete_transactions`
     - `delete_recurring_rule`
     - `delete_installment_plan`
     - `delete_budget`
     - `clear_month_budgets`
     - `import_system_data`

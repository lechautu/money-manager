# Money Manager 2 — System Architecture Documentation

## 1. Tổng quan hệ thống

Money Manager 2 (MM2) là ứng dụng quản lý tài chính cá nhân được thiết kế theo kiến trúc **4-tier**, bao gồm:

```mermaid
graph LR
    subgraph "Browser"
        Client["Client (React SPA)"]
    end

    subgraph "AI Layer"
        AIGateway["AI Gateway\n:3300"]
    end

    subgraph "Backend Services"
        Gateway["Tool Gateway\n:3200"]
        MCP["MCP Server\n:3100"]
    end

    subgraph "External"
        LLM["LLM Provider\n(OpenAI, etc.)"]
    end

    subgraph "Storage"
        DB["SQLite\n(file-based)"]
    end

    Client -- "REST API\n(JWT Auth)" --> Gateway
    Client -. "REST API\n(/ai/chat)" .-> AIGateway
    AIGateway -- "MCP Protocol\n(JSON-RPC over HTTP)" --> MCP
    AIGateway -- "Chat Completions\n(OpenAI-compatible)" --> LLM
    MCP -- "REST Proxy\n(Bearer Token)" --> Gateway
    Gateway -- "Read/Write" --> DB

    ExtAI["External AI Agent\n(Claude Desktop, etc.)"] -- "MCP Protocol\n(Streamable HTTP)" --> MCP
```

| Component | Tech Stack | Port | Vai trò |
|-----------|-----------|------|---------|
| **Client** | React 19, Vite 7, TailwindCSS 4, TypeScript | `:5173` (dev) | Giao diện người dùng (thin-client SPA) |
| **AI Gateway** | Express 5, OpenAI SDK, TypeScript | `:3300` | LLM Orchestrator — chat API cho Client, điều phối tool call qua MCP |
| **Tool Gateway** | Express 5, sql.js, JWT, TypeScript | `:3200` | REST API, business logic, data layer |
| **MCP Server** | `@modelcontextprotocol/sdk`, Express 5, TypeScript | `:3100` | Cung cấp giao diện MCP cho AI Gateway và external AI agents |

---

## 2. Client (React SPA)

### 2.1 Công nghệ

- **Framework**: React 19 + Vite 7
- **Styling**: TailwindCSS 4, `clsx`, `tailwind-merge`
- **Routing**: React Router DOM 7
- **Charts**: Recharts 3
- **Icons**: Lucide React
- **Date**: date-fns 4, react-day-picker 9
> [!NOTE]
> Kể từ bản cập nhật 2026-02-28, Client **không còn** chứa database in-browser. Mọi read/write đều thông qua Tool Gateway.

### 2.2 Cấu trúc thư mục

```
src/
├── api/
│   └── gateway.ts           # GatewayClient — HTTP client gọi Tool Gateway
├── components/
│   ├── Layout.tsx            # AppLayout (sidebar + main content + ChatFAB/ChatPanel)
│   ├── accounts/             # AccountList, AccountForm
│   ├── ai-chat/              # ★ AI Chat Panel overlay
│   │   ├── ChatFAB.tsx       #   Floating action button (Sparkles icon)
│   │   ├── ChatPanel.tsx     #   Chat panel overlay (message list, input, controls)
│   │   ├── ChatMessage.tsx   #   Individual message bubble (user/assistant/system)
│   │   ├── ConfirmationCard.tsx # Tier 2 confirmation card (approve/reject)
│   │   └── WaitingIndicator.tsx # Animated waiting dots
│   ├── auth/                 # AuthLock (password lock screen)
│   ├── budget/               # Budget components
│   ├── common/               # Toast, UndoProvider, DateProvider, MonthPicker, ConfirmDialog
│   ├── dashboard/            # SummaryCards (NetCashflow, PendingSummary w/ CTA, BudgetStatus), charts
│   ├── installments/         # InstallmentForm
│   ├── recurring/            # RecurringForm
│   ├── settings/             # Data management, password, display settings
│   ├── transactions/         # TransactionList, TransactionForm, CategoryPicker
│   └── ui/                   # Reusable UI components
├── pages/                    # 14 page components
│   ├── DashboardPage.tsx     # Trang chủ — thống kê tổng quan
│   ├── AccountsPage.tsx      # Quản lý tài khoản
│   ├── TransactionsPage.tsx  # Danh sách giao dịch
│   ├── CategoryPage.tsx      # Quản lý danh mục
│   ├── RecurringPage.tsx     # Giao dịch định kỳ
│   ├── InstallmentPage.tsx   # Trả góp
│   ├── AnalyticsPage.tsx     # Phân tích chi tiêu
│   ├── BudgetPage.tsx        # Ngân sách
│   ├── ForecastPage.tsx      # Dự báo tài chính
│   ├── ForecastDetailPage.tsx # Chi tiết dự báo theo tháng
│   ├── PayeePage.tsx         # Quản lý người nhận/người trả
│   ├── TrendsPage.tsx        # Xu hướng và so sánh
│   ├── AuditLogPage.tsx      # Nhật ký hoạt động
│   └── SettingsPage.tsx      # Cài đặt
├── services/
│   ├── ToolExecutionService.ts  # ★ Core: Gateway-only tool dispatcher
│   ├── AIChatService.ts         # ★ AI Gateway HTTP client (/ai-api → AI Gateway)
│   ├── AIChatStore.ts           # ★ Chat state management (useSyncExternalStore)
│   ├── AccountService.ts        # Proxy → ToolExecutionService
│   ├── TransactionService.ts    # Proxy → ToolExecutionService
│   ├── CategoryService.ts       # Proxy → ToolExecutionService
│   ├── BudgetService.ts         # Proxy → ToolExecutionService
│   ├── RecurringService.ts      # Proxy → ToolExecutionService
│   ├── InstallmentService.ts    # Proxy → ToolExecutionService
│   ├── StatisticsService.ts     # Proxy → ToolExecutionService
│   ├── ForecastService.ts       # Proxy → ToolExecutionService
│   ├── SettingsService.ts       # Proxy → ToolExecutionService
│   ├── AuditService.ts          # Proxy → ToolExecutionService
│   ├── PayeeService.ts          # Proxy → ToolExecutionService
│   ├── BackupService.ts         # Backup/restore logic
│   └── ImportExportService.ts   # Import/export JSON
├── types/
│   └── aiChat.ts                # TypeScript types (ChatEntity, AIChatState, API types)
└── utils/
    └── ...
```

### 2.3 Kiến trúc Gateway-Only (Thin Client)

Client hoạt động hoàn toàn như **thin client** — không chứa database hay business logic xử lý dữ liệu. Mọi thao tác đều đi qua `ToolExecutionService` → `GatewayClient` → Tool Gateway.

```mermaid
flowchart TD
    Page["Page Component"] --> Service["Domain Service\n(e.g., TransactionService)"]
    Service --> TES["ToolExecutionService.executeTool()"]
    TES --> GC["GatewayClient.callTool()"]
    GC -->|"REST API\n(JWT Auth)"| GW["Tool Gateway :3200"]
    GW --> DB["SQLite (file-based)"]
```

- Tất cả tool calls đều proxy qua `GatewayClient.callTool()` đến Tool Gateway
- Config lưu trong `localStorage` (optional overrides):
  - `mm2_gateway_url`: URL của gateway (default `http://localhost:3200`)
  - `mm2_gateway_token`: JWT token (có fallback token mặc định cho dev)
- Token hết hạn sẽ tự động bị xóa khỏi localStorage, fallback về token mặc định
- **Vite Proxy**: Client gọi AI Gateway qua path `/ai-api/*`, Vite dev server proxy sang `http://localhost:3300/ai/*` (xem `vite.config.ts`)

> [!IMPORTANT]
> Local mode (in-browser SQLite) đã bị loại bỏ hoàn toàn kể từ commit `52fefc7` (2026-02-28). Thư mục `src/db/` và `src/services/local/` là legacy code, không còn được import hay sử dụng.

### 2.4 Routing

| Path | Page | Mô tả |
|------|------|-------|
| `/` | → `/dashboard` | Redirect |
| `/dashboard` | `DashboardPage` | Thống kê tổng quan, biểu đồ |
| `/accounts` | `AccountsPage` | CRUD tài khoản |
| `/transactions` | `TransactionsPage` | Danh sách giao dịch (hỗ trợ `?status=pending` query param) |
| `/categories` | `CategoryPage` | Danh mục / danh mục con |
| `/recurring` | `RecurringPage` | Quy tắc định kỳ |
| `/installments` | `InstallmentPage` | Kế hoạch trả góp |
| `/analytics` | `AnalyticsPage` | Phân tích chi tiêu |
| `/budget` | `BudgetPage` | Ngân sách theo tháng |
| `/forecast` | `ForecastPage` | Dự báo tài chính |
| `/forecast/:month` | `ForecastDetailPage` | Chi tiết tháng |
| `/payees` | `PayeePage` | Quản lý người nhận/người trả |
| `/settings` | `SettingsPage` | Cài đặt hệ thống |
| `/audit-logs` | `AuditLogPage` | Nhật ký kiểm tra |

### 2.5 Provider Hierarchy

```
BrowserRouter
  └── AuthLock             # Màn hình khoá / mật khẩu
      └── ToastProvider    # Thông báo toast
          └── DateProvider  # Context tháng/năm hiện tại
              └── UndoProvider  # Undo giao dịch
                  └── Routes
                      └── AppLayout (sidebar + content)
```

---

## 3. Tool Gateway (REST API)

### 3.1 Công nghệ

- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: sql.js (SQLite file-based)
- **Auth**: JWT (`jsonwebtoken`)
- **Validation**: Zod

### 3.2 Cấu trúc thư mục

```
tool-gateway/
├── src/
│   ├── server.ts              # Entry point, Express app setup
│   ├── db/
│   │   ├── client.ts          # sql.js wrapper (init, all, get, run, exec, transaction, saveDatabase)
│   │   └── schema.sql         # DDL schema (11 tables)
│   ├── middleware/
│   │   ├── auth.ts            # JWT authentication middleware
│   │   ├── audit.ts           # Audit logging middleware (ghi log mọi thao tác Tier 1+)
│   │   └── approval.ts        # Tier 2 approval guard (X-MM-Approval-Token)
│   ├── routes/
│   │   ├── accounts.ts        # Account CRUD
│   │   ├── categories.ts      # Category + SubCategory CRUD
│   │   ├── transactions.ts    # Transaction CRUD + bulk ops
│   │   ├── budgets.ts         # Budget CRUD
│   │   ├── analytics.ts       # Statistics & analytics queries
│   │   ├── recurring.ts       # Recurring rules + instance generation
│   │   ├── installments.ts    # Installment plans + payments
│   │   ├── payees.ts          # Payee CRUD
│   │   └── system.ts          # Settings, audit logs, import/export
│   └── services/
│       ├── AccountService.ts
│       ├── TransactionService.ts
│       ├── CategoryService.ts
│       ├── BudgetService.ts
│       ├── RecurringService.ts
│       ├── InstallmentService.ts
│       ├── PayeeService.ts
│       └── StatisticsService.ts
├── data/
│   └── mm2.db                 # SQLite database file
└── .env
```

### 3.3 Middleware Pipeline

```mermaid
flowchart LR
    Req["HTTP Request"] --> CORS
    CORS --> JSON["express.json()"]
    JSON --> Trace["TraceId\n(x-trace-id)"]
    Trace --> Auth["JWT Auth\n(/api/*)"]
    Auth --> Route["Route Handler"]

    Route -->|Tier 1| Audit["auditLog()"] --> Handler["Business Logic"]
    Route -->|Tier 2| Approval["approvalGuard()"] --> Audit2["auditLog()"] --> Handler2["Business Logic"]
```

#### Authentication ([auth.ts](file:///d:/Projects/mm2/tool-gateway/src/middleware/auth.ts))
- Validates `Authorization: Bearer <JWT>` header
- Decodes JWT using `JWT_SECRET` environment variable
- Attaches `req.user = { userId }` for downstream use

#### Audit Logging ([audit.ts](file:///d:/Projects/mm2/tool-gateway/src/middleware/audit.ts))
- Factory function [auditLog(toolName, tier, resourceType)](file:///d:/Projects/mm2/tool-gateway/src/middleware/audit.ts#5-48) tạo middleware
- Intercepts `res.json()` để ghi log *sau* khi response đã chuẩn bị
- Ghi vào bảng `audit_logs` với: trace_id, user, tool_name, tier, resource_type, result, error_code

#### Approval Guard ([approval.ts](file:///d:/Projects/mm2/tool-gateway/src/middleware/approval.ts))
- Dùng cho endpoints **Tier 2** (destructive operations)
- **Pass-through**: Kể từ bản cập nhật 2026-03-03, approval guard luôn gọi `next()` — không còn chặn request
- Xác nhận thao tác nhạy cảm được xử lý **qua chat**: AI hỏi user "Bạn có chắc chắn?" trước khi gọi tool
- Audit logging vẫn hoạt động bình thường cho mọi Tier 2 action

### 3.4 API Endpoints

Tất cả endpoints nằm dưới prefix `/api/v1/`. Tool name = endpoint path.

#### Accounts
| Method | Endpoint | Tool Name | Tier | Mô tả |
|--------|----------|-----------|------|-------|
| GET | `/get_accounts` | `get_accounts` | 0 | Lấy danh sách tài khoản |
| GET | `/get_account_balances` | `get_account_balances` | 0 | Số dư tài khoản |
| POST | `/create_account` | `create_account` | 1 | Tạo tài khoản |
| POST | `/update_account` | `update_account` | 1 | Cập nhật tài khoản |
| DELETE | `/delete_account` | `delete_account` | 2 | Xóa tài khoản |

#### Categories
| Method | Endpoint | Tool Name | Tier | Mô tả |
|--------|----------|-----------|------|-------|
| GET | `/get_categories` | `get_categories` | 0 | Lấy danh mục + danh mục con |
| POST | `/create_category` | `create_category` | 1 | Tạo danh mục |
| POST | `/create_subcategory` | `create_subcategory` | 1 | Tạo danh mục con |
| POST | `/update_category` | `update_category` | 1 | Đổi tên danh mục |
| POST | `/update_subcategory` | `update_subcategory` | 1 | Đổi tên danh mục con |
| POST | `/move_subcategory` | `move_subcategory` | 1 | Di chuyển danh mục con |
| DELETE | `/delete_category` | `delete_category` | 2 | Xóa danh mục |
| DELETE | `/delete_subcategory` | `delete_subcategory` | 2 | Xóa danh mục con |

#### Transactions
| Method | Endpoint | Tool Name | Tier | Mô tả |
|--------|----------|-----------|------|-------|
| GET | `/search_transactions` | `search_transactions` | 0 | Tìm kiếm giao dịch (filter) |
| POST | `/record_transaction` | `record_transaction` | 1 | Tạo giao dịch |
| POST | `/update_transaction` | `update_transaction` | 1 | Cập nhật giao dịch |
| POST | `/update_transaction_status` | `update_transaction_status` | 1 | Đổi trạng thái |
| POST | `/transfer_funds` | `transfer_funds` | 1 | Chuyển khoản |
| POST | `/restore_transaction` | `restore_transaction` | 1 | Khôi phục giao dịch đã xóa |
| POST | `/bulk_restore_transactions` | `bulk_restore_transactions` | 1 | Khôi phục hàng loạt |
| DELETE | `/delete_transaction` | `delete_transaction` | 2 | Xóa mềm (soft delete) |
| POST | `/bulk_delete_transactions` | `bulk_delete_transactions` | 2 | Xóa hàng loạt |

#### Budgets
| Method | Endpoint | Tool Name | Tier | Mô tả |
|--------|----------|-----------|------|-------|
| GET | `/get_budgets` | `get_budgets` | 0 | Ngân sách theo tháng |
| GET | `/get_monthly_summary` | `get_monthly_summary` | 0 | Tóm tắt tháng |
| POST | `/set_category_budget` | `set_category_budget` | 1 | Đặt ngân sách cho danh mục |
| POST | `/clone_month_budget` | `clone_month_budget` | 1 | Clone ngân sách sang tháng khác |
| POST | `/generate_budgets_from_automation` | `generate_budgets_from_automation` | 1 | Tạo tự động từ recurring/installments |
| DELETE | `/delete_budget` | `delete_budget` | 2 | Xóa ngân sách |
| DELETE | `/clear_month_budgets` | `clear_month_budgets` | 2 | Xóa toàn bộ ngân sách tháng |

#### Analytics
| Method | Endpoint | Tool Name | Tier | Mô tả |
|--------|----------|-----------|------|-------|
| GET | `/get_dashboard_summary` | `get_dashboard_summary` | 0 | Tổng quan dashboard |
| GET | `/get_spending_analytics` | `get_spending_analytics` | 0 | Chi tiêu theo danh mục |
| GET | `/get_cashflow_trend` | `get_cashflow_trend` | 0 | Xu hướng dòng tiền |
| GET | `/get_daily_spending` | `get_daily_spending` | 0 | Chi tiêu hàng ngày |
| GET | `/get_category_movers` | `get_category_movers` | 0 | So sánh danh mục |
| GET | `/get_pending_summary` | `get_pending_summary` | 0 | Tóm tắt giao dịch pending |
| GET | `/get_upcoming_payments` | `get_upcoming_payments` | 0 | Thanh toán sắp tới |

#### Recurring
| Method | Endpoint | Tool Name | Tier | Mô tả |
|--------|----------|-----------|------|-------|
| GET | `/get_recurring_rules` | `get_recurring_rules` | 0 | Danh sách quy tắc |
| GET | `/get_recurring_instances` | `get_recurring_instances` | 0 | Danh sách instances |
| POST | `/create_recurring_rule` | `create_recurring_rule` | 1 | Tạo quy tắc |
| POST | `/update_recurring_rule` | `update_recurring_rule` | 1 | Cập nhật quy tắc |
| POST | `/trigger_recurring_instance` | `trigger_recurring_instance` | 1 | Trigger thủ công |
| POST | `/generate_recurring_instances` | `generate_recurring_instances` | 1 | Tạo instances tự động |
| POST | `/link_recurring_transaction` | `link_recurring_transaction` | 1 | Liên kết giao dịch thủ công |
| DELETE | `/delete_recurring_rule` | `delete_recurring_rule` | 2 | Xóa quy tắc |

#### Installments
| Method | Endpoint | Tool Name | Tier | Mô tả |
|--------|----------|-----------|------|-------|
| GET | `/get_installment_plans` | `get_installment_plans` | 0 | Danh sách kế hoạch |
| GET | `/get_installment_schedule` | `get_installment_schedule` | 0 | Lịch thanh toán |
| GET | `/get_pending_installment_count` | `get_pending_installment_count` | 0 | Số kỳ chờ thanh toán |
| POST | `/create_installment_plan` | `create_installment_plan` | 1 | Tạo kế hoạch trả góp |
| POST | `/update_installment_plan` | `update_installment_plan` | 1 | Cập nhật kế hoạch (tên, auto_add, default_status) |
| POST | `/pay_installment` | `pay_installment` | 1 | Đánh dấu đã thanh toán |
| POST | `/check_overdue_installments` | `check_overdue_installments` | 1 | Kiểm tra quá hạn + auto-add |
| POST | `/link_installment_transaction` | `link_installment_transaction` | 1 | Liên kết giao dịch thủ công |
| DELETE | `/delete_installment_plan` | `delete_installment_plan` | 2 | Xóa kế hoạch |

#### Payees
| Method | Endpoint | Tool Name | Tier | Mô tả |
|--------|----------|-----------|------|-------|
| GET | `/get_payees` | `get_payees` | 0 | Danh sách người nhận/trả |
| POST | `/create_payee` | `create_payee` | 1 | Tạo payee |
| POST | `/update_payee` | `update_payee` | 1 | Cập nhật payee |
| POST | `/archive_payee` | `archive_payee` | 1 | Ẩn/hiện payee |

#### System
| Method | Endpoint | Tool Name | Tier | Mô tả |
|--------|----------|-----------|------|-------|
| GET | `/get_settings` | `get_settings` | 0 | Lấy cài đặt |
| GET | `/has_password` | `has_password` | 0 | Kiểm tra mật khẩu |
| GET | `/get_audit_logs` | `get_audit_logs` | 0 | Nhật ký |
| GET | `/get_financial_forecast` | `get_financial_forecast` | 0 | Dự báo tài chính |
| GET | `/get_forecast_details` | `get_forecast_details` | 0 | Chi tiết dự báo |
| POST | `/set_date_format` | `set_date_format` | 1 | Đặt định dạng ngày |
| POST | `/set_lock_enabled` | `set_lock_enabled` | 1 | Bật/tắt khoá |
| POST | `/set_password` | `set_password` | 2 | Đặt mật khẩu |
| POST | `/verify_password` | `verify_password` | 0 | Xác thực mật khẩu |
| POST | `/export_system_data` | `export_system_data` | 1 | Xuất dữ liệu |
| POST | `/import_system_data` | `import_system_data` | 2 | Nhập dữ liệu |

### 3.5 Database Client ([db/client.ts](file:///d:/Projects/mm2/src/db/client.ts))

Wrapper cho sql.js cung cấp các helper:

| Function | Mô tả |
|----------|-------|
| [initDatabase()](file:///d:/Projects/mm2/tool-gateway/src/db/client.ts#12-63) | Khởi tạo DB: load file nếu tồn tại, chạy schema, chạy migrations |
| `all<T>(sql, params)` | SELECT → mảng rows |
| `get<T>(sql, params)` | SELECT → row đầu tiên hoặc undefined |
| [run(sql, params)](file:///d:/Projects/mm2/tool-gateway/src/db/client.ts#90-95) | INSERT/UPDATE/DELETE, auto-save nếu ngoài transaction |
| [exec(sql)](file:///d:/Projects/mm2/tool-gateway/src/db/client.ts#96-101) | Multi-statement SQL, auto-save |
| `transaction<T>(fn)` | BEGIN/COMMIT/ROLLBACK wrapper, save sau COMMIT |
| [saveDatabase()](file:///d:/Projects/mm2/tool-gateway/src/db/client.ts#64-69) | Export & ghi file `.db` ra disk |

> [!IMPORTANT]
> Mỗi lệnh [run()](file:///d:/Projects/mm2/tool-gateway/src/db/client.ts#90-95)/[exec()](file:///d:/Projects/mm2/tool-gateway/src/db/client.ts#96-101) ngoài transaction sẽ tự động gọi [saveDatabase()](file:///d:/Projects/mm2/tool-gateway/src/db/client.ts#64-69) để persist dữ liệu ra file. Trong transaction, chỉ save sau COMMIT.

### 3.6 Environment Variables

| Variable | Default | Mô tả |
|----------|---------|-------|
| `PORT` | `3200` | Cổng HTTP |
| `JWT_SECRET` | — | Secret cho JWT authentication |
| `APPROVAL_TOKEN_SECRET` | — | Secret cho approval tokens (Tier 2) |
| `DB_PATH` | `./data/mm2.db` | Đường dẫn file SQLite |
| `LOG_LEVEL` | `info` | Mức log |
| `REQUEST_SIZE_LIMIT` | `5mb` | Giới hạn body size |

---

## 4. AI Gateway (LLM Orchestrator)

### 4.1 Công nghệ

- **Runtime**: Node.js
- **Framework**: Express 5
- **LLM SDK**: OpenAI SDK (tương thích mọi provider OpenAI-compatible)
- **MCP Client**: HTTP JSON-RPC trực tiếp (không dùng SDK transport)

### 4.2 Cấu trúc thư mục

```
ai-gateway/
├── src/
│   ├── server.ts              # Entry point, Express app, Origin Guard
│   ├── orchestrator.ts        # ★ Core: LLM loop (prompt → tool calls → MCP → result)
│   ├── mcpClient.ts           # MCP JSON-RPC client (init → tools/list → tools/call)
│   ├── llmProvider.ts         # OpenAI SDK wrapper + MCP→OpenAI schema conversion
│   ├── sessionStore.ts        # Session CRUD + JSON file persistence + TTL
│   ├── approvalManager.ts     # Approval token create/validate (Tier 2)
│   ├── routes.ts              # /ai/chat, /ai/approve, /ai/session/:id
│   └── logger.ts              # Structured JSON logging with redaction
├── data/
│   └── sessions.json          # Session persistence
└── .env
```

### 4.3 Kiến trúc — MCP-First Orchestration

AI Gateway tuân thủ nguyên tắc **MCP-First**: mọi tool execution đều đi qua MCP Server, không bao giờ gọi trực tiếp Tool Gateway.

```mermaid
sequenceDiagram
    participant User as Client
    participant AG as AI Gateway
    participant LLM as OpenAI (LLM)
    participant MCP as MCP Server
    participant TG as Tool Gateway

    User->>AG: POST /ai/chat {message}
    AG->>AG: Load session + build system prompt
    AG->>LLM: Chat Completion (messages + 69 tools)
    LLM-->>AG: "Call get_accounts()"
    AG->>MCP: tools/call {name: "get_accounts"}
    MCP->>TG: GET /api/v1/get_accounts
    TG-->>MCP: {data: [...]}
    MCP-->>AG: {content: [{type: "text", text: "[...]"}]}
    AG->>LLM: Tool result → Continue
    LLM-->>AG: "Bạn có 3 tài khoản..."
    AG-->>User: {assistantMessage: "Bạn có 3 tài khoản..."}
```

> [!IMPORTANT]
> OpenAI **không hề biết** MCP Server tồn tại. AI Gateway gửi danh sách 69 tool definitions (chuyển từ MCP schema sang OpenAI function format) trong mỗi request. Khi OpenAI quyết định gọi tool, AI Gateway nhận yêu cầu đó và thực hiện qua MCP.

### 4.4 Core Modules

#### Orchestrator ([orchestrator.ts](file:///d:/Projects/mm2/ai-gateway/src/orchestrator.ts))
- **Vòng lặp chính**: System prompt → User message → LLM → Tool calls → MCP execute → LLM → ... → Final text
- **Conversational Tier 2 confirmation**: System prompt yêu cầu AI phải hỏi xác nhận trước khi gọi destructive tools. AI tự quản lý luồng xác nhận qua chat (không còn dùng approval tokens để chặn tool calls)
- **History sanitization**: `sanitizeHistory()` sửa các lượt tool call bị gián đoạn (missing tool responses) trong message history
- **Budget enforcement**: max `MAX_TOOL_CALLS_PER_TURN` (8) tool calls, max `MAX_TURN_WALL_TIME_MS` (25s) wall time
- **State management**: Session states: `IDLE` → `TOOL_CALLING` → `DONE`

#### MCP Client ([mcpClient.ts](file:///d:/Projects/mm2/ai-gateway/src/mcpClient.ts))
- HTTP JSON-RPC trực tiếp đến MCP Server (`POST /mcp`)
- 3-step handshake: `initialize` → `notifications/initialized` → `tools/list`
- SSE response parsing cho JSON-RPC over Streamable HTTP
- Capture `mcp-session-id` header để duy trì session

#### LLM Provider ([llmProvider.ts](file:///d:/Projects/mm2/ai-gateway/src/llmProvider.ts))
- Wrapper cho OpenAI SDK, provider-agnostic (hỗ trợ bất kỳ OpenAI-compatible API)
- Chuyển đổi MCP tool schema → OpenAI function format
- Retry logic với exponential backoff

#### Approval Manager ([approvalManager.ts](file:///d:/Projects/mm2/ai-gateway/src/approvalManager.ts))
- Vẫn tồn tại cho tương thích ngược (endpoint `/ai/approve` vẫn hoạt động)
- Tạo opaque approval token (SHA-256 hash của tool name + args)
- TTL enforcement (default 5 phút)
- Single-use: token bị xóa sau khi validate thành công

### 4.5 API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/ai/chat` | Chat: gửi tin nhắn, nhận phản hồi AI (có thể kèm tool calls) |
| POST | `/ai/approve` | Xác nhận thao tác Tier 2 bằng approval token (legacy, vẫn hoạt động) |
| GET | `/ai/session/:id` | Debug: xem trạng thái session |
| DELETE | `/ai/session/:id` | Xóa session / xóa lịch sử chat |
| GET | `/healthz` | Health check (kèm trạng thái MCP connection) |
| GET | `/version` | Version info |

### 4.6 Session Management

- JSON file persistence (`data/sessions.json`)
- TTL: 7 ngày (configurable)
- Conversation trimming: giữ tối đa 40 messages gần nhất
- States: `IDLE`, `TOOL_CALLING`, `DONE`
- Client-side persistence: `AIChatStore` lưu state vào `localStorage` (key `ai-chat-state`)

### 4.7 Security

- **Loopback binding**: chỉ lắng nghe trên `127.0.0.1`
- **Origin Guard**: validate `Origin` header cho mọi request state-changing (`POST/PUT/PATCH/DELETE`)
- **MCP Auth**: gửi `Authorization: Bearer <MCP_BEARER>` + `x-user-id: ai-gateway` khi gọi MCP Server

### 4.8 Environment Variables

| Variable | Default | Mô tả |
|----------|---------|-------|
| `PORT` | `3300` | Cổng HTTP |
| `AI_GATEWAY_HOST` | `127.0.0.1` | Bind address |
| `LLM_API_KEY` | — | API Key cho LLM provider |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Base URL LLM (đổi để dùng provider khác) |
| `LLM_MODEL` | `gpt-4o` | Model name |
| `MCP_SERVER_URL` | `http://localhost:3100` | URL MCP Server |
| `MCP_BEARER` | — | Bearer token cho MCP auth |
| `TRUSTED_ORIGINS` | `http://localhost:5173,...` | Origins được phép gọi API |
| `SESSION_TTL_MS` | `604800000` | TTL session (7 ngày) |
| `APPROVAL_TOKEN_TTL_MS` | `300000` | TTL approval token (5 phút) |
| `MAX_TOOL_CALLS_PER_TURN` | `8` | Giới hạn tool calls mỗi lượt |
| `MAX_TURN_WALL_TIME_MS` | `25000` | Giới hạn thời gian mỗi lượt |

---

## 5. MCP Server

### 5.1 Công nghệ

- **MCP SDK**: `@modelcontextprotocol/sdk` 1.12
- **Transport**: Streamable HTTP (SSE cho server → client)
- **Framework**: Express 5
- **Schema**: Zod (dynamic schema generation từ manifest)

### 5.2 Cấu trúc thư mục

```
mcp-server/
├── src/
│   ├── server.ts              # Entry point: MCP server + Express app
│   ├── toolRegistry.ts        # Load & validate tools_manifest_v1.json
│   ├── proxy.ts               # executeToolViaGateway() — proxy HTTP calls
│   ├── security.ts            # Auth + Identity + Approval guard middleware
│   └── logger.ts              # Structured JSON logging with redaction
├── tools_manifest_v1.json     # ★ Tool definitions (47KB, 69 tools)
└── .env
```

### 5.3 Kiến trúc

```mermaid
flowchart TD
    AI["AI Gateway / External Agent"] -->|"MCP Protocol\n(POST /mcp)"| Transport["StreamableHTTPServerTransport"]
    Transport --> McpServer["McpServer\n(per-session instance)"]
    McpServer --> ToolHandler["Tool Handler\n(per-tool callback)"]
    ToolHandler --> Proxy["executeToolViaGateway()"]
    Proxy -->|"HTTP REST\n(method auto-detect)"| GW["Tool Gateway :3200"]
    GW --> Response["JSON Response"]
    Response --> Proxy
    Proxy --> Content["MCP Content\n(text/json)"]
```

> [!NOTE]
> MCP Server sử dụng factory pattern (`createMcpServerInstance()`) để tạo một `McpServer` instance riêng cho mỗi session, cho phép nhiều client (AI Gateway + Claude Desktop) kết nối đồng thời.

### 5.4 Tool Registry ([toolRegistry.ts](file:///d:/Projects/mm2/mcp-server/src/toolRegistry.ts))

Đọc file [tools_manifest_v1.json](file:///d:/Projects/mm2/mcp-server/tools_manifest_v1.json) và:
1. **Validate** tên tool duy nhất, tier hợp lệ (0/1/2), parameters hợp lệ
2. **Normalize** schema (thêm `type: 'object'` nếu thiếu)
3. **Derive annotations** theo tier:
   - Tier 0: `readOnlyHint: true`
   - Tier 1: `destructiveHint: false`
   - Tier 2: `destructiveHint: true`

### 5.5 Proxy ([proxy.ts](file:///d:/Projects/mm2/mcp-server/src/proxy.ts))

[executeToolViaGateway(toolName, args, context)](file:///d:/Projects/mm2/mcp-server/src/proxy.ts#14-129):
- Tự động xác định HTTP method:
  - `get_*`, `search_*`, `has_password` → **GET** (params chuyển thành query string)
  - `delete_*`, `clear_*` (danh sách cụ thể) → **DELETE**
  - Còn lại → **POST**
- URL: `{MM_API_BASE_URL}/api/v1/{toolName}`
- Headers: `x-user-id`, `x-request-id`, `idempotency-key` (optional), `x-mm-approval` (optional)
- Timeout: configurable (`REQUEST_TIMEOUT_MS`, default 30s)

### 5.6 Security ([security.ts](file:///d:/Projects/mm2/mcp-server/src/security.ts))

| Middleware | Mô tả |
|-----------|-------|
| [authMiddleware](file:///d:/Projects/mm2/mcp-server/src/security.ts#11-29) | Validate `Authorization: Bearer <MCP_BEARER>` |
| [identityMiddleware](file:///d:/Projects/mm2/mcp-server/src/security.ts#30-41) | Yêu cầu header `x-user-id` |
| [checkApprovalGuard()](file:///d:/Projects/mm2/mcp-server/src/security.ts#42-74) | Kiểm tra Tier 2 tools cần `x-mm-approval: approved` |

Approval guard hỗ trợ deny/allow lists qua env:
- `APPROVAL_GUARD_DENYLIST`: luôn yêu cầu approval
- `APPROVAL_GUARD_ALLOWLIST`: bỏ qua approval check

### 5.7 Multi-Session Management

- Mỗi MCP connection tạo một `StreamableHTTPServerTransport` với sessionId (UUID)
- Factory pattern: `createMcpServerInstance()` tạo McpServer mới cho mỗi session
- Transport stored trong `Map<string, Transport>` **sau** `handleRequest()` (đảm bảo sessionId đã được gán)
- Hỗ trợ:
  - `POST /mcp`: Gửi message (tạo session mới hoặc gắn vào session hiện tại)
  - `GET /mcp`: SSE stream (server → client notifications)
  - `DELETE /mcp`: Kết thúc session

### 5.8 Logger ([logger.ts](file:///d:/Projects/mm2/mcp-server/src/logger.ts))

- Structured JSON output
- Redacts sensitive fields: `amount`, `total_amount`, `initial_balance`, `note`, `fileContent`, `password`
- Configurable log level: `debug` / `info` / `warn` / `error`

### 5.9 Environment Variables

| Variable | Default | Mô tả |
|----------|---------|-------|
| `PORT` | `3100` | Cổng HTTP |
| `MCP_PATH` | `/mcp` | Endpoint MCP |
| `MCP_BEARER` | — | Bearer token cho MCP auth |
| `MM_API_BASE_URL` | `http://localhost:3200` | URL Tool Gateway |
| `REQUIRE_APPROVAL_GUARD` | `true` | Bật kiểm tra approval |
| `LOG_LEVEL` | `info` | Mức log |
| `REQUEST_TIMEOUT_MS` | `30000` | Timeout proxy call |

---

## 6. Data Model

### 5.1 Entity-Relationship Diagram

```mermaid
erDiagram
    accounts ||--o{ transactions : "account_id"
    accounts ||--o{ transactions : "to_account_id"
    categories ||--o{ sub_categories : "category_id"
    categories ||--o{ transactions : "category_id"
    sub_categories ||--o{ transactions : "sub_category_id"
    transactions ||--o{ transaction_splits : "transaction_id"
    categories ||--o{ transaction_splits : "category_id"
    accounts ||--o{ recurring_rules : "account_id"
    categories ||--o{ recurring_rules : "category_id"
    recurring_rules ||--o{ recurring_instances : "rule_id"
    recurring_instances ||--|| transactions : "generated_transaction_id"
    accounts ||--o{ installment_plans : "credit_account_id"
    installment_plans ||--o{ installment_payments : "plan_id"
    installment_payments ||--o| transactions : "linked_transaction_id"
    categories ||--o{ budgets : "category_id"
```

### 5.2 Bảng dữ liệu

#### `accounts` — Tài khoản
| Column | Type | Mô tả |
|--------|------|-------|
| [id](file:///d:/Projects/mm2/mcp-server/src/security.ts#11-29) | TEXT PK | UUID |
| `name` | TEXT NOT NULL | Tên tài khoản |
| `type` | TEXT | `bank`, `credit`, `debit` |
| `currency` | TEXT | Đơn vị tiền tệ |
| `initial_balance` | REAL | Số dư ban đầu |
| `note` | TEXT | Ghi chú |

#### `categories` / `sub_categories` — Danh mục
- Category: `id`, `name` (UNIQUE), `sort_order`, `is_archived`
- SubCategory: `id`, `category_id` (FK), `name`, `sort_order`, `is_archived`, UNIQUE(`category_id`, `name`)

#### `payees` — Người nhận/người trả
| Column | Type | Mô tả |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `name` | TEXT NOT NULL | Tên payee |
| `normalized_name` | TEXT | Tên chuẩn hóa (lowercase) |
| `is_archived` | INTEGER | 0 hoặc 1 |

#### `transactions` — Giao dịch
| Column | Type | Mô tả |
|--------|------|-------|
| [id](file:///d:/Projects/mm2/mcp-server/src/security.ts#11-29) | TEXT PK | UUID |
| `account_id` | TEXT FK | Tài khoản chính |
| `to_account_id` | TEXT FK | Tài khoản đích (chuyển khoản) |
| [date](file:///d:/Projects/mm2/src/services/TransactionService.ts#70-73) | TEXT | Ngày giao dịch (YYYY-MM-DD) |
| `month` | TEXT | Tháng (YYYY-MM), derived from date |
| `amount` | REAL | Số tiền (+income, -expense) |
| `category_id` | TEXT FK | Danh mục |
| `sub_category_id` | TEXT FK | Danh mục con |
| `status` | TEXT | `posted`, `pending`, `ignored` |
| `source` | TEXT | `manual`, `recurring`, `installment`, `transfer` |
| `source_ref_id` | TEXT | ID quy tắc/kế hoạch nguồn |
| `is_split` | INTEGER | 0 hoặc 1 |
| `payee_id` | TEXT FK | Người nhận/người trả |
| `note` | TEXT | Ghi chú |
| `deleted_at` | TEXT | Soft delete timestamp |

> [!NOTE]
> Transactions sử dụng **soft delete** (`deleted_at`). Các query mặc định filter `deleted_at IS NULL`.

#### `transaction_splits` — Dòng chia nhỏ
- [id](file:///d:/Projects/mm2/mcp-server/src/security.ts#11-29), `transaction_id` (FK CASCADE), `category_id`, `sub_category_id`, `amount`, `note`

#### `recurring_rules` — Quy tắc định kỳ
- Frequency: `daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`
- Type: `income`, `expense`, `transfer`
- `auto_add`: tự động tạo giao dịch hay chờ trigger thủ công (default: **ON**)
- `default_status`: trạng thái mặc định cho giao dịch tự động tạo (default: **pending**)
- `payee_id`: người nhận/người trả (FK → payees)
- `is_active`: bật/tắt

#### `recurring_instances` — Instances đã tạo
- `rule_id` (FK CASCADE), [date](file:///d:/Projects/mm2/src/services/TransactionService.ts#70-73), `generated_transaction_id` (FK UNIQUE)
- UNIQUE(`rule_id`, [date](file:///d:/Projects/mm2/src/services/TransactionService.ts#70-73))

#### `installment_plans` — Kế hoạch trả góp
- `credit_account_id`, `payment_source_account_id`
- `total_amount`, `tenor_months`, `start_date`
- `payment_category_id`, `payment_sub_category_id`
- `auto_add`: tự động tạo giao dịch chi phí khi đến hạn (default: **ON**)
- `default_status`: trạng thái mặc định cho giao dịch tự động tạo (default: **pending**)
- `payee_id`: người nhận/người trả (FK → payees)

#### `installment_payments` — Lịch thanh toán
- Status: `upcoming`, `due`, `overdue`, `paid`
- `linked_transaction_id`: giao dịch manual gắn vào
- `generated_transaction_id`: giao dịch tự động tạo

#### `budgets` — Ngân sách
- `month`, `category_id`, `sub_category_id`, `amount`
- UNIQUE(`month`, `category_id`, `sub_category_id`)

#### `settings` — Cài đặt
- `lock_enabled`, `password_hash`, `date_format`

#### `audit_logs` — Nhật ký
- [action](file:///d:/Projects/mm2/src/services/TransactionService.ts#3-28), `entity_type`, `entity_id`, `details`
- Gateway mở rộng: `trace_id`, `actor_user_id`, `caller_type`, `tool_name`, `tier`, `resource_type`, `result`, `error_code`

#### `idempotency_keys` — Khoá chống trùng lặp
- `key` (PK), `tool_name`, `response` (cached JSON), `created_at`

---

## 7. Security Model

### 6.1 Tier System

| Tier | Loại | Quyền | Ví dụ |
|------|------|-------|-------|
| **0** | Read-only | Không cần approval | `get_accounts`, `search_transactions` |
| **1** | Write | Audit logged | `record_transaction`, `create_account` |
| **2** | Destructive | Cần approval + audit | `delete_account`, `import_system_data` |

### 6.2 Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AG as AI Gateway
    participant LLM as LLM Provider
    participant GW as Tool Gateway
    participant MCP as MCP Server
    participant AI as External AI Agent

    Note over C,GW: Client → Gateway (Direct)
    C->>GW: POST /api/v1/record_transaction
    Note right of C: Authorization: Bearer <JWT>
    GW->>GW: Verify JWT (JWT_SECRET)
    GW->>GW: auditLog middleware
    GW->>GW: Execute business logic
    GW-->>C: 200 OK {data: ...}

    Note over C,AG: Client → AI Gateway → MCP → Gateway
    C->>AG: POST /ai/chat {message}
    AG->>LLM: Chat Completions (messages + tools)
    LLM-->>AG: tool_call: record_transaction
    AG->>MCP: MCP tools/call (record_transaction)
    Note right of AG: Authorization: Bearer <MCP_BEARER>
    MCP->>MCP: Verify MCP_BEARER
    MCP->>GW: POST /api/v1/record_transaction
    GW->>GW: Execute business logic
    GW-->>MCP: 200 OK
    MCP-->>AG: MCP response
    AG->>LLM: Tool result
    LLM-->>AG: "Đã ghi nhận giao dịch..."
    AG-->>C: {assistantMessage: "Đã ghi nhận..."}

    Note over AI,MCP: External AI → MCP → Gateway (Direct MCP)
    AI->>MCP: MCP tools/call (record_transaction)
    Note right of AI: Authorization: Bearer <MCP_BEARER>
    MCP->>MCP: Verify MCP_BEARER
    MCP->>GW: POST /api/v1/record_transaction
    GW->>GW: Execute business logic
    GW-->>MCP: 200 OK
    MCP-->>AI: MCP response {content: [...]}
```

### 6.3 Luồng xử lý Tier 2 (Conversational Confirmation)

Kể từ bản cập nhật 2026-03-03, xác nhận Tier 2 được xử lý **qua chat** thay vì token-based approval:

```mermaid
sequenceDiagram
    participant User as User (Chat Panel)
    participant AG as AI Gateway
    participant LLM as LLM
    participant MCP as MCP Server
    participant GW as Tool Gateway

    User->>AG: "Xóa tài khoản VCB"
    AG->>LLM: Chat Completions
    LLM-->>AG: Text: "Bạn có chắc chắn muốn xóa tài khoản VCB?"
    AG-->>User: "Bạn có chắc chắn?"
    User->>AG: "Có, xóa đi"
    AG->>LLM: Chat Completions (user confirmed)
    LLM-->>AG: tool_call: delete_account({id: "..."}) 
    AG->>MCP: tools/call delete_account
    MCP->>GW: DELETE /api/v1/delete_account
    GW->>GW: approvalGuard() → pass-through
    GW->>GW: auditLog middleware
    GW->>GW: Execute delete
    GW-->>MCP: 200 OK
    MCP-->>AG: MCP response
    AG->>LLM: Tool result
    LLM-->>AG: "Đã xóa tài khoản VCB"
    AG-->>User: "Đã xóa tài khoản VCB"
```

> [!NOTE]
> `approvalGuard()` trên Tool Gateway giờ là pass-through (luôn gọi `next()`). Xác nhận được đảm bảo bởi system prompt yêu cầu AI phải hỏi user trước khi gọi destructive tools.

---

## 8. Data Flow

### 7.1 Client → Gateway

```mermaid
sequenceDiagram
    participant UI as React Component
    participant DS as Domain Service
    participant TES as ToolExecutionService
    participant GC as GatewayClient
    participant GW as Tool Gateway
    participant DB as SQLite

    UI->>DS: TransactionService.create(data)
    DS->>TES: executeTool("record_transaction", data)
    TES->>TES: Build Gateway config (URL + JWT)
    TES->>GC: callTool("record_transaction", data, config)
    GC->>GC: Determine method (POST)
    GC->>GW: POST /api/v1/record_transaction
    GW->>GW: Auth → Audit → Handler
    GW->>DB: INSERT INTO transactions...
    GW->>DB: saveDatabase()
    GW-->>GC: {data: {id: "...", ...}}
    GC-->>TES: result
    TES-->>DS: result
    DS-->>UI: Transaction object
```

### 8.2 Client → AI Gateway → MCP → Gateway

```mermaid
sequenceDiagram
    participant User as React Component
    participant AG as AI Gateway
    participant LLM as OpenAI
    participant MCP as MCP Server
    participant Proxy as proxy.ts
    participant GW as Tool Gateway

    User->>AG: POST /ai/chat {message: "Tháng 2 chi bao nhiêu?"}
    AG->>AG: Load session, build system prompt
    AG->>LLM: Chat Completions (messages + 69 tool defs)
    LLM-->>AG: tool_call: search_transactions({month: "2026-02"})
    AG->>MCP: tools/call {name: "search_transactions", args: {month: "2026-02"}}
    MCP->>Proxy: executeToolViaGateway()
    Proxy->>GW: GET /api/v1/search_transactions?month=2026-02
    GW-->>Proxy: {data: [...]}
    Proxy-->>MCP: {ok: true, data: [...]}
    MCP-->>AG: {content: [{type: "text", text: "[...]"}]}
    AG->>LLM: Tool result → Continue
    LLM-->>AG: "Tháng 2 bạn chi 15.000.000đ..."
    AG-->>User: {assistantMessage: "Tháng 2 bạn chi 15.000.000đ..."}
```

---

## 9. Deployment

### 9.1 Development

**Cách nhanh (Windows):** Chạy `start.bat` ở thư mục gốc — tự động mở 4 terminal:

```bash
cd d:\Projects\mm2
start.bat
```

**Hoặc mở thủ công:**

```bash
# Terminal 1: Client (Vite dev server)
cd d:\Projects\mm2
npm run dev                    # → http://localhost:5173

# Terminal 2: Tool Gateway
cd d:\Projects\mm2\tool-gateway
npm run dev                    # → http://localhost:3200

# Terminal 3: MCP Server
cd d:\Projects\mm2\mcp-server
npm run dev                    # → http://localhost:3100

# Terminal 4: AI Gateway
cd d:\Projects\mm2\ai-gateway
npm run dev                    # → http://localhost:3300
```

### 9.2 Production Build

```bash
# Client
npm run build                  # → dist/

# Tool Gateway
cd tool-gateway && npm run build && npm start

# MCP Server
cd mcp-server && npm run build && npm start

# AI Gateway
cd ai-gateway && npm run build && npm start
```

### 9.3 Topology

```
┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────────┐
│  Browser  │────▶│ Tool Gateway │◀────│MCP Server│◀────│  AI Gateway  │
│  (Vite)   │     │   (:3200)    │     │ (:3100)  │     │   (:3300)    │
│  :5173    │     │              │     │          │     │              │
│           │·····│·····(chat)···│·····│··········│·····│──▶ OpenAI    │
└──────────┘     │  ┌────────┐  │     │          │◀──┐ └──────────────┘
       │          │  │ SQLite │  │     └──────────┘   │
       └─(chat)──▶│  │ (file) │  │                    │ External AI
                  │  └────────┘  │                    │ (Claude, etc.)
                  └──────────────┘                    └───────────────
```

---

## 10. Tóm tắt kiến trúc

| Khía cạnh | Chi tiết |
|-----------|----------|
| **Kiến trúc** | 4-tier: SPA → AI Gateway → MCP Server → Tool Gateway → SQLite |
| **Giao tiếp** | Client ↔ Gateway: REST/JSON; Client ↔ AI Gateway: REST/JSON; AI Gateway ↔ MCP: JSON-RPC; AI Gateway ↔ LLM: OpenAI API |
| **Auth** | Client → Gateway: JWT; AI Gateway → MCP: Bearer Token; AI Gateway → LLM: API Key |
| **Database** | SQLite (sql.js trên server), 12 bảng, file-based persistence. Client không chứa DB |
| **Security** | 3-tier system (Read / Write / Destructive), audit logging, conversational confirmation (Tier 2), origin guard |
| **Client Mode** | Gateway-only (thin client). Local mode đã loại bỏ hoàn toàn (2026-02-28) |
| **MCP** | Manifest-driven tool registration, 69 tools, auto schema generation, multi-session support |
| **AI Gateway** | MCP-First orchestrator, OpenAI-compatible LLM, session persistence, conversational Tier 2 confirmation |
| **AI Chat UI** | Chat Panel overlay (FAB → panel), `AIChatService` + `AIChatStore`, Vite proxy `/ai-api` → `:3300/ai` |
| **Soft Delete** | Transactions sử dụng `deleted_at` thay vì xóa thật |
| **Idempotency** | Hỗ trợ `idempotency_keys` table cho API calls |

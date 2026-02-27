# Architecture & Responsibilities

## Components
- **Tool Gateway (this PRD scope)**: REST backend that owns business logic and data integrity.
- **MCP Server**: protocol adapter bridging LLM tool-calls to Gateway REST endpoints. MCP is *not* business logic.
- **LLM**: tool caller; must not be trusted for security decisions.

## Trust boundaries
- Gateway must assume the caller is **untrusted**.
- All requests must be authenticated; all resource access must be authorized by `userId` ownership.
- Tier 2 actions require a *cryptographically verifiable* approval token, not a boolean header.

## High-level sequence (Tier 2 example: delete_transaction)
1. User confirms in UI (or trusted client) -> obtains **approval token** bound to (userId, action, resource ids, expiry).
2. LLM requests tool via MCP.
3. MCP maps tool call -> REST request to Gateway, forwards auth + approval token.
4. Gateway verifies:
   - auth token valid
   - ownership valid
   - approval token valid and scoped
5. Gateway executes DB transaction and records audit log.
6. Response returns back through MCP to the LLM.

## Service layering inside Gateway
- **HTTP layer**: routing, validation, error envelope, trace propagation.
- **Auth layer**: authentication + authorization.
- **Domain services**: TransactionService, BudgetService, RecurringService, InstallmentService, StatisticsService.
- **Persistence**: SQL queries / ORM (your choice) with explicit transactions.

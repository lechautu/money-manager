# OpenAI Integration (Responses API / Agents)

Goal: connect OpenAI-hosted runtime to this MCP server.

## 1) MCP tool configuration
Provide:
- `server_url`: https://<host>/mcp
- `headers`: include `authorization: Bearer <MCP_BEARER>` and user identity header(s)
- `require_approval`: skip approvals only for a safe subset of Tier 0

## 2) Tier 0 allowlist for skip approval (recommended)
Start with a conservative set:
- `get_accounts`
- `get_account_balances`
- `search_transactions`
- `get_categories`
- `get_budgets`

Avoid skipping for:
- `export_system_data` (even though Tier 0)

## 3) Example payload (conceptual)
```json
{
  "model": "gpt-5",
  "tools": [
    {
      "type": "mcp",
      "server_label": "mm2",
      "server_url": "https://YOUR_HOST/mcp",
      "headers": {
        "authorization": "Bearer YOUR_MCP_BEARER",
        "x-user-id": "USER_123"
      },
      "require_approval": {
        "never": {
          "tool_names": ["get_accounts","get_account_balances","search_transactions","get_categories","get_budgets"]
        }
      }
    }
  ],
  "input": "List my balances and show 10 most recent transactions."
}
```

## 4) Tier 2 approval flow
Orchestrator must:
1. Ask user for confirmation showing the exact action and affected entities.
2. On approval, re-run the request with header `x-mm-approval: approved` (or another guard mechanism you implement).

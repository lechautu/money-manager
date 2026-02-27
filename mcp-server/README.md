# mm2 MCP Server

Remote MCP server for **Money Manager 2** — exposes the mm2 tool catalog to AI agents via the Model Context Protocol (Streamable HTTP transport).

## Quick Start

```bash
cd mcp-server
npm install
cp .env.example .env
# Edit .env with your secrets
npm run dev
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3100` | Server port |
| `MCP_PATH` | No | `/mcp` | MCP endpoint path |
| `MCP_BEARER` | **Yes** | — | Bearer token for auth |
| `MM_API_BASE_URL` | **Yes** | — | Tool Gateway base URL |
| `REQUIRE_APPROVAL_GUARD` | No | `true` | Enforce Tier 2 approval |
| `LOG_LEVEL` | No | `info` | Logging level |
| `REQUEST_TIMEOUT_MS` | No | `30000` | Gateway request timeout |

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check |
| `GET` | `/version` | Server version + manifest info |
| `POST/GET/DELETE` | `/mcp` | MCP Streamable HTTP transport |

## Smoke Tests

```bash
# Health check
curl http://localhost:3100/healthz

# Version
curl http://localhost:3100/version

# No auth → 401
curl -X POST http://localhost:3100/mcp

# Validate manifest
npm run validate:manifest
```

## OpenAI Integration

```json
{
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
          "tool_names": ["get_accounts", "get_account_balances", "search_transactions", "get_categories", "get_budgets"]
        }
      }
    }
  ]
}
```

## Docker

```bash
docker build -t mm2-mcp-server .
docker run -p 3100:3100 --env-file .env mm2-mcp-server
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with hot reload (tsx) |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled server |
| `npm run validate:manifest` | Validate tools manifest |
| `npm test` | Run tests |

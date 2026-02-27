# Repo Layout — Required Structure

## 1) Hard requirement
Root is client. MCP server must live in `/mcp-server/**`.

## 2) Required structure (minimum)
```text
/
  src/                      # existing client
  package.json              # existing client
  mcp-server/
    package.json
    tsconfig.json           # if using TypeScript
    README.md
    .env.example
    src/
      server.ts
      toolRegistry.ts
      security.ts
      proxy.ts
    tools_manifest_v1.json  # contract snapshot OR loaded from root via ../
```

## 3) Recommended scripts in /mcp-server/package.json
- `dev`: run TS with hot reload (tsx or ts-node)
- `build`: compile to dist
- `start`: run compiled server
- `lint` (optional)
- `test` (optional but recommended)
- `validate:manifest`: validate tools_manifest_v1.json before running

## 4) Manifest location decision
Pick one and document it:
- Option A (preferred): keep a copy at `/mcp-server/tools_manifest_v1.json` (snapshot).
- Option B: read `../tools_manifest_v1.json` from root (requires CI guard).

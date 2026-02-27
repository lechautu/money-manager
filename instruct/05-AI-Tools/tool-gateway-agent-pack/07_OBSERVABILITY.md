# Logging, Audit, Observability

## Trace
- Accept `X-Trace-Id` from caller; generate if missing.
- Return `traceId` in response meta.

## Audit log (Tier 1/2 mandatory)
Fields:
- traceId
- actorUserId
- callerType (web|mcp|script)
- toolName / endpoint
- tier
- resourceType + resourceIds
- requestHash (do not store raw sensitive payload)
- result (success/fail, error code)
- createdAt

## Metrics (minimum)
- requests_total{endpoint,method,status}
- request_duration_ms{endpoint} (p95/p99)
- errors_total{code}
- tier2_rejected_total{reason}
- bulk_ops_total{tool}

## Debug logging
- Log structured JSON.
- Never log full auth tokens.

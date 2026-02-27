# Security Policy (Auth, AuthZ, Tiering)

## Authentication
- All endpoints except health checks require `Authorization: Bearer <token>`.
- Token must resolve to `userId` (subject). Use JWT or opaque token + introspection.

## Authorization (Ownership)
- Every resource must be scoped to `userId`.
- Reject cross-user access with `403 FORBIDDEN`.

## Tiering
- Tier 0: read-only (no user confirm needed).
- Tier 1: write/update (server-side validation required).
- Tier 2: destructive/sensitive -> requires *approval token*.

## Approval token (Tier 2)
### Header
- `X-MM-Approval-Token: <signed-token>`

### Required claims
- `sub`: userId
- `act`: action name (e.g., `delete_transaction`)
- `rid`: resource ids or query scope hash
- `exp`: expiry (<= 5 minutes recommended)
- `nonce`: single-use or short-lived
- `iat`: issued at

### Verification
- Verify signature (HMAC or asymmetric).
- Verify `sub` matches auth userId.
- Verify `act` matches endpoint/tool.
- Verify scope includes the target resources.
- Verify not expired; optionally verify nonce not reused.

## Rate limiting
- Apply per-user and per-IP limits for Tier 1/2.
- Apply stricter limits for bulk operations.

## Audit logs
- Mandatory for Tier 1/2, recommended for Tier 0 analytics exports.

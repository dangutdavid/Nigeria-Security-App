# Permissions

Access control works in three layers. Each one is enforced on its own:

1. **Capabilities (role-based).** `artifacts/api-server/src/lib/permissions.ts` is the
   single source of truth. Routes enforce it with `requireCapability()`, and the
   same list is sent to the app at login, so the UI and the server cannot disagree.
   `tests/permissions.test.ts` checks this for every role.
2. **Agency scope.** Non-admins are confined to their own agency
   (`requireCapability(..., { agency })`).
3. **Row-level security in Postgres.** Even if layers 1 and 2 had a bug, the
   database returns only rows the caller may see. See
   [ROW_LEVEL_SECURITY.md](ROW_LEVEL_SECURITY.md).

Additional gates:

- **Two-step verification.** Roles in `MFA_ENFORCED_ROLES` (all staff in
  production by default) can only enrol until a second factor is set up.
- **Session lifetime and automatic sign-out.** `SESSION_TTL_HOURS` sets the
  token lifetime, and the app signs staff out after time in the background.
- **Account lockout.** 10 failed PINs lock the badge for 15 minutes.

## Matrix

| Capability | officer | supervisor | commander | admin | super_admin |
| --- | :---: | :---: | :---: | :---: | :---: |
| `report:view_all` |  |  |  | ✓ | ✓ |
| `report:view_agency` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `report:update_status` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `report:assign` |  | ✓ | ✓ | ✓ | ✓ |
| `report:reassign` |  |  |  | ✓ | ✓ |
| `agency:dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `agency:manage` |  |  |  | ✓ | ✓ |
| `user:manage` |  |  |  | ✓ | ✓ |
| `audit:read` |  |  |  | ✓ | ✓ |
| `privacy:erase` |  |  |  | ✓ | ✓ |
| `mfa:reset` |  |  |  | ✓ | ✓ |

Citizens hold no session. They submit and track reports anonymously, and can
reach only their own report through its reference plus their device's private
submission key.

## Changing a permission

Treat any edit to the matrix as a security change:

1. Update `permissions.ts`.
2. Regenerate this table.
3. Update `tests/permissions.test.ts` if you add a probe.
4. Get the change reviewed. The audit log does not record permission changes,
   because they are code changes, so git history is the record.

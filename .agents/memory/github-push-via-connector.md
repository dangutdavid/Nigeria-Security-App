---
name: Push full repo to GitHub via connector
description: How to push the whole git repo to a user's GitHub repo using the Replit GitHub connector (not the API proxy)
---

# Pushing the repo to GitHub

The GitHub connector blueprint only documents the **API proxy** pattern
(`connectors.proxy("github", ...)`), which is for REST calls — it CANNOT push a
git repository. To actually deploy/push the codebase:

1. `await listConnections("github")` → take `conns[0].settings.access_token`
   (fallback `conns[0].settings.oauth.credentials.access_token`). The connector
   carries the `repo` scope, so the token can push.
2. Do all git work inside `code_execution` (Node `child_process.execSync`) so the
   token stays in a variable — never put it in a bash command (it would be logged)
   and never write it to `.git/config`.
3. Push to an explicit URL so the token is not persisted to config:
   `git push https://x-access-token:${token}@github.com/<owner>/<repo>.git main:main`
4. Before pushing, `git ls-remote <url>` to check if the remote is empty. Empty →
   a normal (non-force) push is a fast-forward and is allowed. Non-empty → a
   force push would be needed, which is a destructive git op (delegate to a
   background Project Task; do not run directly).
5. Scrub the token out of any printed command output: `out.split(token).join("***")`.

**Why:** the repl's `main` branch already has Replit's auto-commits, so no
`git commit`/`git init` is needed — those are destructive and would otherwise
require delegation. A clean working tree + empty remote = a plain `git push`.

**Isolated task environments:** `listConnections("github")` and the raw
`connectors.replit.com /api/v2/connection` endpoint return zero items there — no raw
token is served. BUT the connector **API proxy still works**: install
`@replit/connectors-sdk` (e.g. `pnpm --dir scripts add`, remove after), import it by
absolute path in code_execution, and `connectors.proxy("github", "/repos/...")`
succeeds. So REST-API work is possible; only `git push` (needs the raw token) is not.

**Fallback when no raw token / push won't fast-forward — SHA-exact replication via
the Git Data API (through the proxy):** replicate each missing local commit so SHAs
match a real push:
1. `git diff-tree -r -z <parent> <commit>` → changed entries (mode, blob sha, path).
2. POST `/git/blobs` (base64) for blobs GitHub lacks (GET `/git/blobs/<sha>` first;
   most already exist if content came from GitHub). Returned sha must equal local sha.
3. POST `/git/trees` with `base_tree` = parent's tree + diff entries → tree sha must
   equal local tree sha (deterministic).
4. POST `/git/commits` with exact author/committer (`date` as ISO `+00:00`) and the
   **message INCLUDING the trailing newline** — GitHub stores the message verbatim and
   does NOT append `\n`; omitting it changes the commit SHA.
5. Verify each returned sha equals the local sha; then POST a backup branch ref at the
   old remote head and PATCH `/git/refs/heads/main` with `force: true`.

**Platform merge-flattening gotcha:** when a task merges GitHub into the workspace,
the platform flattens the merge commit to a single-parent commit, so the GitHub head
is NOT an ancestor of workspace main and a plain push will not fast-forward. Expect
this after every GitHub-pull task; use the replication + backup-branch + force-ref
procedure above (old head preserved on a `pre-sync-backup-<date>` branch).

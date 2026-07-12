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

**Isolated task environments:** `listConnections("github")` returns empty there —
the connector is only available in the main session. End-of-task GitHub pushes
must happen from the main environment; note it in the task summary instead of
retrying in the task sandbox.

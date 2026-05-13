# CI demos — Codex Review bot

Two workflows that do the **same job** (review the diff of a pull request,
post the review as a PR comment) but differ in how much trust the runner
extends to the Codex agent.

| File                              | Demo  | Path to Codex                   | API key exposure | Privilege |
| --------------------------------- | ----- | ------------------------------- | ---------------- | --------- |
| `codex-review.yml`                | 10    | `npm i -g @openai/codex` + `codex exec` | **In env of the Codex process** | root (runner) |
| `codex-review-action.yml`         | 10b   | `openai/codex-action@v1`        | **Never visible to Codex** (local proxy holds the key) | `codexuser` (unprivileged) |

Both produce identical PR comments. The difference is the threat model.

## Demo 10 — `codex-review.yml`

This is the "Unix-y composability" payoff of the CLI segment: a single
`git diff | codex exec` pipeline, with the flags attendees just learned
(`--json`, `--output-last-message`, `-s read-only`,
`-c approval_policy='"never"'`) wired up in CI.

**What it sacrifices for clarity:**

- `CODEX_API_KEY` is exported into the env of the `codex exec` step. The
  prompt asks Codex to read a diff — but nothing structurally prevents the
  agent from running `env`, `cat ~/.bash_history`, or piping
  `$CODEX_API_KEY` into `review.md` and getting it posted as a PR comment.
- Codex runs as the `runner` user with passwordless sudo available.
- The sandbox is `read-only` for filesystem writes (good), but env
  variables are still readable.

For a workshop where the next slide is "...and here's how you fix this,"
that's the right level of exposure. For production, it's the version you
walk away from.

## Demo 10b — `codex-review-action.yml`

Same scenario, rebuilt on `openai/codex-action@v1` with
`safety-strategy: unprivileged-user`. Two defenses stack:

### Defense 1 — local API proxy

The action starts a small HTTP proxy on `localhost` that:

1. Holds the real `CODEX_API_KEY` in its own process memory.
2. Writes a `~/.codex/config.toml` pointing Codex at
   `http://localhost:<port>` with a **throwaway token** for auth.
3. Forwards Codex's requests upstream, attaching the real key on the way
   out.

From Codex's point of view, `CODEX_API_KEY` doesn't exist in its
environment. The only credential it sees is a per-run token that's
useless outside the runner.

### Defense 2 — privilege separation (`unprivileged-user`)

Even with the key out of env, a process running as the same user as the
proxy could in principle read `/proc/<proxy-pid>/environ`. So:

- The workflow creates a dedicated `codexuser` system account.
- The proxy runs as `runner`. Codex runs as `codexuser`.
- They share group ownership of `$GITHUB_WORKSPACE` (so Codex can read
  the checkout) but nothing else.
- `codexuser` cannot `ptrace`, cannot read `runner`'s `/proc` env, cannot
  sudo. The standard Linux user boundary is the defense.

### What this costs

- Three extra setup steps (create user, chown workspace, setgid dirs).
- Slightly slower job start.
- Loss of direct visibility into the `codex exec` flags — they're inputs
  on the action now (`sandbox: read-only`, `safety-strategy:
  unprivileged-user`).

For production: worth it. For teaching: show 10 first so 10b's setup
boilerplate has motivation.

## Pick-one guidance

- **Internal repo, low-trust prompt, short-lived secrets:** Demo 10 is
  acceptable if you're comfortable rotating the key.
- **Same-repo branch PRs, long-lived secrets, or any compliance story:**
  Demo 10b with `unprivileged-user`. Treat the agent as a
  potentially-hostile process and the workflow defends accordingly.

A middle option — `safety-strategy: drop-sudo` — keeps Codex as the
`runner` user but strips passwordless sudo. Cheaper than `unprivileged-user`,
but doesn't defend against the agent reading the proxy's `/proc`.

### Fork PRs — important caveat

The `pull_request` event from a forked repository **does not receive
repository secrets**, so `${{ secrets.CODEX_API_KEY }}` will be empty and
the action will fail. This applies to both Demo 10 and Demo 10b.

Options if you need to review fork PRs:

1. **`pull_request_target`** — runs in the context of the base repo and
   *does* get secrets, but checks out the base by default. You must
   explicitly check out the fork's head, which means the workflow file
   from `main` is what runs (good for security) and you are about to feed
   untrusted code to a privileged job (read the GitHub docs on
   `pull_request_target` before going down this path).
2. **Two-stage workflow** — `pull_request` builds a sanitized diff
   artifact; a `workflow_run` job picks it up with secrets and runs Codex.
   More plumbing, fewer footguns.
3. **Require contributors to open PRs from a same-repo branch.** Simplest
   answer for internal/closed communities.

Neither file in this folder handles fork PRs out of the box — they assume
same-repo branches.

#!/usr/bin/env bash
# =============================================================================
# Codex CLI — Non-Interactive Automation Demo
#
# Run blocks individually (highlight-and-execute in your terminal, or copy-paste).
# Do NOT `bash` the whole file end-to-end — each block has its own pacing and
# you want to narrate between blocks.
#
# Run from the repo root.
#
# Pre-demo URLs (filled in after the workflow ran successfully):
#   Workflow run:  https://github.com/rstropek/2026-04-codex/actions/runs/25719252421
#   Pull request:  https://github.com/rstropek/2026-04-codex/pull/1
#   Run ID for `gh run view`:  25719252421
# =============================================================================


# =============================================================================
# Demo 1 — Hello `codex exec`
# -----------------------------------------------------------------------------
# Talking points:
# - This is THE entry point for automation: `codex exec PROMPT`. No TUI, no
#   approvals prompts, just one shot in, one answer out.
# - Three flags worth knowing on day one:
#     -C / --cd               run against another directory without `cd`.
#     -s / --sandbox          make the safety boundary explicit. Our project
#                             config says workspace-write; on CI you want
#                             read-only by default and *opt in* to writes.
#     -o / --output-last-message  final natural-language answer to a file —
#                             friendly for downstream tooling.
# - Compare with the interactive TUI: same engine, no human in the loop.
# =============================================================================

codex exec \
  -C . \
  -s read-only \
  -o demo/repo-summary.md \
  "Give me a 5-bullet briefing about this repository: purpose, top-level layout, build tooling, test setup, and one risk hotspot. Under 200 words total."

cat demo/repo-summary.md


# =============================================================================
# Demo 2 — Stdin pipeline + JSONL streaming
# -----------------------------------------------------------------------------
# Talking points:
# - Real automation is composable. Codex follows the Unix pipe model:
#     * Positional PROMPT + piped stdin  → stdin is appended as <stdin> context.
#     * `codex exec -`                   → stdin becomes the FULL prompt.
# - `--json` emits a JSONL event stream on stdout. Each line is a typed event:
#   item.started / item.completed / command_execution / file_change / error.
#   This is the format your CI dashboard consumes.
# - We separate streams: JSONL events → stdout → file; final message → -o.
# =============================================================================

# 2a — Pipe git context as <stdin>, get a release-notes draft.
{ git log --oneline -10; echo "---"; git diff HEAD~3 2>/dev/null; } | \
  codex exec \
    -s read-only \
    -o demo/release-notes.md \
    "Draft release notes (Markdown) from the git log and diff in <stdin>. Group changes into Features, Fixes, Chores. Be concise."

cat demo/release-notes.md

# 2b — Same call but stream JSONL events. Pipe through jq to peek at the event
# types. In CI, you upload this file as an artifact for debugging.
{ git log --oneline -10; echo "---"; git diff HEAD~3 2>/dev/null; } | \
  codex exec \
    --json \
    -s read-only \
    -o demo/release-notes.md \
    "Draft release notes (Markdown) from the git log and diff in <stdin>. Group changes into Features, Fixes, Chores. Be concise." \
    > demo/events.jsonl

# Show the event types Codex emitted, with counts.
jq -r '.type // .msg.type // "unknown"' demo/events.jsonl | sort | uniq -c | sort -rn

# Show only the final completed items.
jq -c 'select((.type // "") | test("completed|finished|message"))' demo/events.jsonl | head -5


# =============================================================================
# Demo 3 — Schema-constrained output (`--output-schema`)
# -----------------------------------------------------------------------------
# Talking points:
# - Free-form Markdown is great for humans, terrible for pipelines. When the
#   next step is `jq`, a database insert, or a policy gate, you need a stable
#   contract.
# - `--output-schema FILE` makes Codex emit JSON matching a JSON Schema. The
#   schema lives in the repo, gets reviewed like code, and protects downstream
#   consumers from drift.
# - Our schema (demo/schemas/risk.schema.json) classifies modules: path,
#   risk_level (low|medium|high), reason, recommended_owner.
# =============================================================================

cat demo/schemas/risk.schema.json

codex exec \
  -s read-only \
  --output-schema demo/schemas/risk.schema.json \
  -o demo/risks.json \
  "Audit the source tree under packages/ and apps/. Classify each workspace by risk if changed. Return JSON matching the provided schema. Use the timestamp $(date -u +%FT%TZ) for generated_at."

cat demo/risks.json
# Pipeline-friendly consumption — block the build if anything is 'high':
jq -e '[.modules[] | select(.risk_level=="high")] | length == 0' demo/risks.json \
  && echo "Gate PASSED" \
  || echo "Gate FAILED — high-risk modules present"


# =============================================================================
# Demo 4 — Pre-merge diff review
# -----------------------------------------------------------------------------
# Talking points:
# - This is the classic CI/CD use case: a PR opens, Codex reviews the diff
#   *before* a human does. Comments land as a PR comment (we wire that up in
#   demo 10).
# - Two approaches:
#     a) `codex exec review` — built-in subcommand. Targets the working tree.
#     b) Pipe `git diff` into `codex exec -s read-only -` — same idea, more
#        explicit and easier to scope (e.g., diff against main, or only a path).
# - We use approach (b) here because it's the pattern you'll actually copy
#   into your pipeline.
# =============================================================================

git diff HEAD~1...HEAD | \
  codex exec \
    -s read-only \
    -o demo/review.md \
    "You are a senior reviewer. The <stdin> contains a git diff. Produce a Markdown review with sections: Summary, Blockers, Suggestions, Nits. Under 300 words."

cat demo/review.md


# =============================================================================
# Demo 5 — Autofix a seeded bug (workspace-write)
# -----------------------------------------------------------------------------
# Talking points:
# - This is where Codex stops being a reviewer and becomes a contributor.
# - Two new things appear:
#     -s workspace-write              Codex can now edit files in the cwd.
#     -c approval_policy='"never"'    one-off TOML override, equivalent to a
#                                     `--ask-for-approval never` mode. Without
#                                     this, our project config would prompt
#                                     ('untrusted'), which dead-locks CI.
# - The shape of an autofix run:
#     1) Seed a failing test (we break math.ts by hand here so the demo is
#        deterministic — Codex did NOT introduce this bug).
#     2) Verify the failure with `pnpm test` so attendees see red.
#     3) Hand the failure off to Codex with a tightly scoped prompt.
#     4) Re-run tests, show green, show the patch.
#     5) Clean up — `git restore` puts the repo back so we can re-run the demo.
# =============================================================================

# 5a — Seed the bug (by hand — do NOT blame Codex for this!).
sed -i.bak 's/return a + b;/return a - b;/' packages/lib/src/math.ts && rm packages/lib/src/math.ts.bak
git --no-pager diff packages/lib/src/math.ts

# 5b — Confirm tests fail.
pnpm -w test || echo ">>> Tests failed as expected — handing off to Codex."

# 5c — Codex fixes it.
codex exec \
  -s workspace-write \
  -c approval_policy='"never"' \
  "A unit test in packages/lib/src/math.test.ts is failing. Inspect the failure, fix the implementation in packages/lib/src/math.ts. Do NOT modify the test. Then run \`pnpm -w test\` to confirm green."

# 5d — Verify and inspect the patch.
pnpm -w test
git --no-pager diff packages/lib/src/math.ts

# 5e — Cleanup so the demo is idempotent.
git restore packages/lib/src/math.ts
git --no-pager status


# =============================================================================
# Demo 6 — Two-stage with session resume
# -----------------------------------------------------------------------------
# Talking points:
# - Many real pipelines have a human-in-the-loop checkpoint:
#     stage 1: Codex proposes → human reviews.
#     stage 2: human approves → Codex implements.
# - `codex exec resume --last` continues the most recent non-interactive
#   session. Context, files read, plan — all preserved. You don't re-prompt
#   the world.
# - The two stages can have *different* sandbox modes: stage 1 read-only,
#   stage 2 workspace-write. The resume inherits the conversation, not the
#   policy.
# =============================================================================

# Stage 1 — propose only.
codex exec \
  -s read-only \
  -o demo/stage1-proposals.md \
  "Propose exactly THREE small improvements to packages/lib (style, naming, docs). Number them 1, 2, 3. Do NOT edit any files. Keep each proposal under 3 sentences."

cat demo/stage1-proposals.md

# >>> Imagine Rainer reads proposals and gives a thumbs-up to #1. <<<

# Stage 2 — resume and apply only #1.
# Note: `codex exec resume` does NOT accept -s/--sandbox; override via -c instead.
codex exec resume --last \
  -c sandbox_mode='"workspace-write"' \
  -c approval_policy='"never"' \
  "Apply only proposal #1 from your previous response. Make the minimal change. Do not touch anything else."

git --no-pager diff
# Cleanup — keep the repo clean for the next demo.
git restore packages/ apps/ 2>/dev/null || true


# =============================================================================
# Demo 7 — Image-driven CSS fix
# -----------------------------------------------------------------------------
# Talking points:
# - Text-only review can't catch "this looks wrong". Codex accepts images with
#   `-i / --image` and reasons about them multimodally.
# - We deliberately break the home page styling, screenshot the broken state
#   via Playwright, and hand the screenshot to Codex with a fix prompt.
# - In CI this is exactly the pattern for visual regression triage: Playwright
#   captures the failure, Codex proposes the fix.
# -----------------------------------------------------------------------------
# Setup note: this demo needs the dev server running and Playwright installed
# in apps/web. Both already are in this repo.
# =============================================================================

# 7a — Inject an obvious bug into the CSS.
cat >> apps/web/src/app/page.module.css <<'CSS'

/* Demo bug — DO NOT KEEP. */
.title {
  color: red !important;
  transform: rotate(15deg);
}
CSS

# 7b — Start the dev server in the background, wait for it to come up.
pnpm --filter @questionnaires/web dev > /tmp/web-dev.log 2>&1 &
WEB_PID=$!
echo "Dev server PID: $WEB_PID — waiting for http://localhost:3000 ..."
until curl -sf http://localhost:3000 > /dev/null; do sleep 1; done

# 7c — Screenshot the broken state with Playwright.
pnpm --filter @questionnaires/web exec playwright screenshot \
  --viewport-size=1280,800 \
  --full-page \
  http://localhost:3000 "$PWD/demo/screenshot-broken.png"

# Stop the dev server before letting Codex run (avoid port collisions).
kill $WEB_PID 2>/dev/null || true
# Next.js leaves background workers; give them a moment to release the port.
sleep 2

# 7d — Codex fixes it from the screenshot alone.
# Note: put the positional prompt BEFORE `-i`. `-i / --image` is variadic
# (`<FILE>...`) and will otherwise swallow the prompt as a filename.
codex exec \
  -s workspace-write \
  -c approval_policy='"never"' \
  "The attached image shows our home page rendered with a styling bug introduced in apps/web/src/app/page.module.css: the title is rotated and colored red, neither of which is intended. Remove ONLY the offending CSS rule. Do not change page.tsx." \
  -i demo/screenshot-broken.png

git --no-pager diff apps/web/src/app/page.module.css

# 7e — Re-screenshot to prove the fix (optional, time-permitting).
pnpm --filter @questionnaires/web dev > /tmp/web-dev.log 2>&1 &
WEB_PID=$!
until curl -sf http://localhost:3000 > /dev/null; do sleep 1; done
pnpm --filter @questionnaires/web exec playwright screenshot \
  --viewport-size=1280,800 \
  --full-page \
  http://localhost:3000 "$PWD/demo/screenshot-fixed.png"
kill $WEB_PID 2>/dev/null || true

# 7f — Cleanup.
git restore apps/web/src/app/page.module.css


# =============================================================================
# Demo 8 — Governance & reproducibility
# -----------------------------------------------------------------------------
# Talking points:
# - Three concerns enterprises will raise the moment you put Codex in CI:
#     1) "Can a malicious prompt make Codex run rm -rf?"   → execpolicy.
#     2) "Will my CI behave differently than my laptop?"    → --ignore-user-config.
#     3) "How do we lock policy without editing every step?"→ profiles + -c.
# =============================================================================

# 8a — execpolicy: test commands against a small demo policy.
# The policy lives in demo/rules/demo-policy.rules and contains forbidden
# (rm -rf, bash -lc) and prompt (gh pr/issue) decisions. `--rules <PATH>` is
# required; repeat the flag to compose multiple files (team + project).
echo '--- forbidden: shell smuggling ---'
codex execpolicy check \
  --rules demo/rules/demo-policy.rules \
  --pretty \
  -- bash -lc 'git add . && rm -rf /'

echo '--- prompt: GitHub CLI write paths ---'
codex execpolicy check \
  --rules demo/rules/demo-policy.rules \
  --pretty \
  -- gh pr comment 1 --body-file review.md

echo '--- allow: a real project rule ---'
codex execpolicy check \
  --rules .codex/rules/pnpm-default.rules \
  --pretty \
  -- pnpm run test

# 8b — A "deterministic CI run" recipe.
#      --ignore-user-config: skip ~/.codex/config.toml so devs' personal
#                            settings cannot drift the CI run.
#      --ignore-rules:       skip project + user .rules files (combine with
#                            an explicit -s if you do this).
#      -c key=value:         one-shot TOML overrides; nothing persisted.
codex exec \
  --ignore-user-config \
  --ignore-rules \
  -c approval_policy='"never"' \
  -s read-only \
  "Reply with one sentence confirming you are running with deterministic settings."

# 8c — Profiles let you name a bundle of settings. Show the pattern.
#      To enable: append the following to .codex/config.toml, then call
#         codex exec --profile ci "..."
cat <<'TOML'
# --- snippet for .codex/config.toml (DO NOT APPLY LIVE) ---
[profiles.ci]
model = "gpt-5.4"
sandbox_mode = "read-only"
approval_policy = "never"
model_reasoning_effort = "low"
# --- end snippet ---
TOML


# =============================================================================
# Demo 9 — Local OSS provider (Ollama / gpt-oss:20b)
# -----------------------------------------------------------------------------
# Talking points:
# - Not every task needs a frontier model. Routine summaries, log triage, and
#   first-pass classification can run locally — zero per-token cost, no data
#   leaving the machine.
# - --oss --local-provider ollama -m <model>: Codex points at the OpenAI-
#   compatible endpoint that Ollama exposes on localhost:11434.
# - Note: the startup line "ERROR codex_models_manager: missing field 'models'"
#   is cosmetic — Codex's model-list refresh expects a slightly different
#   shape than Ollama returns. The exec itself works.
# - Caveat: smaller OSS models are weaker at multi-step tool use. Pick tasks
#   accordingly (summarize, classify — yes; refactor a codebase — not yet).
# =============================================================================

# 9a — Same prompt as demo 1, but local & free.
codex exec \
  --oss --local-provider ollama -m gpt-oss:20b \
  -s read-only \
  "Give me a 5-bullet briefing about this repository: purpose, top-level layout, build tooling, test setup, and one risk hotspot. Under 150 words."

# 9b — A reasonable hybrid pattern: cheap local triage, escalate selectively.
#      Pseudo-code attendees can adapt:
#
#        tier=$(codex exec --oss --local-provider ollama -m gpt-oss:20b \
#                 --output-schema demo/schemas/risk.schema.json \
#                 -o /tmp/triage.json -s read-only "...")
#        if jq -e '.modules[] | select(.risk_level=="high")' /tmp/triage.json; then
#          codex exec -s read-only "...deeper review with the default model..."
#        fi


# =============================================================================
# Demo 10 — CI wiring: real GitHub Actions workflow
# -----------------------------------------------------------------------------
# Talking points:
# - Everything from demos 1–9 carries over verbatim into CI. The only new
#   piece is wiring: secrets, checkout, install, artifact upload, PR comment.
# - The workflow file lives at .github/workflows/codex-review.yml. It has
#   already been pushed and triggered (see top of this file for the run URL).
# - Read the workflow with attendees: trigger config, CODEX_API_KEY from
#   secrets, `codex exec --json -o review.md -s read-only ...`, artifact
#   upload, and `gh pr comment --body-file review.md` for the PR feedback
#   loop.
# - Same pattern scales to nightly health reports, release notes, dependency
#   triage — swap the prompt, keep the wiring.
# =============================================================================

# Show the workflow file to attendees.
sed -n '1,80p' .github/workflows/codex-review.yml

# Open the latest run in the browser (use the run URL captured during setup).
# gh run list --workflow codex-review.yml --limit 5
# gh run view <RUN_ID> --web

# Look at what the workflow produced (artifact download).
# gh run download <RUN_ID> -n codex-review -D /tmp/codex-review
# cat /tmp/codex-review/review.md

# =============================================================================
# End of demo script.
# Final state check — repo should be clean if you ran the cleanup blocks.
# =============================================================================
git --no-pager status

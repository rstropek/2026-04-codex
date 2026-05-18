# Testing — Layers and Tools

Tests are split by what they actually exercise, not by where the code lives.
Each layer has a different runner because each layer needs a different
environment.

## Three layers

### 1. Unit / integration tests in Node — Vitest

Lives in `packages/lib/src/**/*.test.ts` and (potentially)
`apps/*/src/**/*.test.ts`. Runs in plain Node, no DOM, no browser.

This is where the domain logic is verified: repository functions, validation
rules, results aggregation, sample-seeding determinism. Tests open an
in-memory SQLite via `createTestDb()` (exported from `@questionnaires/lib`) so
they are hermetic and fast — no fixture files, no shared state between tests.

**Anchor invariants here.** If something is true about the domain
(`unknown_qid` is rejected; soft-deleted rows are hidden by default; submission
counts increment by exactly one), it should be a Vitest test, not a UI test.
Vitest catches the regression closest to the code that broke.

Run: `pnpm test` (workspace) or `pnpm --filter @questionnaires/lib test`.

### 2. Component tests in a real browser — Vitest browser mode

Lives next to the component:
`apps/web/src/.../*.browser.test.tsx`. Runs Vitest with
`@vitest/browser-playwright` (Chromium, headless) and renders with
`vitest-browser-react`.

This layer exists for **interactive UI primitives** where the contract is
"does this thing behave correctly when a user clicks / types / focuses it?"
Currently that means the per-question-type input components
(`text-question-input`, `boolean-question-input`, `likert-question-input`).
Browser-mode tests use a real DOM, real layout, real events — `userEvent`
clicks fire actual mouse events, focus moves through the real focus tree.

This is intentionally separate from Vitest's Node runner: jsdom would lie
about half of what these components depend on (radio-group keyboard nav,
focus semantics, native form behavior). It is also separate from end-to-end
Playwright tests: there is no server, no routing, no database — just the
component in isolation.

Run: `pnpm test:components` (workspace) — not included in `pnpm test`
because it requires a Chromium download and is noticeably slower.

### 3. End-to-end tests against a real Next.js dev server — Playwright

Lives in `apps/web/tests/e2e/*.spec.ts`. Runs Playwright Test, which starts
`next dev` automatically via `webServer` and drives Chromium.

This layer verifies that the **pages wire up correctly to the lib**: the list
page reads from the DB, results pages render aggregated counts, the fill-out
form posts through a Server Action and redirects to the thank-you page. It
does *not* re-test domain rules — that's what Vitest covers.

E2E uses an isolated database. `tests/e2e/global-setup.ts`:

1. Builds `@questionnaires/lib` (otherwise stale `dist/` would silently
   break the dev server).
2. Deletes any previous `tmpdir()/questionnaires-e2e.db`.
3. Seeds a fresh DB via `seedSampleData(db, { seed: 42 })` for deterministic
   fixtures.
4. Exports its path as `E2E_DATABASE_URL`, which `playwright.config.ts`
   passes to `webServer.env.DATABASE_URL`.

The seed is fixed so submission counts and question prompts are stable across
runs. Tests that mutate state (`fill.spec.ts`) accept the mutation and only
assert on what they can observe deterministically (redirect URL, thank-you
heading), not on global counts.

Run: `pnpm test:e2e`. Not included in `pnpm test` (per AGENTS.md guideline
— Playwright runs only on explicit request).

## What goes where

| Question being asked | Layer |
| --- | --- |
| "Does this domain rule hold?" | Vitest (Node) |
| "Does this widget behave when clicked / typed into?" | Vitest browser |
| "Does this page render data from the DB?" | Playwright E2E |
| "Does the submission Server Action redirect?" | Playwright E2E |

If a test could be written at a lower layer with the same coverage, prefer
the lower layer — it's faster, deterministic, and the failure is easier to
diagnose.

## Why three runners

Two of these are Vitest; they share config style but use different `test`
configs (`vitest.config.ts` for Node, `vitest.browser.config.ts` for browser
mode). The third is Playwright because Vitest does not orchestrate a dev
server for you. We accept the duplication: each runner is good at what it
does, and merging them into one would mean compromising the fast Node path
to accommodate the slow browser path.

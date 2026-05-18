# Web UI

The Next.js app in `apps/web` is a thin layer over `@questionnaires/lib`. All
domain logic lives in the lib; the web app only handles routing, rendering, and
mapping form input into lib calls.

## Pages

| Route                                  | Kind                            | Lib calls                                     |
| -------------------------------------- | ------------------------------- | --------------------------------------------- |
| `/questionnaires`                      | Server component                | `listQuestionnaires`                          |
| `/questionnaires/[id]/results`         | Server component                | `getQuestionnaire`, `getQuestionnaireVersionResults` |
| `/questionnaires/[id]/fill`            | Server component + client form  | `getQuestionnaire`                            |
| `/questionnaires/[id]/fill` (submit)   | Server Action (`actions.ts`)    | `getQuestionnaire`, `submitAnswers`           |
| `/questionnaires/[id]/fill/thanks`     | Static confirmation             | —                                             |

The list page shows only non-deleted questionnaires that have at least one
published version. Each card links to the results view and the fill-out form.
The results view renders one card per question with a CSS-grid table; rendering
per question type is split into isolated components under
`results/_components/` (`text-result`, `boolean-result`, `likert-result`).

## DB bootstrap

`apps/web/src/server/db.ts` reads `DATABASE_URL` (absolute path; configured in
`apps/web/.env.local`), opens it with `createDb`, and runs `applyMigrations`.
The native SQLite handle is stored in a process-level singleton so requests
reuse one connection instead of leaking one per render. The public `getDb()`
call remains wrapped in `React.cache` so each request gets stable object
identity across its server components. If `DATABASE_URL` changes during a dev
session, the old handle is closed before a new one is opened. Pages that depend
on the DB are marked `export const dynamic = "force-dynamic"` so Next never
tries to prerender them against the database. `better-sqlite3` is in
`serverExternalPackages` so its native addon is loaded by Node at runtime
rather than bundled.

The console resolves the DB path through its own `INIT_CWD`/`--db` logic; the
web app uses an explicit env var instead because Next runs from `apps/web/`,
not the workspace root.

## Form components

Fill-out inputs are one component per question type, all under
`questionnaires/[id]/fill/_components/question-inputs/`:

- `text-question-input.tsx` — `<textarea>`
- `boolean-question-input.tsx` — Yes / No radios
- `likert-question-input.tsx` — radios `1..likertMax` with the low/high labels

`fill-form.tsx` dispatches to the right component per `Question.type` and
posts via the `submitAnswersAction` Server Action. The action re-fetches the
questionnaire, coerces `FormData` values into the appropriate `Answer`
discriminant, calls `submitAnswers`, and redirects to the thank-you page.

## Lib build

`@questionnaires/lib` ships compiled JavaScript from `packages/lib/dist/` (see
its `tsconfig.build.json` and `pnpm --filter @questionnaires/lib build`). The
web app consumes the package normally — no `transpilePackages` is needed, and
Next's default Turbopack pipeline works out of the box. Earlier we tried
pointing exports at raw `.ts` source, but Next's bundlers and `better-sqlite3`'s
native-addon loader don't compose with workspace-source packages.

Run `pnpm build` at the workspace root to build the lib (and any other
buildable packages) in topological order before building the web app.

## Testing

Two Vitest configs live side-by-side:

- `vitest.config.ts` — Node tests (`src/**/*.test.ts`). Run with `pnpm test`.
- `vitest.browser.config.ts` — Browser component tests
  (`src/**/*.browser.test.tsx`) using `@vitest/browser-playwright` (Chromium,
  headless) and `vitest-browser-react`. Run with `pnpm test:components`.

Each `question-input` component has a co-located `.browser.test.tsx` that
renders the component, exercises a user interaction (typing, selecting a
radio), and asserts the resulting DOM state via `expect.element` matchers.
Playwright E2E specs in `tests/e2e/` continue to run via `pnpm test:e2e`.

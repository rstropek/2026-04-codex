# Console CLI — Design Notes

`apps/console` exposes the questionnaire DAL as a JSON-in / JSON-out CLI.
It is intentionally minimal — the goal is shell-driven access to
`@questionnaires/lib`, not a second application.

## Thin-wrapper invariant (load-bearing)

The CLI contains **only** logic that belongs to a CLI:

- argv parsing (commander),
- input I/O (file path vs stdin pipe),
- JSON serialization of results,
- exit-code mapping,
- process lifecycle (open DB → migrate → close).

No domain logic lives here. Every operation goes through a function exported
by `@questionnaires/lib`. Input JSON is passed straight to the library — Zod
schemas inside the lib validate shape and content. Result objects are
JSON-stringified verbatim.

If a future change tempts you to compute something inside a command handler
that is not pure plumbing, treat that as a missing function in the lib and
add it there. Do not let the CLI grow a parallel notion of the domain.

## Command surface

Two groups, a maintenance command, plus an MCP server command:

- `questionnaire create | get | result | list | update | delete`
- `submission list | submit`
- `db migrate | sample`
- `mcp`

`create`, `update`, and `submit` take a JSON document via `--file <path>` or
piped stdin. Everything else is flag-driven. `questionnaire result --id <n>`
returns the current version's aggregated results; pass `--version <n>` to
inspect an older version. Run `pnpm console --help` or
`pnpm console <group> --help` for the live reference (commander generates it).

`db sample [--seed <n>]` seeds three realistic questionnaires (one with two
versions) plus 15–20 submissions each. It is **additive** — it never wipes
existing rows. `--seed` is optional; if omitted, a random seed is generated
and echoed in the output so the run is replayable. The generator itself
lives in `@questionnaires/lib` (`seedSampleData`) so the CLI handler stays
pure plumbing per the thin-wrapper invariant.

`mcp` runs a STDIO Model Context Protocol server for AI clients. It exposes
`questionnaire_list`, `questionnaire_get`, `questionnaire_result`, and
`submission_submit`, each backed by the same library functions as the CLI
commands above. Before calling `submission_submit`, clients must call
`questionnaire_get` to inspect the target questionnaire version and questions.
Submitted answers must use the returned qids, match each question type, answer
required questions, and respect likert ranges; otherwise the lib validation
rejects the submission. The MCP input schema models answer variants with
`anyOf` for the text, boolean, and likert answer shapes.

The same tool surface is available over Streamable HTTP in the Next.js app —
see `docs/web-mcp.md`. Both transports share the registration code in
`packages/lib/src/mcp.ts` so the tool set cannot drift.

## Output contract

- Success → JSON document on **stdout**, exit code `0`.
- Failure → JSON envelope on **stderr**, non-zero exit code:
  - `{ "error": { "type": "NotFoundError",   "message": ... } }` → exit `1`
  - `{ "error": { "type": "ValidationError", "message": ..., "issues": [...] } }` → exit `1`
  - `{ "error": { "type": "InputError",      "message": ... } }` → exit `2`
  - `{ "error": { "type": "UnknownError",    "message": ... } }` → exit `3`

`ValidationError.issues` is the array produced by the lib (`IssueCode` +
optional `qid` + `message` + optional `path`). The CLI does not rewrite issue
text; downstream tooling can branch on `code` directly.

## DB resolution

`--db <url>` → `DATABASE_URL` env → `<invoking-cwd>/questionnaire.db`. The
default anchors to `$INIT_CWD` (set by pnpm/npm to the directory the user ran
the script from), falling back to `process.cwd()`. This keeps `pnpm console`
from creating the DB inside `apps/console/` when run from the workspace root.
Every command opens
the DB and unconditionally calls `applyMigrations` before doing work; the
Drizzle migrator is idempotent, so this both creates a fresh DB on first use
and is a no-op on subsequent runs. The explicit `db migrate` command is the
same path with no follow-up work — useful for CI scripts that want to
provision then drop into a different process.

This implicit migrate-on-open is fine for a short-lived CLI. Do **not** copy
this pattern into a long-running server.

## Testability seam: `runCli`

`runCli(io)` is the testable entry. It accepts injected `stdin`/`stdout`/
`stderr`/`env`/`stdinIsTty` so tests can drive the CLI in-process and assert
on captured output. The default `argv` parse mode is `from: "user"`, so tests
pass plain argv arrays without faking `process.argv`.

`commander` is configured with `.exitOverride()` and `configureOutput()` so
that parse errors and `--help` never call `process.exit` directly — they
surface as `CommanderError` and exit codes returned from `runCli`.

### Why temp-file SQLite, not `:memory:`

Each CLI invocation opens its own SQLite handle. `:memory:` would give every
invocation a fresh, empty database — useless for a multi-step scenario.
Tests use `mkdtempSync` to allocate a temp dir, point `--db` at a file inside
it, and clean up in `afterEach`. The file path persists across the
invocations within one test, which is the property we actually need.

## Adding a new command

1. Add a handler in `src/commands/<group>.ts`. Signature: takes a
   `CommandContext` (stdin/stdout/stderr/env/stdinIsTty) and the parsed
   commander options object. Returns `void | Promise<void>`.
2. Register it in `src/index.ts` with `commander`. Use `requiredOption` for
   identifiers, `option` for flags. Always include `--db` so callers can
   override the global flag at subcommand level.
3. Inside the handler: read input (if any) via `readJsonInput`, open the DB
   via `openDb`, call the lib function, write JSON via `writeJson`, close
   the sqlite handle in a `finally`. Do not catch lib errors — `runCli`
   maps them via `toErrorPayload`.

If the new command needs anything beyond that recipe, the lib is the wrong
shape — fix it there, not here.

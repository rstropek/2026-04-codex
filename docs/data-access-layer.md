# Data Access Layer — Principles

Code lives in `packages/lib/src/`. All persistence logic stays
in this package, never in `apps/web` or `apps/console`.

## Storage model: relational frame, JSON payload

Three tables: `questionnaires`, `questionnaire_versions`, `submissions`. Each
table stores only what we need to query or join on relationally. The actual
question definitions and answer sets live in `questions_json` and
`answers_json` text columns. The choice is intentional: a hybrid relational +
document model driven by these properties of the domain:

- Question lists and answer sets are always read and written as whole blobs.
  No partial updates, no per-question queries.
- Question types are heterogeneous (Text / Boolean / Likert) with type-specific
  fields. A normalized table would force a sparse columns or an EAV pattern;
  JSON keeps the type-discriminated shape intact.
- Versioning replaces the entire question list. Storing v1 and v2 as two JSON
  blobs is more honest than overlaying rows in a normalized `questions` table
  with a `version_id` partition key.

Trade-off accepted: cannot SQL-filter or aggregate across individual questions
or answers. If reporting needs that, build it on top, don't denormalize back.

## Question identity within a version: `qid`

Questions inside `questions_json` carry a `qid` string assigned at write time
(currently `q1`, `q2`, … by position). Answers reference questions by `qid`.

- `qid`s are unique **within a version**, not globally.
- v1's `qid`s and v2's `qid`s share the same namespace by coincidence — they
  are NOT the same questions. Cross-version mixing of qids is a validation
  error (`unknown_qid`), and this is enforced by tests.
- Do not change the `qid` assignment strategy without thinking about migration:
  existing JSON blobs in production would still carry the old scheme.

## Versioning

- Every `updateQuestionnaire` inserts a new `questionnaire_versions` row with
  `version_number = max + 1` and rewrites `questionnaires.current_version_id`
  + `questionnaires.title`.
- Old versions are immutable. They must remain readable so historical
  submissions render correctly.
- `questionnaires.title` is the latest snapshot (for cheap listing).
  `questionnaire_versions.title` is the version-time snapshot (for historical
  rendering). Both are kept in sync inside `updateQuestionnaire`'s transaction.
- `questionnaires.current_version_id` is nullable only during the brief window
  between row creation and first version insert — both happen in the same
  transaction, so external readers never observe `null`.

## Soft delete

- `questionnaires.deleted_at` set to ISO timestamp; row stays. No row is ever
  physically removed by the DAL.
- `getQuestionnaire` and `listQuestionnaires` hide deleted rows by default;
  opt-in via `includeDeleted: true`.
- `submitAnswers` and `updateQuestionnaire` against a deleted questionnaire
  produce a `ValidationError` with code `questionnaire_deleted`, NOT a
  `NotFoundError`. The distinction matters: "doesn't exist" vs. "exists but
  not accepting writes".
- There is intentionally no restore function. If needed, add one. Don't
  bypass soft delete with raw SQL.

## Validation: Zod first, then cross-field

Every input that crosses the DAL boundary is parsed by a Zod schema in
`questionnaires/schemas.ts` BEFORE touching the database. This handles:

- Structural shape (required fields, discriminated unions on `type`)
- Primitive constraints (positive ints, min lengths, Likert `value >= 1`,
  Likert `max >= 3`)

Things Zod can't see - they need the questionnaire's actual question list -
are handled by `validateAnswers` in `questionnaires/validation.ts`:

- Required-question coverage (every required `qid` is answered)
- `qid` existence within the targeted version
- Answer type matches question type
- Likert `value <= question.likertMax` (upper bound is per-question, not global)
- Duplicate answers for the same `qid`

`validateAnswers` collects **all** issues and returns them as an array. It
does NOT short-circuit. The repository wraps that array in a `ValidationError`
so callers get the complete picture, not just the first problem. Tests
explicitly verify multi-issue aggregation; preserve that behavior.

Skip rule: when an answer is rejected as `wrong_answer_type`, do not also
report it as missing-required. The user gave an answer; the type is the issue.

## Errors

Two error classes, distinct semantics:

- `NotFoundError`: row doesn't exist (no questionnaire with that id, no
  version N for that questionnaire when reading).
- `ValidationError { issues: Issue[] }`: row exists but the operation can't
  proceed. Always carries one or more `Issue` records with a typed `code`.

Zod parse failures are wrapped as `ValidationError` with code `invalid_input`
and the Zod path preserved. This keeps callers from needing to know about
Zod's error shape.

## Transactions

Every multi-step write uses `db.transaction(...)`:

- `createQuestionnaire`: insert questionnaire → insert version → update
  questionnaire's `current_version_id`. All three or none.
- `updateQuestionnaire`: lookup latest version → insert new version → update
  questionnaire row.
- `submitAnswers`: load questionnaire + version → run validation → insert
  submission. The transaction is what makes the rollback-on-validation-failure
  guarantee real: a failed `submitAnswers` leaves no orphan submission row.
  This is tested.

better-sqlite3 transactions are synchronous, which is why the entire DAL is
synchronous. Do not add `await` inside transactions; do not switch the
repository to async without changing the driver.

## Driver and runtime

- `better-sqlite3` (synchronous, native module). Native build is gated by
  `pnpm.onlyBuiltDependencies` in the root `package.json`, if you re-add or
  reinstall, make sure that entry stays.
- `PRAGMA foreign_keys = ON` is set in `createDb`. The schema relies on this;
  do not remove.
- WAL is not enabled. Fine for single-process dev and tests. If a multi-process
  consumer appears, enable WAL there — don't make it the library default.

## Migrations

- Drizzle Kit. `drizzle.config.ts` lives in `packages/lib/`. Output:
  `packages/lib/migrations/`.
- Migrations are committed to the repo. Tests apply them against an in-memory
  SQLite DB (`createTestDb`). If you change `db/schema.ts`, run
  `pnpm db:generate` and commit the new migration file.
- Do not edit existing migration files. Add new ones.

## Testing pattern

- `createTestDb()` returns a fresh in-memory DB with migrations applied. Use
  it in `beforeEach`, not `beforeAll` — every test starts clean.
- Tests live next to the code they exercise (`*.test.ts` colocated under `src/`).
- Vitest picks them up via the default include glob.

## JSON shape evolution

- No `schema_version` field on JSON blobs. This is intentional for the demo;
  a comment in `questionnaires/json.ts` flags that production code would add
  one to support shape migrations.
- Read-time parsing goes through the same Zod schemas that write-time uses,
  so corrupted or stale JSON throws clearly.

## Conventions for adding to this layer

- New input types: add a Zod schema in `schemas.ts`, derive the TS type with
  `z.infer`, then use it in `repository.ts`. Do not write parallel TS types
  by hand.
- New repository functions: synchronous, take `db: QuestionnaireDb` as the
  first argument, wrap multi-step writes in `db.transaction`.
- New error conditions: extend `IssueCode` in `errors.ts` and produce them
  from `validation.ts` (cross-field) or from the repo (existence checks).
  Don't invent ad-hoc string codes.
- New tables: extend `db/schema.ts`, generate a migration, update barrel in
  `src/index.ts` if the table is part of the public surface.
- Public API surface is the `src/index.ts` barrel. The package also exposes
  subpaths `./db` and `./schema` via the `exports` map — use those for
  consumers that need the raw drizzle client or table definitions.
- Higher-level orchestration that composes existing repo functions (e.g. seeding,
  bulk import) lives in its own module and goes through the public repo API —
  see `questionnaires/sample.ts` for an example. Do not reach into the schema
  or write raw SQL from these helpers.

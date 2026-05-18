---
name: questionnaire-cli
description: >-
  How to drive the questionnaire data access layer from the shell via the
  `apps/console` CLI. Use this skill whenever the user wants to create, list,
  inspect, update, soft-delete questionnaires, view aggregated results, or
  submit/list answers from a terminal.
---

# questionnaire CLI

`apps/console` is a thin JSON-in / JSON-out wrapper around
`@questionnaires/lib`. All business logic lives in the lib; the CLI only
parses argv, reads/writes JSON, and maps errors to exit codes.

See `docs/console-cli.md` for design notes (thin-wrapper invariant, output
contract, how to add a command).

## Invocation

From the repo root:

```
pnpm console <group> <subcommand> [flags]
```

pnpm 10 forwards trailing args verbatim, so no `--` separator is needed.
Inside `apps/console`, you can also run `pnpm start <args>`.

### Discovering commands and flags

Commander generates `--help` (`-h`) for every level — use it as the live
reference instead of guessing flags:

```
pnpm console --help                  # top-level groups
pnpm console questionnaire --help    # subcommands of a group
pnpm console db sample -h            # leaf-command flags
```

### Global flag

`--db <url>` — optional. Resolution order: this flag → `$DATABASE_URL` env →
`<invoking-cwd>/questionnaire.db` (anchored to `$INIT_CWD` when run via
pnpm/npm scripts, otherwise `process.cwd()`). The DB is created and migrated
automatically on first use.

## Commands

All commands write a single JSON document to **stdout** on success (exit 0).
On failure, an error envelope goes to **stderr** with a non-zero exit (see
"Error shape" below).

### `questionnaire create`

Reads `CreateQuestionnaireInput` JSON from `--file <path>` or piped stdin.

```
pnpm console questionnaire create --file ./create.json
# or
cat create.json | pnpm console questionnaire create
```

Input shape:

```json
{
  "title": "Customer Feedback Q2",
  "questions": [
    { "type": "text",    "prompt": "What did you like?",  "required": true  },
    { "type": "boolean", "prompt": "Recommend us?",       "required": true  },
    { "type": "likert",  "prompt": "Satisfaction?",       "required": true,
      "likertMax": 4, "lowLabel": "Not at all", "highLabel": "Extremely" }
  ]
}
```

Output: `{ "id": number, "version": 1, "versionId": number }`.

### `questionnaire get --id <n> [--version <n>] [--include-deleted]`

Returns the full `Questionnaire` (metadata + parsed questions). Without
`--version`, returns the current version.

```
pnpm console questionnaire get --id 1
pnpm console questionnaire get --id 1 --version 1
```

### `questionnaire list [--include-deleted]`

Returns a `QuestionnaireSummary[]`. Soft-deleted rows are hidden unless
`--include-deleted` is set.

### `questionnaire result --id <n> [--version <n>]`

Returns the aggregated `QuestionnaireVersionResults` JSON from the lib:
metadata, submission count, and per-question results. Without `--version`,
the command uses the questionnaire's current version, matching the web
results page.

```
pnpm console questionnaire result --id 1
pnpm console questionnaire result --id 1 --version 1
```

### `questionnaire update --id <n>`

Reads `UpdateQuestionnaireInput` JSON from `--file` or stdin. Creates a new
version that fully replaces the question list.

Output: `{ "id": number, "version": number, "versionId": number }`.

### `questionnaire delete --id <n>`

Soft delete. Output: `{ "id": number, "deleted": true }`.

### `submission submit`

Reads `SubmitAnswersInput` JSON from `--file` or stdin.

```json
{
  "questionnaireId": 1,
  "version": 2,
  "answers": [
    { "qid": "q1", "type": "text",    "value": "Great support" },
    { "qid": "q2", "type": "boolean", "value": true },
    { "qid": "q3", "type": "likert",  "value": 4 }
  ]
}
```

`qid`s are assigned positionally by the lib (`q1`, `q2`, …) and are
**per-version** — fetch the version's questions first if you don't already
know them.

Output: `{ "submissionId": number }`.

### `submission list --questionnaire-id <n>`

Returns `Submission[]` across all versions, each tagged with its
`versionNumber` and parsed `answers`.

### `db migrate`

Apply pending migrations against the resolved DB without doing any other
work. Output: `{ "migrated": true, "db": "<resolved-url>" }`.

Useful for provisioning a DB in CI before running real commands.

### `db sample [--seed <n>]`

Fill the resolved DB with three realistic questionnaires (one has two
versions) plus 15–20 submissions each. Text answers come from faker;
booleans/likerts from a seeded RNG. The command is **additive** — it does
not wipe existing rows; point `--db` at a fresh file for a clean slate.

`--seed <n>` is optional. When omitted, a random integer is generated and
echoed in the output so the run is replayable.

```
pnpm console db sample --db /tmp/q.db --seed 42 | jq .
```

Output shape:

```json
{
  "seeded": true,
  "seed": 42,
  "questionnaires": [
    { "id": 1, "title": "Customer Feedback Q2",        "versions": [1, 2], "submissions": 18 },
    { "id": 2, "title": "Developer Onboarding Survey", "versions": [1],    "submissions": 19 },
    { "id": 3, "title": "Post-Incident Retrospective", "versions": [1],    "submissions": 15 }
  ]
}
```

The generator itself lives in `@questionnaires/lib` (`seedSampleData`); the
CLI handler is pure plumbing per the thin-wrapper invariant.

### `mcp [--db <url>]`

Run a STDIO Model Context Protocol server backed by the same library
functions as the CLI commands.

```
pnpm console mcp --db /tmp/q.db
```

Exposed tools:

- `questionnaire_list`
- `questionnaire_get`
- `questionnaire_result`
- `submission_submit`

Before calling `submission_submit`, an AI client must call
`questionnaire_get` to retrieve the target questionnaire version and its
questions. The submission must use the returned qids, match each question's
type, answer required questions, and keep likert values inside the question's
range; otherwise the server rejects it via lib validation. The MCP schema for
answers uses `anyOf` for the text, boolean, and likert answer shapes.

## Error shape

Errors are emitted as JSON on stderr. Branch on `error.type`:

```json
{
  "error": {
    "type": "NotFoundError" | "ValidationError" | "InputError" | "UnknownError",
    "message": "...",
    "issues": [{ "code": "missing_required_answer", "qid": "q3", "message": "..." }]
  }
}
```

Exit codes:

| Type             | Exit |
|------------------|------|
| NotFoundError    | 1    |
| ValidationError  | 1    |
| InputError       | 2    |
| UnknownError     | 3    |

`ValidationError.issues[].code` values come from the lib and include:
`questionnaire_deleted`, `version_not_found`, `missing_required_answer`,
`unknown_qid`, `duplicate_answer`, `wrong_answer_type`,
`likert_out_of_range`, `invalid_input`.

## `jq` recipes

Capture the new id from a create:

```
ID=$(pnpm console questionnaire create --file create.json | jq -r .id)
```

Count submissions per version:

```
pnpm console submission list --questionnaire-id $ID \
  | jq 'group_by(.versionNumber) | map({version: .[0].versionNumber, count: length})'
```

Show the current version's aggregated results:

```
pnpm console questionnaire result --id $ID | jq .
```

Inspect issues from a failed submit (stderr → JSON):

```
pnpm console submission submit --file bad.json 2>err.json
jq '.error.issues' err.json
```

## When *not* to use this CLI

- Inside `apps/web`: use the lib directly via Server Components / Server
  Actions. The CLI is for shells, not server runtime.
- Inside `packages/lib` itself or its tests: import the repository functions
  directly.

import { Command, CommanderError } from "commander";
import { cmdDbMigrate, cmdDbSample } from "./commands/db.js";
import {
  cmdCreate,
  cmdDelete,
  cmdGet,
  cmdList,
  cmdResult,
  cmdUpdate,
} from "./commands/questionnaire.js";
import {
  cmdSubmissionList,
  cmdSubmissionSubmit,
} from "./commands/submission.js";
import { writeError } from "./output.js";
import type { CliIo, CommandContext } from "./runtime.js";

export async function runCli(io: CliIo): Promise<number> {
  const stdin = io.stdin ?? process.stdin;
  const ctx: CommandContext = {
    stdin,
    stdout: io.stdout ?? process.stdout,
    stderr: io.stderr ?? process.stderr,
    env: io.env ?? process.env,
    stdinIsTty:
      io.stdinIsTty ??
      (stdin === process.stdin ? Boolean(process.stdin.isTTY) : false),
  };

  const program = new Command();
  program
    .name("questionnaire")
    .description("CLI for the questionnaire data access layer")
    .option(
      "--db <url>",
      "Database URL (defaults to $DATABASE_URL or <cwd>/questionnaire.db)",
    )
    .exitOverride()
    .configureOutput({
      writeOut: (str) => {
        ctx.stdout.write(str);
      },
      writeErr: (str) => {
        ctx.stderr.write(str);
      },
    });

  const questionnaire = program
    .command("questionnaire")
    .description("Manage questionnaires");

  questionnaire
    .command("create")
    .description("Create a questionnaire (reads JSON from --file or stdin)")
    .option("--db <url>", "Database URL")
    .option("--file <path>", "Path to JSON input file (otherwise read stdin)")
    .action(async (opts: { db?: string; file?: string }) => {
      await cmdCreate(ctx, mergeDb(program, opts));
    });

  questionnaire
    .command("get")
    .description("Get a questionnaire by id")
    .requiredOption("--id <n>", "Questionnaire id")
    .option("--version <n>", "Specific version number")
    .option("--include-deleted", "Include soft-deleted questionnaires")
    .option("--db <url>", "Database URL")
    .action(
      (opts: {
        db?: string;
        id: string;
        version?: string;
        includeDeleted?: boolean;
      }) => {
        cmdGet(ctx, mergeDb(program, opts));
      },
    );

  questionnaire
    .command("result")
    .description("Get aggregated results for a questionnaire version")
    .requiredOption("--id <n>", "Questionnaire id")
    .option("--version <n>", "Specific version number (defaults to current)")
    .option("--db <url>", "Database URL")
    .action((opts: { db?: string; id: string; version?: string }) => {
      cmdResult(ctx, mergeDb(program, opts));
    });

  questionnaire
    .command("list")
    .description("List questionnaires")
    .option("--include-deleted", "Include soft-deleted questionnaires")
    .option("--db <url>", "Database URL")
    .action((opts: { db?: string; includeDeleted?: boolean }) => {
      cmdList(ctx, mergeDb(program, opts));
    });

  questionnaire
    .command("update")
    .description("Update a questionnaire (creates a new version)")
    .requiredOption("--id <n>", "Questionnaire id")
    .option("--file <path>", "Path to JSON input file (otherwise read stdin)")
    .option("--db <url>", "Database URL")
    .action(async (opts: { db?: string; id: string; file?: string }) => {
      await cmdUpdate(ctx, mergeDb(program, opts));
    });

  questionnaire
    .command("delete")
    .description("Soft delete a questionnaire")
    .requiredOption("--id <n>", "Questionnaire id")
    .option("--db <url>", "Database URL")
    .action((opts: { db?: string; id: string }) => {
      cmdDelete(ctx, mergeDb(program, opts));
    });

  const submission = program
    .command("submission")
    .description("Manage answer submissions");

  submission
    .command("list")
    .description("List submissions for a questionnaire")
    .requiredOption("--questionnaire-id <n>", "Questionnaire id")
    .option("--db <url>", "Database URL")
    .action((opts: { db?: string; questionnaireId: string }) => {
      cmdSubmissionList(ctx, mergeDb(program, opts));
    });

  submission
    .command("submit")
    .description("Submit answers (reads JSON from --file or stdin)")
    .option("--file <path>", "Path to JSON input file (otherwise read stdin)")
    .option("--db <url>", "Database URL")
    .action(async (opts: { db?: string; file?: string }) => {
      await cmdSubmissionSubmit(ctx, mergeDb(program, opts));
    });

  const dbCmd = program.command("db").description("Database management");
  dbCmd
    .command("migrate")
    .description("Apply pending migrations")
    .option("--db <url>", "Database URL")
    .action((opts: { db?: string }) => {
      cmdDbMigrate(ctx, mergeDb(program, opts));
    });
  dbCmd
    .command("sample")
    .description("Fill the DB with realistic sample data")
    .option("--seed <n>", "Integer seed for reproducible data")
    .option("--db <url>", "Database URL")
    .action((opts: { db?: string; seed?: string }) => {
      cmdDbSample(ctx, mergeDb(program, opts));
    });

  try {
    await program.parseAsync(io.argv, { from: "user" });
    return 0;
  } catch (err) {
    if (err instanceof CommanderError) {
      return err.exitCode === 0 ? 0 : 2;
    }
    return writeError(ctx.stderr, err);
  }
}

function mergeDb<T extends { db?: string }>(program: Command, opts: T): T {
  if (opts.db !== undefined) return opts;
  const globalDb = program.opts<{ db?: string }>().db;
  if (globalDb !== undefined) {
    return { ...opts, db: globalDb };
  }
  return opts;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runCli({ argv: process.argv.slice(2) }).then(
    (code) => {
      process.exit(code);
    },
    (err: unknown) => {
      process.stderr.write(`${String(err)}\n`);
      process.exit(3);
    },
  );
}

import { listSubmissions, submitAnswers } from "@questionnaires/lib";
import { openDb } from "../db.js";
import { readJsonInput } from "../io.js";
import { writeJson } from "../output.js";
import type { CommandContext } from "../runtime.js";

export function cmdSubmissionList(
  ctx: CommandContext,
  opts: { db?: string; questionnaireId: string },
): void {
  const { db, sqlite } = openDb({ dbFlag: opts.db, env: ctx.env });
  try {
    const result = listSubmissions(db, Number(opts.questionnaireId));
    writeJson(ctx.stdout, result);
  } finally {
    sqlite.close();
  }
}

export async function cmdSubmissionSubmit(
  ctx: CommandContext,
  opts: { db?: string; file?: string },
): Promise<void> {
  const input = await readJsonInput({
    filePath: opts.file,
    stdin: ctx.stdin,
    stdinIsTty: ctx.stdinIsTty,
  });
  const { db, sqlite } = openDb({ dbFlag: opts.db, env: ctx.env });
  try {
    const result = submitAnswers(
      db,
      input as Parameters<typeof submitAnswers>[1],
    );
    writeJson(ctx.stdout, result);
  } finally {
    sqlite.close();
  }
}

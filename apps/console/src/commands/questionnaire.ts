import {
  createQuestionnaire,
  getQuestionnaire,
  getQuestionnaireVersionResults,
  listQuestionnaires,
  softDeleteQuestionnaire,
  updateQuestionnaire,
} from "@questionnaires/lib";
import { openDb } from "../db.js";
import { readJsonInput } from "../io.js";
import { writeJson } from "../output.js";
import type { CommandContext } from "../runtime.js";

export async function cmdCreate(
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
    // Pass JSON straight to the lib; Zod inside the lib validates.
    const result = createQuestionnaire(
      db,
      input as Parameters<typeof createQuestionnaire>[1],
    );
    writeJson(ctx.stdout, result);
  } finally {
    sqlite.close();
  }
}

export function cmdGet(
  ctx: CommandContext,
  opts: { db?: string; id: string; version?: string; includeDeleted?: boolean },
): void {
  const { db, sqlite } = openDb({ dbFlag: opts.db, env: ctx.env });
  try {
    const result = getQuestionnaire(db, Number(opts.id), {
      ...(opts.version !== undefined ? { version: Number(opts.version) } : {}),
      ...(opts.includeDeleted ? { includeDeleted: true } : {}),
    });
    writeJson(ctx.stdout, result);
  } finally {
    sqlite.close();
  }
}

export function cmdResult(
  ctx: CommandContext,
  opts: { db?: string; id: string; version?: string },
): void {
  const { db, sqlite } = openDb({ dbFlag: opts.db, env: ctx.env });
  try {
    const questionnaireId = Number(opts.id);
    const version =
      opts.version !== undefined
        ? Number(opts.version)
        : getQuestionnaire(db, questionnaireId).version.versionNumber;
    const result = getQuestionnaireVersionResults(db, questionnaireId, version);
    writeJson(ctx.stdout, result);
  } finally {
    sqlite.close();
  }
}

export function cmdList(
  ctx: CommandContext,
  opts: { db?: string; includeDeleted?: boolean },
): void {
  const { db, sqlite } = openDb({ dbFlag: opts.db, env: ctx.env });
  try {
    const result = listQuestionnaires(db, {
      ...(opts.includeDeleted ? { includeDeleted: true } : {}),
    });
    writeJson(ctx.stdout, result);
  } finally {
    sqlite.close();
  }
}

export async function cmdUpdate(
  ctx: CommandContext,
  opts: { db?: string; id: string; file?: string },
): Promise<void> {
  const input = await readJsonInput({
    filePath: opts.file,
    stdin: ctx.stdin,
    stdinIsTty: ctx.stdinIsTty,
  });
  const { db, sqlite } = openDb({ dbFlag: opts.db, env: ctx.env });
  try {
    const result = updateQuestionnaire(
      db,
      Number(opts.id),
      input as Parameters<typeof updateQuestionnaire>[2],
    );
    writeJson(ctx.stdout, result);
  } finally {
    sqlite.close();
  }
}

export function cmdDelete(
  ctx: CommandContext,
  opts: { db?: string; id: string },
): void {
  const { db, sqlite } = openDb({ dbFlag: opts.db, env: ctx.env });
  try {
    softDeleteQuestionnaire(db, Number(opts.id));
    writeJson(ctx.stdout, { id: Number(opts.id), deleted: true });
  } finally {
    sqlite.close();
  }
}

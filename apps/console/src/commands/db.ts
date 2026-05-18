import { seedSampleData } from "@questionnaires/lib";
import { openDb } from "../db.js";
import { writeJson } from "../output.js";
import type { CommandContext } from "../runtime.js";

export function cmdDbMigrate(ctx: CommandContext, opts: { db?: string }): void {
  const { sqlite, url } = openDb({ dbFlag: opts.db, env: ctx.env });
  try {
    writeJson(ctx.stdout, { migrated: true, db: url });
  } finally {
    sqlite.close();
  }
}

export function cmdDbSample(
  ctx: CommandContext,
  opts: { db?: string; seed?: string },
): void {
  const { db, sqlite } = openDb({ dbFlag: opts.db, env: ctx.env });
  try {
    const result = seedSampleData(
      db,
      opts.seed !== undefined ? { seed: Number(opts.seed) } : {},
    );
    writeJson(ctx.stdout, { seeded: true, ...result });
  } finally {
    sqlite.close();
  }
}

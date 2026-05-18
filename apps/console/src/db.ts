import path from "node:path";
import { applyMigrations, type CreatedDb, createDb } from "@questionnaires/lib";

export type ResolveDbOptions = {
  dbFlag?: string | undefined;
  env: NodeJS.ProcessEnv;
};

export function resolveDbUrl(opts: ResolveDbOptions): string {
  if (opts.dbFlag) return opts.dbFlag;
  if (opts.env.DATABASE_URL) return opts.env.DATABASE_URL;
  const root = opts.env.INIT_CWD ?? process.cwd();
  return path.join(root, "questionnaire.db");
}

export function openDb(opts: ResolveDbOptions): CreatedDb & { url: string } {
  const url = resolveDbUrl(opts);
  const created = createDb(url);
  applyMigrations(created.db);
  return { ...created, url };
}

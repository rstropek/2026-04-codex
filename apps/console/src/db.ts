import { applyMigrations, type CreatedDb, createDb } from "@questionnaires/lib";

export type ResolveDbOptions = {
  dbFlag?: string | undefined;
  env: NodeJS.ProcessEnv;
};

export function resolveDbUrl(opts: ResolveDbOptions): string {
  return opts.dbFlag ?? opts.env.DATABASE_URL ?? "./questionnaire.db";
}

export function openDb(opts: ResolveDbOptions): CreatedDb & { url: string } {
  const url = resolveDbUrl(opts);
  const created = createDb(url);
  applyMigrations(created.db);
  return { ...created, url };
}

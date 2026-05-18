import {
  applyMigrations,
  type CreatedDb,
  createDb,
  type QuestionnaireDb,
} from "@questionnaires/lib";
import { cache } from "react";

type WebDb = CreatedDb & { url: string };

const globalForDb = globalThis as typeof globalThis & {
  __questionnairesDb?: WebDb;
};

function resolveDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Configure it in apps/web/.env.local (absolute path to the questionnaire.db file).",
    );
  }
  return url;
}

export const getDb = cache((): { db: QuestionnaireDb; url: string } => {
  const url = resolveDbUrl();
  const existing = globalForDb.__questionnairesDb;
  if (existing?.url === url) {
    return { db: existing.db, url };
  }

  existing?.sqlite.close();

  const created = createDb(url);
  try {
    applyMigrations(created.db);
    globalForDb.__questionnairesDb = { ...created, url };
    return { db: created.db, url };
  } catch (error) {
    created.sqlite.close();
    throw error;
  }
});

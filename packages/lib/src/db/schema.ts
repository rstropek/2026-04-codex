import { relations, sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const questionnaires = sqliteTable("questionnaires", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  currentVersionId: integer("current_version_id").references(
    (): AnySQLiteColumn => questionnaireVersions.id,
  ),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const questionnaireVersions = sqliteTable(
  "questionnaire_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    questionnaireId: integer("questionnaire_id")
      .notNull()
      .references(() => questionnaires.id),
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    questionsJson: text("questions_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex(
      "questionnaire_versions_questionnaire_id_version_number_unique",
    ).on(table.questionnaireId, table.versionNumber),
  ],
);

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  questionnaireId: integer("questionnaire_id")
    .notNull()
    .references(() => questionnaires.id),
  versionId: integer("version_id")
    .notNull()
    .references(() => questionnaireVersions.id),
  versionNumber: integer("version_number").notNull(),
  answersJson: text("answers_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const questionnairesRelations = relations(
  questionnaires,
  ({ many, one }) => ({
    versions: many(questionnaireVersions),
    currentVersion: one(questionnaireVersions, {
      fields: [questionnaires.currentVersionId],
      references: [questionnaireVersions.id],
    }),
    submissions: many(submissions),
  }),
);

export const questionnaireVersionsRelations = relations(
  questionnaireVersions,
  ({ one, many }) => ({
    questionnaire: one(questionnaires, {
      fields: [questionnaireVersions.questionnaireId],
      references: [questionnaires.id],
    }),
    submissions: many(submissions),
  }),
);

export const submissionsRelations = relations(submissions, ({ one }) => ({
  questionnaire: one(questionnaires, {
    fields: [submissions.questionnaireId],
    references: [questionnaires.id],
  }),
  version: one(questionnaireVersions, {
    fields: [submissions.versionId],
    references: [questionnaireVersions.id],
  }),
}));

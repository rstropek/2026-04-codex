import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import type { QuestionnaireDb } from "../db/client.js";
import {
  questionnaires,
  questionnaireVersions,
  submissions,
} from "../db/schema.js";
import { type Issue, NotFoundError, ValidationError } from "./errors.js";
import {
  parseAnswersJson,
  parseQuestionsJson,
  serializeAnswers,
  serializeQuestions,
} from "./json.js";
import {
  type CreateQuestionnaireInput,
  CreateQuestionnaireInputSchema,
  type NewQuestionInput,
  type Question,
  type SubmitAnswersInput,
  SubmitAnswersInputSchema,
  type UpdateQuestionnaireInput,
  UpdateQuestionnaireInputSchema,
} from "./schemas.js";
import type {
  Questionnaire,
  QuestionnaireSummary,
  Submission,
} from "./types.js";
import { validateAnswers } from "./validation.js";

function zodIssuesToIssues(error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({
    code: "invalid_input",
    message: i.message,
    path: i.path.map((segment) =>
      typeof segment === "symbol" ? String(segment) : segment,
    ),
  }));
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(zodIssuesToIssues(result.error));
  }
  return result.data;
}

function assignQids(inputs: NewQuestionInput[]): Question[] {
  return inputs.map((q, i) => ({ ...q, qid: `q${i + 1}` }) as Question);
}

export function createQuestionnaire(
  db: QuestionnaireDb,
  input: CreateQuestionnaireInput,
): { id: number; version: 1; versionId: number } {
  const parsed = parseOrThrow(CreateQuestionnaireInputSchema, input);
  const questions = assignQids(parsed.questions);
  const questionsJson = serializeQuestions(questions);

  return db.transaction((tx) => {
    const inserted = tx
      .insert(questionnaires)
      .values({ title: parsed.title })
      .returning({ id: questionnaires.id })
      .get();

    const version = tx
      .insert(questionnaireVersions)
      .values({
        questionnaireId: inserted.id,
        versionNumber: 1,
        title: parsed.title,
        questionsJson,
      })
      .returning({ id: questionnaireVersions.id })
      .get();

    tx.update(questionnaires)
      .set({ currentVersionId: version.id })
      .where(eq(questionnaires.id, inserted.id))
      .run();

    return { id: inserted.id, version: 1 as const, versionId: version.id };
  });
}

export function updateQuestionnaire(
  db: QuestionnaireDb,
  id: number,
  input: UpdateQuestionnaireInput,
): { id: number; version: number; versionId: number } {
  const parsed = parseOrThrow(UpdateQuestionnaireInputSchema, input);
  const questions = assignQids(parsed.questions);
  const questionsJson = serializeQuestions(questions);

  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(questionnaires)
      .where(eq(questionnaires.id, id))
      .get();
    if (!existing) {
      throw new NotFoundError(`Questionnaire ${id} not found`);
    }
    if (existing.deletedAt !== null) {
      throw new ValidationError([
        {
          code: "questionnaire_deleted",
          message: `Questionnaire ${id} is deleted`,
        },
      ]);
    }

    const latest = tx
      .select({ versionNumber: questionnaireVersions.versionNumber })
      .from(questionnaireVersions)
      .where(eq(questionnaireVersions.questionnaireId, id))
      .orderBy(desc(questionnaireVersions.versionNumber))
      .limit(1)
      .get();

    const nextVersion = (latest?.versionNumber ?? 0) + 1;

    const version = tx
      .insert(questionnaireVersions)
      .values({
        questionnaireId: id,
        versionNumber: nextVersion,
        title: parsed.title,
        questionsJson,
      })
      .returning({ id: questionnaireVersions.id })
      .get();

    tx.update(questionnaires)
      .set({ title: parsed.title, currentVersionId: version.id })
      .where(eq(questionnaires.id, id))
      .run();

    return { id, version: nextVersion, versionId: version.id };
  });
}

export function softDeleteQuestionnaire(db: QuestionnaireDb, id: number): void {
  const updated = db
    .update(questionnaires)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(eq(questionnaires.id, id), isNull(questionnaires.deletedAt)))
    .returning({ id: questionnaires.id })
    .all();
  if (updated.length === 0) {
    const exists = db
      .select({ id: questionnaires.id })
      .from(questionnaires)
      .where(eq(questionnaires.id, id))
      .get();
    if (!exists) {
      throw new NotFoundError(`Questionnaire ${id} not found`);
    }
  }
}

export interface GetQuestionnaireOptions {
  version?: number;
  includeDeleted?: boolean;
}

export function getQuestionnaire(
  db: QuestionnaireDb,
  id: number,
  opts: GetQuestionnaireOptions = {},
): Questionnaire {
  const row = db
    .select()
    .from(questionnaires)
    .where(eq(questionnaires.id, id))
    .get();
  if (!row) {
    throw new NotFoundError(`Questionnaire ${id} not found`);
  }
  if (row.deletedAt !== null && !opts.includeDeleted) {
    throw new NotFoundError(`Questionnaire ${id} is deleted`);
  }

  const versionRow =
    opts.version !== undefined
      ? db
          .select()
          .from(questionnaireVersions)
          .where(
            and(
              eq(questionnaireVersions.questionnaireId, id),
              eq(questionnaireVersions.versionNumber, opts.version),
            ),
          )
          .get()
      : row.currentVersionId !== null
        ? db
            .select()
            .from(questionnaireVersions)
            .where(eq(questionnaireVersions.id, row.currentVersionId))
            .get()
        : undefined;

  if (!versionRow) {
    throw new NotFoundError(
      opts.version !== undefined
        ? `Version ${opts.version} not found for questionnaire ${id}`
        : `Questionnaire ${id} has no version`,
    );
  }

  return {
    id: row.id,
    title: row.title,
    deletedAt: row.deletedAt,
    version: {
      id: versionRow.id,
      versionNumber: versionRow.versionNumber,
      title: versionRow.title,
      createdAt: versionRow.createdAt,
    },
    questions: parseQuestionsJson(versionRow.questionsJson),
  };
}

export interface ListQuestionnairesOptions {
  includeDeleted?: boolean;
}

export function listQuestionnaires(
  db: QuestionnaireDb,
  opts: ListQuestionnairesOptions = {},
): QuestionnaireSummary[] {
  const rows = db
    .select({
      id: questionnaires.id,
      title: questionnaires.title,
      createdAt: questionnaires.createdAt,
      deletedAt: questionnaires.deletedAt,
      currentVersion: questionnaireVersions.versionNumber,
    })
    .from(questionnaires)
    .leftJoin(
      questionnaireVersions,
      eq(questionnaires.currentVersionId, questionnaireVersions.id),
    )
    .where(opts.includeDeleted ? undefined : isNull(questionnaires.deletedAt))
    .orderBy(asc(questionnaires.id))
    .all();

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    currentVersion: r.currentVersion ?? null,
    createdAt: r.createdAt,
    deletedAt: r.deletedAt,
  }));
}

export function submitAnswers(
  db: QuestionnaireDb,
  input: SubmitAnswersInput,
): { submissionId: number } {
  const parsed = parseOrThrow(SubmitAnswersInputSchema, input);

  return db.transaction((tx) => {
    const q = tx
      .select()
      .from(questionnaires)
      .where(eq(questionnaires.id, parsed.questionnaireId))
      .get();
    if (!q) {
      throw new NotFoundError(
        `Questionnaire ${parsed.questionnaireId} not found`,
      );
    }
    if (q.deletedAt !== null) {
      throw new ValidationError([
        {
          code: "questionnaire_deleted",
          message: `Questionnaire ${parsed.questionnaireId} is deleted`,
        },
      ]);
    }

    const versionRow = tx
      .select()
      .from(questionnaireVersions)
      .where(
        and(
          eq(questionnaireVersions.questionnaireId, parsed.questionnaireId),
          eq(questionnaireVersions.versionNumber, parsed.version),
        ),
      )
      .get();
    if (!versionRow) {
      throw new ValidationError([
        {
          code: "version_not_found",
          message: `Version ${parsed.version} not found for questionnaire ${parsed.questionnaireId}`,
        },
      ]);
    }

    const questions = parseQuestionsJson(versionRow.questionsJson);
    const issues = validateAnswers(questions, parsed.answers);
    if (issues.length > 0) {
      throw new ValidationError(issues);
    }

    const inserted = tx
      .insert(submissions)
      .values({
        questionnaireId: parsed.questionnaireId,
        versionId: versionRow.id,
        versionNumber: parsed.version,
        answersJson: serializeAnswers(parsed.answers),
      })
      .returning({ id: submissions.id })
      .get();

    return { submissionId: inserted.id };
  });
}

export function listSubmissions(
  db: QuestionnaireDb,
  questionnaireId: number,
): Submission[] {
  const rows = db
    .select()
    .from(submissions)
    .where(eq(submissions.questionnaireId, questionnaireId))
    .orderBy(asc(submissions.id))
    .all();

  return rows.map((r) => ({
    id: r.id,
    questionnaireId: r.questionnaireId,
    versionNumber: r.versionNumber,
    createdAt: r.createdAt,
    answers: parseAnswersJson(r.answersJson),
  }));
}

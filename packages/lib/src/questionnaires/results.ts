import { and, asc, eq } from "drizzle-orm";
import type { QuestionnaireDb } from "../db/client.js";
import {
  questionnaires,
  questionnaireVersions,
  submissions,
} from "../db/schema.js";
import { NotFoundError } from "./errors.js";
import { parseAnswersJson, parseQuestionsJson } from "./json.js";
import type { Answer, Question } from "./schemas.js";

export type TextQuestionResult = {
  qid: string;
  type: "text";
  prompt: string;
  required: boolean;
  /** Non-empty text answers, in submission order. */
  answers: string[];
  /** Submissions where the answer was missing or blank/whitespace-only. */
  emptyCount: number;
};

export type BooleanQuestionResult = {
  qid: string;
  type: "boolean";
  prompt: string;
  required: boolean;
  trueCount: number;
  falseCount: number;
  /** Submissions that did not answer this question. */
  emptyCount: number;
};

export type LikertQuestionResult = {
  qid: string;
  type: "likert";
  prompt: string;
  required: boolean;
  likertMax: number;
  lowLabel: string;
  highLabel: string;
  /** counts[i] = submissions answering value `i + 1`. Length = likertMax. */
  counts: number[];
  /** Submissions that did not answer this question. */
  emptyCount: number;
};

export type QuestionResult =
  | TextQuestionResult
  | BooleanQuestionResult
  | LikertQuestionResult;

export type QuestionnaireVersionResults = {
  questionnaireId: number;
  questionnaireTitle: string;
  versionId: number;
  versionNumber: number;
  versionTitle: string;
  submissionCount: number;
  questions: QuestionResult[];
};

function emptyResult(q: Question): QuestionResult {
  if (q.type === "text") {
    return {
      qid: q.qid,
      type: "text",
      prompt: q.prompt,
      required: q.required,
      answers: [],
      emptyCount: 0,
    };
  }
  if (q.type === "boolean") {
    return {
      qid: q.qid,
      type: "boolean",
      prompt: q.prompt,
      required: q.required,
      trueCount: 0,
      falseCount: 0,
      emptyCount: 0,
    };
  }
  return {
    qid: q.qid,
    type: "likert",
    prompt: q.prompt,
    required: q.required,
    likertMax: q.likertMax,
    lowLabel: q.lowLabel,
    highLabel: q.highLabel,
    counts: Array.from({ length: q.likertMax }, () => 0),
    emptyCount: 0,
  };
}

function applyAnswer(result: QuestionResult, answer: Answer | undefined): void {
  if (result.type === "text") {
    if (!answer || answer.type !== "text") {
      result.emptyCount++;
      return;
    }
    const trimmed = answer.value.trim();
    if (trimmed.length === 0) {
      result.emptyCount++;
      return;
    }
    result.answers.push(answer.value);
    return;
  }
  if (result.type === "boolean") {
    if (!answer || answer.type !== "boolean") {
      result.emptyCount++;
      return;
    }
    if (answer.value) result.trueCount++;
    else result.falseCount++;
    return;
  }
  // likert
  if (!answer || answer.type !== "likert") {
    result.emptyCount++;
    return;
  }
  if (answer.value < 1 || answer.value > result.likertMax) {
    // out-of-range answers shouldn't exist past validation, but be defensive
    result.emptyCount++;
    return;
  }
  const idx = answer.value - 1;
  result.counts[idx] = (result.counts[idx] ?? 0) + 1;
}

export function getQuestionnaireVersionResults(
  db: QuestionnaireDb,
  questionnaireId: number,
  version: number,
): QuestionnaireVersionResults {
  const questionnaire = db
    .select()
    .from(questionnaires)
    .where(eq(questionnaires.id, questionnaireId))
    .get();
  if (!questionnaire) {
    throw new NotFoundError(`Questionnaire ${questionnaireId} not found`);
  }

  const versionRow = db
    .select()
    .from(questionnaireVersions)
    .where(
      and(
        eq(questionnaireVersions.questionnaireId, questionnaireId),
        eq(questionnaireVersions.versionNumber, version),
      ),
    )
    .get();
  if (!versionRow) {
    throw new NotFoundError(
      `Version ${version} not found for questionnaire ${questionnaireId}`,
    );
  }

  const questions = parseQuestionsJson(versionRow.questionsJson);
  const results = questions.map(emptyResult);

  const subRows = db
    .select({ answersJson: submissions.answersJson })
    .from(submissions)
    .where(
      and(
        eq(submissions.questionnaireId, questionnaireId),
        eq(submissions.versionId, versionRow.id),
      ),
    )
    .orderBy(asc(submissions.id))
    .all();

  for (const row of subRows) {
    const answers = parseAnswersJson(row.answersJson);
    const answersByQid = new Map(answers.map((a) => [a.qid, a] as const));
    for (const result of results) {
      applyAnswer(result, answersByQid.get(result.qid));
    }
  }

  return {
    questionnaireId,
    questionnaireTitle: questionnaire.title,
    versionId: versionRow.id,
    versionNumber: versionRow.versionNumber,
    versionTitle: versionRow.title,
    submissionCount: subRows.length,
    questions: results,
  };
}

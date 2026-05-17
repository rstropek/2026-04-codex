// NOTE: For this demo we store questions and answers as plain JSON without a
// schema_version field. In production code we would embed a schema_version so
// that the on-disk JSON shape can be evolved with explicit migrations.

import type { Answer, Question } from "./schemas.js";
import { AnswersJsonSchema, QuestionsJsonSchema } from "./schemas.js";

export function serializeQuestions(questions: Question[]): string {
  return JSON.stringify(questions);
}

export function parseQuestionsJson(raw: string): Question[] {
  const data = JSON.parse(raw);
  return QuestionsJsonSchema.parse(data);
}

export function serializeAnswers(answers: Answer[]): string {
  return JSON.stringify(answers);
}

export function parseAnswersJson(raw: string): Answer[] {
  const data = JSON.parse(raw);
  return AnswersJsonSchema.parse(data);
}

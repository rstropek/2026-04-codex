import { z } from "zod";

const baseQuestionFields = {
  prompt: z.string().min(1),
  required: z.boolean(),
};

const baseQuestionWithQid = {
  qid: z.string().min(1),
  ...baseQuestionFields,
};

export const NewTextQuestionSchema = z.object({
  type: z.literal("text"),
  ...baseQuestionFields,
});

export const NewBooleanQuestionSchema = z.object({
  type: z.literal("boolean"),
  ...baseQuestionFields,
});

export const NewLikertQuestionSchema = z.object({
  type: z.literal("likert"),
  ...baseQuestionFields,
  likertMax: z.int().min(3),
  lowLabel: z.string().min(1),
  highLabel: z.string().min(1),
});

export const NewQuestionInputSchema = z.discriminatedUnion("type", [
  NewTextQuestionSchema,
  NewBooleanQuestionSchema,
  NewLikertQuestionSchema,
]);

export const TextQuestionSchema = z.object({
  type: z.literal("text"),
  ...baseQuestionWithQid,
});

export const BooleanQuestionSchema = z.object({
  type: z.literal("boolean"),
  ...baseQuestionWithQid,
});

export const LikertQuestionSchema = z.object({
  type: z.literal("likert"),
  ...baseQuestionWithQid,
  likertMax: z.int().min(3),
  lowLabel: z.string().min(1),
  highLabel: z.string().min(1),
});

export const QuestionSchema = z.discriminatedUnion("type", [
  TextQuestionSchema,
  BooleanQuestionSchema,
  LikertQuestionSchema,
]);

export const QuestionsJsonSchema = z.array(QuestionSchema);

export const CreateQuestionnaireInputSchema = z.object({
  title: z.string().min(1),
  questions: z.array(NewQuestionInputSchema).min(1),
});

export const UpdateQuestionnaireInputSchema = CreateQuestionnaireInputSchema;

export const TextAnswerSchema = z.object({
  qid: z.string().min(1),
  type: z.literal("text"),
  value: z.string(),
});

export const BooleanAnswerSchema = z.object({
  qid: z.string().min(1),
  type: z.literal("boolean"),
  value: z.boolean(),
});

export const LikertAnswerSchema = z.object({
  qid: z.string().min(1),
  type: z.literal("likert"),
  value: z.int().min(1),
});

export const AnswerSchema = z.discriminatedUnion("type", [
  TextAnswerSchema,
  BooleanAnswerSchema,
  LikertAnswerSchema,
]);

export const AnswersJsonSchema = z.array(AnswerSchema);

export const SubmitAnswersInputSchema = z.object({
  questionnaireId: z.int().positive(),
  version: z.int().positive(),
  answers: z.array(AnswerSchema),
});

export type NewQuestionInput = z.infer<typeof NewQuestionInputSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type CreateQuestionnaireInput = z.infer<
  typeof CreateQuestionnaireInputSchema
>;
export type UpdateQuestionnaireInput = z.infer<
  typeof UpdateQuestionnaireInputSchema
>;
export type Answer = z.infer<typeof AnswerSchema>;
export type SubmitAnswersInput = z.infer<typeof SubmitAnswersInputSchema>;

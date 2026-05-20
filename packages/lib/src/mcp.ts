import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuestionnaireDb } from "./db/client.js";
import { NotFoundError, ValidationError } from "./questionnaires/errors.js";
import {
  getQuestionnaire,
  listQuestionnaires,
  submitAnswers,
} from "./questionnaires/repository.js";
import { getQuestionnaireVersionResults } from "./questionnaires/results.js";

const textAnswerSchema = z.object({
  qid: z.string().min(1).describe("Question id from questionnaire_get."),
  type: z.literal("text"),
  value: z.string(),
});

const booleanAnswerSchema = z.object({
  qid: z.string().min(1).describe("Question id from questionnaire_get."),
  type: z.literal("boolean"),
  value: z.boolean(),
});

const likertAnswerSchema = z.object({
  qid: z.string().min(1).describe("Question id from questionnaire_get."),
  type: z.literal("likert"),
  value: z.int().min(1),
});

const answerSchema = z.union([
  textAnswerSchema,
  booleanAnswerSchema,
  likertAnswerSchema,
]);

export type McpErrorPayload = {
  error: { type: string; message: string; issues?: unknown };
};

export function defaultMcpErrorPayload(err: unknown): McpErrorPayload {
  if (err instanceof NotFoundError) {
    return { error: { type: "NotFoundError", message: err.message } };
  }
  if (err instanceof ValidationError) {
    return {
      error: {
        type: "ValidationError",
        message: err.message,
        issues: err.issues,
      },
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { error: { type: "UnknownError", message } };
}

export type RegisterMcpToolsDeps = {
  getDb: () => QuestionnaireDb;
  onError?: (err: unknown) => McpErrorPayload;
};

export const MCP_SERVER_INSTRUCTIONS =
  "Use questionnaire_get before submission_submit to inspect the questionnaire version, question qids, required flags, answer types, and likert ranges. submission_submit rejects answers that do not match that structure.";

export function registerQuestionnaireMcpTools(
  server: McpServer,
  deps: RegisterMcpToolsDeps,
): void {
  const toErrorPayload = deps.onError ?? defaultMcpErrorPayload;

  function runTool<T>(action: (db: QuestionnaireDb) => T) {
    try {
      const db = deps.getDb();
      const result = action(db);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: { result },
      };
    } catch (err) {
      const payload = toErrorPayload(err);
      return {
        isError: true,
        content: [
          { type: "text" as const, text: JSON.stringify(payload, null, 2) },
        ],
        structuredContent: payload,
      };
    }
  }

  server.registerTool(
    "questionnaire_list",
    {
      title: "List questionnaires",
      description:
        "List questionnaires, equivalent to the CLI command questionnaire list.",
      inputSchema: z.object({
        includeDeleted: z
          .boolean()
          .optional()
          .describe("Include soft-deleted questionnaires."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ includeDeleted }) =>
      runTool((db) =>
        listQuestionnaires(db, {
          ...(includeDeleted ? { includeDeleted: true } : {}),
        }),
      ),
  );

  server.registerTool(
    "questionnaire_get",
    {
      title: "Get questionnaire",
      description:
        "Get a questionnaire and its questions by id, equivalent to the CLI command questionnaire get.",
      inputSchema: z.object({
        id: z.int().positive().describe("Questionnaire id."),
        version: z
          .int()
          .positive()
          .optional()
          .describe(
            "Specific version number. Defaults to the current version.",
          ),
        includeDeleted: z
          .boolean()
          .optional()
          .describe("Include soft-deleted questionnaires."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ id, version, includeDeleted }) =>
      runTool((db) =>
        getQuestionnaire(db, id, {
          ...(version !== undefined ? { version } : {}),
          ...(includeDeleted ? { includeDeleted: true } : {}),
        }),
      ),
  );

  server.registerTool(
    "questionnaire_result",
    {
      title: "Get questionnaire result",
      description:
        "Get aggregated results for a questionnaire version, equivalent to the CLI command questionnaire result.",
      inputSchema: z.object({
        id: z.int().positive().describe("Questionnaire id."),
        version: z
          .int()
          .positive()
          .optional()
          .describe(
            "Specific version number. Defaults to the current version.",
          ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ id, version }) =>
      runTool((db) => {
        const resolvedVersion =
          version ?? getQuestionnaire(db, id).version.versionNumber;
        return getQuestionnaireVersionResults(db, id, resolvedVersion);
      }),
  );

  server.registerTool(
    "submission_submit",
    {
      title: "Submit questionnaire answers",
      description:
        "Submit answers, equivalent to the CLI command submission submit. Before calling this tool, an AI client must call questionnaire_get to retrieve the questionnaire version and its questions. The submitted answers must fit that questionnaire structure: use the returned qids, answer every required question, match each question's type, and keep likert values within the question's range. The server rejects submissions that do not match the questionnaire structure.",
      inputSchema: z.object({
        questionnaireId: z.int().positive().describe("Questionnaire id."),
        version: z
          .int()
          .positive()
          .describe(
            "Questionnaire version number returned by questionnaire_get.",
          ),
        answers: z
          .array(answerSchema)
          .describe(
            "Answers matching the questionnaire_get questions. The JSON schema uses anyOf for text, boolean, and likert answers.",
          ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (input) => runTool((db) => submitAnswers(db, input)),
  );
}

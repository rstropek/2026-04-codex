import {
  type Issue,
  NotFoundError,
  ValidationError,
} from "@questionnaires/lib";

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export interface ErrorPayload {
  error: {
    type: string;
    message: string;
    issues?: Issue[];
  };
}

export function toErrorPayload(err: unknown): {
  payload: ErrorPayload;
  exitCode: number;
} {
  if (err instanceof NotFoundError) {
    return {
      payload: { error: { type: "NotFoundError", message: err.message } },
      exitCode: 1,
    };
  }
  if (err instanceof ValidationError) {
    return {
      payload: {
        error: {
          type: "ValidationError",
          message: err.message,
          issues: err.issues,
        },
      },
      exitCode: 1,
    };
  }
  if (err instanceof InputError) {
    return {
      payload: { error: { type: "InputError", message: err.message } },
      exitCode: 2,
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    payload: { error: { type: "UnknownError", message } },
    exitCode: 3,
  };
}

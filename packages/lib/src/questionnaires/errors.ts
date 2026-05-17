export type IssueCode =
  | "questionnaire_deleted"
  | "version_not_found"
  | "missing_required_answer"
  | "unknown_qid"
  | "duplicate_answer"
  | "wrong_answer_type"
  | "likert_out_of_range"
  | "invalid_input";

export interface Issue {
  code: IssueCode;
  qid?: string;
  message: string;
  path?: (string | number)[];
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  readonly issues: Issue[];
  constructor(issues: Issue[]) {
    super(`Validation failed with ${issues.length} issue(s)`);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

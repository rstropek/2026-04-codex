import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli } from "./index.js";

type RunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

async function runArgs(
  argv: string[],
  opts: { stdin?: string } = {},
  dbPath?: string,
): Promise<RunResult> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  stdout.on("data", (c) => stdoutChunks.push(Buffer.from(c)));
  stderr.on("data", (c) => stderrChunks.push(Buffer.from(c)));

  const fullArgv = dbPath ? ["--db", dbPath, ...argv] : argv;
  const stdin =
    opts.stdin !== undefined
      ? Readable.from([Buffer.from(opts.stdin)])
      : Readable.from([]);

  const exitCode = await runCli({
    argv: fullArgv,
    stdin,
    stdout,
    stderr,
    env: {},
    stdinIsTty: false,
  });

  return {
    exitCode,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  };
}

function parseOut<T = unknown>(out: string): T {
  return JSON.parse(out) as T;
}

describe("questionnaire CLI", () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "qcli-"));
    dbPath = join(dir, "test.db");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("runs the full happy-path scenario", async () => {
    const v1Input = {
      title: "Customer Feedback Q2",
      questions: [
        { type: "text", prompt: "What did you like?", required: true },
        { type: "boolean", prompt: "Would you recommend us?", required: true },
        {
          type: "likert",
          prompt: "How satisfied are you?",
          required: true,
          likertMax: 4,
          lowLabel: "Not at all",
          highLabel: "Extremely",
        },
        { type: "text", prompt: "Any other feedback?", required: false },
        {
          type: "boolean",
          prompt: "Subscribe to newsletter?",
          required: false,
        },
      ],
    };

    const createRes = await runArgs(
      ["questionnaire", "create"],
      { stdin: JSON.stringify(v1Input) },
      dbPath,
    );
    expect(createRes.exitCode).toBe(0);
    const created = parseOut<{ id: number; version: 1; versionId: number }>(
      createRes.stdout,
    );
    expect(created.id).toBeGreaterThan(0);
    expect(created.version).toBe(1);

    const v2Input = {
      title: "Customer Feedback Q2",
      questions: [
        { type: "text", prompt: "What did you enjoy most?", required: true },
        {
          type: "boolean",
          prompt: "Would you recommend us to a friend?",
          required: true,
        },
        {
          type: "likert",
          prompt: "Overall satisfaction?",
          required: true,
          likertMax: 4,
          lowLabel: "Not at all",
          highLabel: "Extremely",
        },
        { type: "text", prompt: "Any other feedback?", required: false },
        {
          type: "boolean",
          prompt: "Subscribe to newsletter?",
          required: false,
        },
        {
          type: "boolean",
          prompt: "Interested in a follow-up?",
          required: false,
        },
      ],
    };

    const updateRes = await runArgs(
      ["questionnaire", "update", "--id", String(created.id)],
      { stdin: JSON.stringify(v2Input) },
      dbPath,
    );
    expect(updateRes.exitCode).toBe(0);
    const updated = parseOut<{ id: number; version: number }>(updateRes.stdout);
    expect(updated.version).toBe(2);

    const getCurrent = await runArgs(
      ["questionnaire", "get", "--id", String(created.id)],
      {},
      dbPath,
    );
    expect(getCurrent.exitCode).toBe(0);
    const current = parseOut<{
      questions: unknown[];
      version: { versionNumber: number };
    }>(getCurrent.stdout);
    expect(current.version.versionNumber).toBe(2);
    expect(current.questions).toHaveLength(6);

    const getV1 = await runArgs(
      ["questionnaire", "get", "--id", String(created.id), "--version", "1"],
      {},
      dbPath,
    );
    expect(getV1.exitCode).toBe(0);
    const v1 = parseOut<{
      questions: unknown[];
      version: { versionNumber: number };
    }>(getV1.stdout);
    expect(v1.version.versionNumber).toBe(1);
    expect(v1.questions).toHaveLength(5);

    const answersV1 = {
      questionnaireId: created.id,
      version: 1,
      answers: [
        { qid: "q1", type: "text", value: "Easy to use" },
        { qid: "q2", type: "boolean", value: true },
        { qid: "q3", type: "likert", value: 4 },
        { qid: "q4", type: "text", value: "Keep it up" },
        { qid: "q5", type: "boolean", value: false },
      ],
    };
    const submitV1 = await runArgs(
      ["submission", "submit"],
      { stdin: JSON.stringify(answersV1) },
      dbPath,
    );
    expect(submitV1.exitCode).toBe(0);

    const answersV2 = {
      questionnaireId: created.id,
      version: 2,
      answers: [
        { qid: "q1", type: "text", value: "Great support" },
        { qid: "q2", type: "boolean", value: true },
        { qid: "q3", type: "likert", value: 3 },
        { qid: "q4", type: "text", value: "More tutorials" },
        { qid: "q5", type: "boolean", value: true },
        { qid: "q6", type: "boolean", value: false },
      ],
    };
    const submitV2 = await runArgs(
      ["submission", "submit"],
      { stdin: JSON.stringify(answersV2) },
      dbPath,
    );
    expect(submitV2.exitCode).toBe(0);

    const listSubs = await runArgs(
      ["submission", "list", "--questionnaire-id", String(created.id)],
      {},
      dbPath,
    );
    expect(listSubs.exitCode).toBe(0);
    const subs = parseOut<Array<{ versionNumber: number; answers: unknown[] }>>(
      listSubs.stdout,
    );
    expect(subs).toHaveLength(2);
    expect(subs[0]?.versionNumber).toBe(1);
    expect(subs[0]?.answers).toHaveLength(5);
    expect(subs[1]?.versionNumber).toBe(2);
    expect(subs[1]?.answers).toHaveLength(6);

    const currentResults = await runArgs(
      ["questionnaire", "result", "--id", String(created.id)],
      {},
      dbPath,
    );
    expect(currentResults.exitCode).toBe(0);
    const currentResult = parseOut<{
      versionNumber: number;
      submissionCount: number;
      questions: Array<
        | { type: "text"; answers: string[] }
        | { type: "boolean"; trueCount: number; falseCount: number }
        | { type: "likert"; counts: number[] }
      >;
    }>(currentResults.stdout);
    expect(currentResult.versionNumber).toBe(2);
    expect(currentResult.submissionCount).toBe(1);
    expect(currentResult.questions).toHaveLength(6);
    expect(currentResult.questions[0]).toMatchObject({
      type: "text",
      answers: ["Great support"],
    });

    const v1Results = await runArgs(
      ["questionnaire", "result", "--id", String(created.id), "--version", "1"],
      {},
      dbPath,
    );
    expect(v1Results.exitCode).toBe(0);
    const v1Result = parseOut<{
      versionNumber: number;
      submissionCount: number;
      questions: Array<
        | { type: "text"; answers: string[] }
        | { type: "boolean"; trueCount: number; falseCount: number }
        | { type: "likert"; counts: number[] }
      >;
    }>(v1Results.stdout);
    expect(v1Result.versionNumber).toBe(1);
    expect(v1Result.submissionCount).toBe(1);
    expect(v1Result.questions).toHaveLength(5);
    expect(v1Result.questions[0]).toMatchObject({
      type: "text",
      answers: ["Easy to use"],
    });

    const del = await runArgs(
      ["questionnaire", "delete", "--id", String(created.id)],
      {},
      dbPath,
    );
    expect(del.exitCode).toBe(0);
    expect(parseOut(del.stdout)).toEqual({ id: created.id, deleted: true });

    const listHidden = await runArgs(["questionnaire", "list"], {}, dbPath);
    expect(listHidden.exitCode).toBe(0);
    expect(parseOut<unknown[]>(listHidden.stdout)).toHaveLength(0);

    const listAll = await runArgs(
      ["questionnaire", "list", "--include-deleted"],
      {},
      dbPath,
    );
    expect(listAll.exitCode).toBe(0);
    expect(parseOut<unknown[]>(listAll.stdout)).toHaveLength(1);
  });

  it("returns a NotFoundError envelope for submissions against an unknown questionnaire", async () => {
    const res = await runArgs(
      ["submission", "submit"],
      {
        stdin: JSON.stringify({
          questionnaireId: 9999,
          version: 1,
          answers: [],
        }),
      },
      dbPath,
    );
    expect(res.exitCode).toBe(1);
    const payload = JSON.parse(res.stderr) as { error: { type: string } };
    expect(payload.error.type).toBe("NotFoundError");
  });

  it("returns a NotFoundError envelope for results against an unknown questionnaire", async () => {
    const res = await runArgs(
      ["questionnaire", "result", "--id", "9999"],
      {},
      dbPath,
    );
    expect(res.exitCode).toBe(1);
    const payload = JSON.parse(res.stderr) as { error: { type: string } };
    expect(payload.error.type).toBe("NotFoundError");
  });

  it("returns an InputError envelope for malformed JSON on stdin", async () => {
    const res = await runArgs(
      ["questionnaire", "create"],
      { stdin: "{ not json" },
      dbPath,
    );
    expect(res.exitCode).toBe(2);
    const payload = JSON.parse(res.stderr) as { error: { type: string } };
    expect(payload.error.type).toBe("InputError");
  });

  it("runs db migrate against a fresh file", async () => {
    const res = await runArgs(["db", "migrate"], {}, dbPath);
    expect(res.exitCode).toBe(0);
    const payload = parseOut<{ migrated: boolean; db: string }>(res.stdout);
    expect(payload.migrated).toBe(true);
    expect(payload.db).toBe(dbPath);
  });
});

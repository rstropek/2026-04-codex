import type { Writable } from "node:stream";
import { type ErrorPayload, toErrorPayload } from "./errors.js";

export function writeJson(stream: Writable, value: unknown): void {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function writeError(stderr: Writable, err: unknown): number {
  const { payload, exitCode } = toErrorPayload(err);
  stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  return exitCode;
}

export type { ErrorPayload };

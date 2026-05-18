import { readFile } from "node:fs/promises";
import type { Readable } from "node:stream";
import { InputError } from "./errors.js";

export interface ReadJsonOptions {
  filePath?: string | undefined;
  stdin: Readable;
  stdinIsTty: boolean;
}

export async function readJsonInput(opts: ReadJsonOptions): Promise<unknown> {
  const raw = await readRawInput(opts);
  try {
    return JSON.parse(raw);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new InputError(`Failed to parse JSON input: ${detail}`);
  }
}

async function readRawInput(opts: ReadJsonOptions): Promise<string> {
  if (opts.filePath !== undefined) {
    try {
      return await readFile(opts.filePath, "utf8");
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new InputError(`Failed to read --file ${opts.filePath}: ${detail}`);
    }
  }
  if (opts.stdinIsTty) {
    throw new InputError(
      "No input provided. Pass --file <path> or pipe JSON on stdin.",
    );
  }
  return await drainStream(opts.stdin);
}

async function drainStream(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

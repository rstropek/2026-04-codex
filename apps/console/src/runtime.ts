import type { Readable, Writable } from "node:stream";

export interface CommandContext {
  stdin: Readable;
  stdout: Writable;
  stderr: Writable;
  env: NodeJS.ProcessEnv;
  stdinIsTty: boolean;
}

export interface CliIo {
  argv: string[];
  stdin?: Readable;
  stdout?: Writable;
  stderr?: Writable;
  env?: NodeJS.ProcessEnv;
  stdinIsTty?: boolean;
}

import type { Readable, Writable } from "node:stream";

export type CommandContext = {
  stdin: Readable;
  stdout: Writable;
  stderr: Writable;
  env: NodeJS.ProcessEnv;
  stdinIsTty: boolean;
};

export type CliIo = {
  argv: string[];
  stdin?: Readable;
  stdout?: Writable;
  stderr?: Writable;
  env?: NodeJS.ProcessEnv;
  stdinIsTty?: boolean;
};

// Stage B / Multi-turn — two turns on the same thread.
//
// ⚠️  Learning sample only. Real applications should use @openai/codex-sdk.
//
// What you should notice:
//   - The same `threadId` carries context between turns. We never re-send the
//     previous prompt; the server remembers it. (Compare: with `codex exec`
//     you'd pipe stdin or use `--resume`; the SDK calls thread.run() twice.)
//   - The wire format is unchanged from hello.ts — only the application logic
//     is more interesting.

import { spawn } from "node:child_process";
import readline from "node:readline";

const BANNER = `
⚠️  Learning sample only.
    Real applications should use @openai/codex-sdk.
    This script exists to show what the SDK does for you.
`;
console.log(BANNER);

const PROMPTS = [
  "List the top-level workspaces in this monorepo.",
  "Which of those workspaces would you start reading first to understand the project, and why?",
];

const proc = spawn("codex", ["app-server"], {
  stdio: ["pipe", "pipe", "inherit"],
});

const rl = readline.createInterface({ input: proc.stdout });

let turnIndex = 0;
const tag = () => `[turn ${turnIndex + 1}]`;

const send = (message: Record<string, unknown>) => {
  const line = JSON.stringify(message);
  console.log(`${tag()} →`, line);
  proc.stdin.write(`${line}\n`);
};

let threadId: string | null = null;
let turnRequestId = 10; // ids 0–1 are handshake/thread-start; turns start at 10.

const startNextTurn = () => {
  if (turnIndex >= PROMPTS.length) {
    rl.close();
    proc.stdin.end();
    proc.kill();
    process.exit(0);
  }
  send({
    jsonrpc: "2.0",
    method: "turn/start",
    id: turnRequestId,
    params: {
      threadId,
      input: [{ type: "text", text: PROMPTS[turnIndex] }],
    },
  });
};

rl.on("line", (line) => {
  const msg = JSON.parse(line);
  console.log(`${tag()} ←`, JSON.stringify(msg));

  // thread/start replied — capture id and kick off turn 1.
  if (msg.id === 1 && msg.result?.thread?.id && !threadId) {
    threadId = msg.result.thread.id;
    startNextTurn();
    return;
  }

  // The server signals end-of-turn via a `turn/completed` notification (the
  // synchronous `id` response only confirms "inProgress"). When we see it,
  // bump the turn counter and queue the next prompt.
  if (msg.method === "turn/completed" || msg.method === "turn/failed") {
    turnIndex += 1;
    turnRequestId += 1;
    startNextTurn();
  }
});

send({
  jsonrpc: "2.0",
  method: "initialize",
  id: 0,
  params: {
    clientInfo: {
      name: "demo_appserver",
      title: "AppServer Demo",
      version: "0.1.0",
    },
  },
});
send({ jsonrpc: "2.0", method: "initialized", params: {} });
send({
  jsonrpc: "2.0",
  method: "thread/start",
  id: 1,
  params: {
    cwd: process.cwd(),
    approvalPolicy: "never",
    sandbox: "read-only",
  },
});

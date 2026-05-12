// Stage B / Hello — raw `codex app-server` client.
//
// ⚠️  Learning sample only. Real applications should use @openai/codex-sdk.
//     This script exists to show what the SDK does for you.
//
// What you should notice:
//   - Same wire format as the Stage A toy server (JSON-RPC 2.0). Only the
//     transport changed: HTTP → newline-delimited JSON over stdio.
//   - The conversation has a mandatory handshake: initialize → initialized →
//     thread/start → turn/start. Everything after `initialized` rides on top
//     of a *thread*.
//   - The server streams *notifications* (turn/started, item/*, ...) before
//     it sends the final response. That is the same event stream `codex exec
//     --json` produces, and the same one the SDK exposes via streaming APIs.

import { spawn } from "node:child_process";
import readline from "node:readline";

const BANNER = `
⚠️  Learning sample only.
    Real applications should use @openai/codex-sdk.
    This script exists to show what the SDK does for you.
`;
console.log(BANNER);

const proc = spawn("codex", ["app-server"], {
  stdio: ["pipe", "pipe", "inherit"],
});

const rl = readline.createInterface({ input: proc.stdout });

const send = (message: Record<string, unknown>) => {
  const line = JSON.stringify(message);
  console.log("→", line);
  proc.stdin.write(`${line}\n`);
};

let threadId: string | null = null;

rl.on("line", (line) => {
  const msg = JSON.parse(line);
  console.log("←", JSON.stringify(msg));

  // Step 4: thread/start replied — capture the thread id and ask a question.
  if (msg.id === 1 && msg.result?.thread?.id && !threadId) {
    threadId = msg.result.thread.id;
    send({
      jsonrpc: "2.0",
      method: "turn/start",
      id: 2,
      params: {
        threadId,
        input: [{ type: "text", text: "Summarize this repo in 5 bullets." }],
      },
    });
  }

  // Step 6: server signals completion via a `turn/completed` notification.
  // The `id: 2` response arrives earlier with status "inProgress" — that is
  // just the synchronous ack, not the final answer. The final assistant
  // message arrives as one of the `item/*` notifications before completion.
  if (msg.method === "turn/completed" || msg.method === "turn/failed") {
    rl.close();
    proc.stdin.end();
    proc.kill();
    process.exit(0);
  }
});

// Step 1–3: handshake + thread/start.
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

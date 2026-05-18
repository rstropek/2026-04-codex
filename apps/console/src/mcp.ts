import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  MCP_SERVER_INSTRUCTIONS,
  type QuestionnaireDb,
  registerQuestionnaireMcpTools,
} from "@questionnaires/lib";
import { openDb } from "./db.js";
import { toErrorPayload } from "./errors.js";
import type { CommandContext } from "./runtime.js";

type McpServerOptions = {
  db?: string | undefined;
  env: NodeJS.ProcessEnv;
};

export function createQuestionnaireMcpServer(
  opts: McpServerOptions,
): McpServer {
  const server = new McpServer(
    { name: "questionnaire-cli", version: "0.1.0" },
    { instructions: MCP_SERVER_INSTRUCTIONS },
  );

  let cached: { db: QuestionnaireDb; sqlite: { close: () => void } } | null =
    null;
  const closeHandle = server.close.bind(server);
  server.close = async () => {
    try {
      await closeHandle();
    } finally {
      cached?.sqlite.close();
      cached = null;
    }
  };

  registerQuestionnaireMcpTools(server, {
    getDb: () => {
      if (!cached) {
        const opened = openDb({ dbFlag: opts.db, env: opts.env });
        cached = { db: opened.db, sqlite: opened.sqlite };
      }
      return cached.db;
    },
    onError: (err) => toErrorPayload(err).payload,
  });

  return server;
}

export async function runMcpServer(
  ctx: CommandContext,
  opts: { db?: string },
): Promise<void> {
  const server = createQuestionnaireMcpServer({ db: opts.db, env: ctx.env });
  const transport = new StdioServerTransport(ctx.stdin, ctx.stdout);
  await server.connect(transport);

  await new Promise<void>((resolve, reject) => {
    ctx.stdin.once("end", resolve);
    ctx.stdin.once("close", resolve);
    ctx.stdin.once("error", reject);
  });

  await server.close();
}

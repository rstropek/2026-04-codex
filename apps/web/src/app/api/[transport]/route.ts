import {
  MCP_SERVER_INSTRUCTIONS,
  registerQuestionnaireMcpTools,
} from "@questionnaires/lib";
import { createMcpHandler } from "mcp-handler";
import { getDb } from "../../../server/db";

const mcpHandler = createMcpHandler(
  (server) => {
    registerQuestionnaireMcpTools(server, {
      getDb: () => getDb().db,
    });
  },
  {
    serverInfo: { name: "questionnaire-web", version: "0.1.0" },
    capabilities: { tools: {} },
    instructions: MCP_SERVER_INSTRUCTIONS,
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: false,
  },
);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
};

function withCors(response: Response): Response {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

async function handler(request: Request): Promise<Response> {
  return withCors(await mcpHandler(request));
}

function OPTIONS(): Response {
  return withCors(new Response(null, { status: 204 }));
}

export { handler as GET, handler as POST, handler as DELETE, OPTIONS };

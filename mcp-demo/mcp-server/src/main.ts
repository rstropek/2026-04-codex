/**
 * Streamable-HTTP transport for the demo MCP App server.
 *
 * Listens on http://localhost:3001/mcp — the default that `basic-host/serve.ts`
 * already points at. Stateless mode: every request gets a fresh server +
 * transport pair, matching the reference pattern in
 * `ext-apps/examples/basic-server-vanillajs/main.ts`.
 *
 * Nothing in this file is MCP-Apps-specific — the Apps extension lives entirely
 * in `server.ts` and the step modules.
 */
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import { createServer } from "./server.js";

const PORT = Number.parseInt(process.env.PORT ?? "3001", 10);

const app = createMcpExpressApp({ host: "0.0.0.0" });
app.use(cors());

app.all("/mcp", async (req: Request, res: Response) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

const httpServer = app.listen(PORT, () => {
  console.log(`MCP App demo server listening on http://localhost:${PORT}/mcp`);
});

const shutdown = () => {
  console.log("\nShutting down...");
  httpServer.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

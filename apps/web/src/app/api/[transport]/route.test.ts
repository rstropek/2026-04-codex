import { mkdtempSync, rmSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type RouteModule = typeof import("./route.js");

describe("Streamable HTTP MCP route", () => {
  let dir: string;
  let httpServer: ReturnType<typeof createHttpServer>;
  let baseUrl: URL;
  let route: RouteModule;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "web-mcp-"));
    process.env.DATABASE_URL = join(dir, "test.db");

    route = await import("./route.js");

    httpServer = createHttpServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const method = (req.method ?? "GET").toUpperCase();
        const init: RequestInit = {
          method,
          headers: req.headers as Record<string, string>,
        };
        if (chunks.length && method !== "GET" && method !== "HEAD") {
          init.body = Buffer.concat(chunks);
        }

        const request = new Request(
          `http://localhost${url.pathname}${url.search}`,
          init,
        );

        const handler =
          method === "GET"
            ? route.GET
            : method === "DELETE"
              ? route.DELETE
              : route.POST;
        const response = await handler(request);

        res.statusCode = response.status;
        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });

        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        }
        res.end();
      } catch (err) {
        res.statusCode = 500;
        res.end(String(err));
      }
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = httpServer.address() as AddressInfo;
    baseUrl = new URL(`http://127.0.0.1:${addr.port}/api/mcp`);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
    delete process.env.DATABASE_URL;
  });

  it("exposes the same questionnaire tools as the STDIO server", async () => {
    const client = new Client({ name: "web-mcp-test", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(baseUrl);

    try {
      // @ts-expect-error sdk Transport types use `sessionId: string` while the streamable HTTP client surfaces `string | undefined`; runtime contract is fine.
      await client.connect(transport);

      const tools = await client.listTools();
      expect(tools.tools.map((t) => t.name).sort()).toEqual([
        "questionnaire_get",
        "questionnaire_list",
        "questionnaire_result",
        "submission_submit",
      ]);

      const submitTool = tools.tools.find(
        (t) => t.name === "submission_submit",
      );
      expect(JSON.stringify(submitTool?.inputSchema).includes('"anyOf"')).toBe(
        true,
      );

      const result = await client.callTool({
        name: "questionnaire_list",
        arguments: {},
      });
      expect("isError" in result ? result.isError : false).toBeFalsy();
    } finally {
      await client.close();
    }
  });
});

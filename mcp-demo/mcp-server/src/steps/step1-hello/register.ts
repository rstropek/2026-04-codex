/**
 * Step 1 — Tool ↔ UI link.
 *
 * The smallest possible MCP App: one tool, one UI resource, joined by
 * `_meta.ui.resourceUri`. When the host calls the tool, it sees that link,
 * fetches the resource via `resources/read`, and mounts the returned HTML in
 * a sandboxed iframe — that iframe is the View in `view.ts`.
 *
 * APIs introduced here:
 *  • registerAppTool — like a normal MCP tool, but with `_meta.ui.resourceUri`.
 *  • registerAppResource — serves the bundled HTML with the special
 *    `text/html;profile=mcp-app` mime type (re-exported as RESOURCE_MIME_TYPE).
 *  • structuredContent — typed payload routed to the View next to the plain
 *    `content` the model sees.
 */
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { DIST_DIR } from "../../dist-dir.js";

const RESOURCE_URI = "ui://step1-hello/app.html";

export function register(server: McpServer): void {
  registerAppTool(
    server,
    "step1-hello",
    {
      title: "Step 1 — Hello",
      description: "Returns a greeting and the current server time. Renders an MCP App UI.",
      inputSchema: {},
      outputSchema: z.object({ time: z.string(), greeting: z.string() }).shape,
      // This single line is what turns a tool into an MCP App tool: the host
      // sees the resourceUri, fetches it, and renders the View alongside.
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    (): CallToolResult => {
      const data = { time: new Date().toISOString(), greeting: "Hello, MCP Apps!" };
      return {
        // `content`: shown to the model (and also to humans in fallback hosts
        // that don't support MCP Apps).
        content: [{ type: "text", text: `${data.greeting} (server time ${data.time})` }],
        // `structuredContent`: shipped verbatim to the View — same fields, no
        // text round-trip.
        structuredContent: data,
      };
    },
  );

  registerAppResource(
    server,
    "step1-hello-ui",
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "step1.html"), "utf-8");
      return { contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] };
    },
  );
}

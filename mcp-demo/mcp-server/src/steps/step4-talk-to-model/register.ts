/**
 * Step 4 — Talk to model.
 *
 * The tool side is intentionally boring (a placeholder result). The lesson is
 * what the View can do *after* it mounts: push messages, pin context, open
 * external links — all through the host, never via DOM tricks.
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
import { DIST_DIR } from "../../dist-dir.js";

const RESOURCE_URI = "ui://step4-talk-to-model/app.html";

export function register(server: McpServer): void {
  registerAppTool(
    server,
    "step4-talk-to-model",
    {
      title: "Step 4 — Talk to model",
      description:
        "Opens a panel with buttons that push messages, pin context, and open links via the host.",
      inputSchema: {},
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    (): CallToolResult => ({
      content: [{ type: "text", text: "Panel opened. Use the buttons to interact with the model." }],
      structuredContent: {},
    }),
  );

  registerAppResource(
    server,
    "step4-talk-to-model-ui",
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "step4.html"), "utf-8");
      return { contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] };
    },
  );
}

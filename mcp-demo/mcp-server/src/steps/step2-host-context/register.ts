/**
 * Step 2 — Host context & theming.
 *
 * The tool itself is trivial (it just returns an empty payload). The lesson
 * is on the View side: how a View reads the host's theme, locale, dimensions,
 * and CSS variables, and re-renders when they change.
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

const RESOURCE_URI = "ui://step2-host-context/app.html";

export function register(server: McpServer): void {
  registerAppTool(
    server,
    "step2-host-context",
    {
      title: "Step 2 — Host Context",
      description:
        "Renders an MCP App that displays the host context (theme, display mode, dimensions) and re-renders on changes.",
      inputSchema: {},
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    (): CallToolResult => ({
      content: [{ type: "text", text: "Open the panel to see host context details." }],
      structuredContent: {},
    }),
  );

  registerAppResource(
    server,
    "step2-host-context-ui",
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "step2.html"), "utf-8");
      return { contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] };
    },
  );
}

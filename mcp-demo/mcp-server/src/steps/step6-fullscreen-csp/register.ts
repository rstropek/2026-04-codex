/**
 * Step 6 — Display modes + external resources via CSP.
 *
 * Two new pieces of `_meta.ui` show up here:
 *  • `csp.resourceDomains` — origins the View may load <img>, <script>,
 *    <link rel=stylesheet>, fonts, media from. The host's default CSP is
 *    effectively `default-src 'none'`, so without this whitelist the iframe
 *    cannot reach anything off-origin.
 *  • (Sibling fields `csp.connectDomains`, `csp.frameDomains`, `csp.permissions`
 *    control fetch/WebSocket, nested iframes, and browser capabilities.)
 *
 * The View asks for fullscreen via `app.requestDisplayMode` — see view.tsx.
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

const RESOURCE_URI = "ui://step6-fullscreen-csp/app.html";

const COUNTRIES: Record<string, string> = {
  at: "Austria",
  de: "Germany",
  fr: "France",
  jp: "Japan",
  us: "United States",
  br: "Brazil",
};

export function register(server: McpServer): void {
  registerAppTool(
    server,
    "step6-flag",
    {
      title: "Step 6 — Country Flag",
      description:
        "Shows a country flag image from an external CDN inside a sandboxed iframe. The View can toggle fullscreen.",
      inputSchema: { code: z.string().optional().describe("ISO 3166-1 alpha-2 code, e.g. 'at'") },
      outputSchema: z.object({ country: z.string(), code: z.string() }).shape,
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    (args: { code?: string }): CallToolResult => {
      const code = (args.code ?? "at").toLowerCase();
      const country = COUNTRIES[code] ?? code.toUpperCase();
      return {
        content: [{ type: "text", text: `Showing flag of ${country} (${code}).` }],
        structuredContent: { country, code },
      };
    },
  );

  registerAppResource(
    server,
    "step6-fullscreen-csp-ui",
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "step6.html"), "utf-8");
      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            // CSP attached at the content-item level (takes precedence over
            // listing-level `_meta`). Without this entry the <img> tag in the
            // View is blocked by the host's default-deny CSP.
            _meta: {
              ui: {
                csp: {
                  resourceDomains: ["https://flagcdn.com"],
                },
                preferences: { prefersBorder: true },
              },
            },
          },
        ],
      };
    },
  );
}

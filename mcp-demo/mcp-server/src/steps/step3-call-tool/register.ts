/**
 * Step 3 — View → Server tool calls + app-only visibility.
 *
 * Two tools, one shared UI resource:
 *  • `step3-quote`           visibility: model + app (default) — the model
 *                            calls this to *open* the quote panel.
 *  • `step3-next-quote`      visibility: ["app"] — only the View can call
 *                            this. The model never sees it in its tool list,
 *                            so it never tries to invoke it directly.
 *
 * The shared resourceUri is what binds both tools to the same iframe.
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

const RESOURCE_URI = "ui://step3-call-tool/app.html";

const QUOTES: ReadonlyArray<{ quote: string; author: string }> = [
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { quote: "Make it work, make it right, make it fast.", author: "Kent Beck" },
  { quote: "Premature optimization is the root of all evil.", author: "Donald Knuth" },
  { quote: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  { quote: "There are only two hard things in computer science: cache invalidation and naming things.", author: "Phil Karlton" },
];

function pickQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]!;
}

const outputShape = z.object({ quote: z.string(), author: z.string() }).shape;

export function register(server: McpServer): void {
  // Model-facing tool: this is the one shown in the model's tool list.
  registerAppTool(
    server,
    "step3-quote",
    {
      title: "Step 3 — Random Quote",
      description: "Shows a random programming quote and an interactive UI to fetch more.",
      inputSchema: {},
      outputSchema: outputShape,
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    (): CallToolResult => {
      const q = pickQuote();
      return {
        content: [{ type: "text", text: `"${q.quote}" — ${q.author}` }],
        structuredContent: q,
      };
    },
  );

  // App-only tool: invisible to the model. The View calls it directly when
  // the user clicks "Another one" — no conversation turn is consumed.
  registerAppTool(
    server,
    "step3-next-quote",
    {
      title: "Step 3 — Next Quote (app-only)",
      description: "Returns another random quote. Hidden from the model.",
      inputSchema: {},
      outputSchema: outputShape,
      _meta: { ui: { visibility: ["app"] } },
    },
    (): CallToolResult => {
      const q = pickQuote();
      return {
        content: [{ type: "text", text: `"${q.quote}" — ${q.author}` }],
        structuredContent: q,
      };
    },
  );

  registerAppResource(
    server,
    "step3-call-tool-ui",
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "step3.html"), "utf-8");
      return { contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] };
    },
  );
}

/**
 * Step 5 — Live polling with lifecycle cleanup.
 *
 * Two tools, one resource:
 *  • `step5-monitor`  model-facing, opens the dashboard.
 *  • `step5-stats`    app-only (visibility: ["app"]), called every 2 s by the
 *                     View. The model never sees the storm of poll calls.
 *
 * The pattern is the same one used by the reference system-monitor server.
 */
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { DIST_DIR } from "../../dist-dir.js";

const RESOURCE_URI = "ui://step5-live-polling/app.html";

const startedAt = Date.now();

function sampleStats() {
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const usedMemPct = ((totalMem - freeMem) / totalMem) * 100;
  // The CPU figure is intentionally synthetic: it animates the demo without
  // depending on platform-specific probes.
  const cpu = 30 + Math.sin(Date.now() / 1000) * 15 + Math.random() * 5;
  return {
    cpu,
    memory: usedMemPct,
    uptime: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  };
}

const statsShape = z.object({
  cpu: z.number(),
  memory: z.number(),
  uptime: z.number(),
  timestamp: z.string(),
}).shape;

export function register(server: McpServer): void {
  registerAppTool(
    server,
    "step5-monitor",
    {
      title: "Step 5 — Live host monitor",
      description: "Opens a dashboard that polls host stats every 2 s via an app-only tool.",
      inputSchema: {},
      outputSchema: statsShape,
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    (): CallToolResult => {
      const s = sampleStats();
      return {
        content: [{ type: "text", text: `cpu ${s.cpu.toFixed(1)}% / mem ${s.memory.toFixed(1)}%` }],
        structuredContent: s,
      };
    },
  );

  // App-only polling tool. The model has no idea this exists, so it can't
  // accidentally start spamming it.
  registerAppTool(
    server,
    "step5-stats",
    {
      title: "Step 5 — Poll Stats (app-only)",
      description: "Returns the latest host stats sample. Hidden from the model.",
      inputSchema: {},
      outputSchema: statsShape,
      _meta: { ui: { visibility: ["app"] } },
    },
    (): CallToolResult => {
      const s = sampleStats();
      return {
        content: [{ type: "text", text: JSON.stringify(s) }],
        structuredContent: s,
      };
    },
  );

  registerAppResource(
    server,
    "step5-live-polling-ui",
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "step5.html"), "utf-8");
      return { contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] };
    },
  );
}

/**
 * Step 5 View — live polling with lifecycle cleanup.
 *
 * MCP-Apps concepts on display:
 *  • The polling pattern: a setInterval that calls an *app-only* tool
 *    (visibility: ["app"]) on a cadence — the model never sees the storm
 *    of refresh calls.
 *  • `app.onteardown` is the host's signal that the iframe is about to be
 *    discarded. This is where you stop intervals, abort fetches, flush
 *    state — otherwise the timer keeps firing into a dead postMessage
 *    channel and the host logs leak.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

type Stats = { cpu: number; memory: number; uptime: number; timestamp: string };

function StepFiveApp() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tickCount, setTickCount] = useState(0);

  const { app, error } = useApp({
    appInfo: { name: "Step 5 — Live polling", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      // Cleanup contract: when the host tears the iframe down it sends
      // `ui/resource-teardown` and waits (briefly) for this handler. Use
      // the time to stop timers and flush state.
      a.onteardown = async () => {
        console.info("[step5] teardown requested by host");
        return {};
      };
    },
  });

  useEffect(() => {
    if (!app) return;

    let cancelled = false;
    const tick = async () => {
      // Call the app-only tool. The model is unaware of this stream of calls.
      const result: CallToolResult = await app.callServerTool({
        name: "step5-stats",
        arguments: {},
      });
      if (cancelled) return;
      const s = result.structuredContent as Stats | undefined;
      if (s) {
        setStats(s);
        setTickCount((n) => n + 1);
      }
    };

    void tick();
    const id = window.setInterval(tick, 2000);

    // React's effect cleanup mirrors `onteardown`: stop the timer the
    // moment the View unmounts (StrictMode, host teardown, route change).
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [app]);

  if (error) return <pre style={{ color: "crimson" }}>Error: {error.message}</pre>;
  if (!app) return <p>Connecting…</p>;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "1rem", maxWidth: 480 }}>
      <h1>Live host stats</h1>
      <p style={{ opacity: 0.7 }}>
        Polls an app-only tool every 2 seconds. The model never sees these calls.
      </p>
      <div style={card}>
        <Row label="CPU" value={stats ? `${stats.cpu.toFixed(1)}%` : "—"} />
        <Row label="Memory" value={stats ? `${stats.memory.toFixed(1)}%` : "—"} />
        <Row label="Uptime" value={stats ? `${stats.uptime} s` : "—"} />
        <Row label="Server time" value={stats?.timestamp ?? "—"} mono />
        <Row label="Polls observed" value={String(tickCount)} />
      </div>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
      <span>{label}</span>
      <span style={{ fontFamily: mono ? "ui-monospace, monospace" : "inherit" }}>{value}</span>
    </div>
  );
}

const card: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: ".5rem",
  padding: "1rem",
  borderRadius: 8,
  background: "color-mix(in srgb, currentColor 6%, transparent)",
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StepFiveApp />
  </StrictMode>,
);

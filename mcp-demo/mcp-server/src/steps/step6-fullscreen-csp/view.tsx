/**
 * Step 6 View — display modes + external resources behind CSP.
 *
 * MCP-Apps concepts on display:
 *  • The View runs under a *default-deny* CSP. Any cross-origin asset (image,
 *    font, script, fetch target) must be whitelisted by the *server* in the
 *    resource's `_meta.ui.csp.{resourceDomains,connectDomains}`. The View
 *    cannot loosen its own CSP.
 *  • `app.requestDisplayMode({ mode })` asks the host to move the iframe
 *    between `inline`, `fullscreen`, and `pip`. The host has final say; the
 *    method resolves with the *granted* mode, which may differ from the ask.
 *  • `app.getHostContext().availableDisplayModes` lists what the host is
 *    willing to grant — feature-detect before showing the button.
 */
import type { McpUiDisplayMode } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

type FlagResult = { country: string; code: string };

function StepSixApp() {
  const [data, setData] = useState<FlagResult | null>(null);
  const [mode, setMode] = useState<McpUiDisplayMode>("inline");
  const [available, setAvailable] = useState<readonly McpUiDisplayMode[]>([]);

  const { app, error } = useApp({
    appInfo: { name: "Step 6 — Fullscreen + CSP", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolresult = (result) => {
        const r = result.structuredContent as FlagResult | undefined;
        if (r) setData(r);
      };
    },
  });

  useEffect(() => {
    if (!app) return;
    const ctx = app.getHostContext();
    setMode(ctx?.displayMode ?? "inline");
    setAvailable(ctx?.availableDisplayModes ?? []);
    app.onhostcontextchanged = () => {
      const c = app.getHostContext();
      if (c?.displayMode) setMode(c.displayMode);
      if (c?.availableDisplayModes) setAvailable(c.availableDisplayModes);
    };
  }, [app]);

  if (error) return <pre style={{ color: "crimson" }}>Error: {error.message}</pre>;
  if (!app) return <p>Connecting…</p>;

  // The image URL crosses origins. It loads only because the server attached
  // `_meta.ui.csp.resourceDomains: ["https://flagcdn.com"]` to the resource.
  // Strip that entry server-side and the image is blocked silently.
  const imageUrl = data ? `https://flagcdn.com/w640/${data.code}.png` : null;

  const canFullscreen = available.includes("fullscreen");
  const toggle = async () => {
    const target: McpUiDisplayMode = mode === "fullscreen" ? "inline" : "fullscreen";
    const result = await app.requestDisplayMode({ mode: target });
    // The granted mode may differ from the requested one — always trust
    // what the host returns.
    setMode(result.mode);
  };

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>{data?.country ?? "Loading…"}</h1>
        {canFullscreen && (
          <button onClick={toggle}>
            {mode === "fullscreen" ? "Exit fullscreen" : "Go fullscreen"}
          </button>
        )}
      </header>
      <p style={{ opacity: 0.7 }}>
        Current display mode: <code>{mode}</code>
      </p>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Flag of ${data?.country}`}
          style={{ maxWidth: "100%", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}
        />
      ) : (
        <p>No flag yet.</p>
      )}
      <p style={{ marginTop: "1rem", fontSize: ".875rem", opacity: 0.6 }}>
        Image served from <code>flagcdn.com</code> — allowed by the server's
        <code> _meta.ui.csp.resourceDomains</code>. Without that entry, the
        host's default CSP would block the load.
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StepSixApp />
  </StrictMode>,
);

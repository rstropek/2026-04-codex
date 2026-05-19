/**
 * Step 4 View — talking *back* to the model.
 *
 * MCP-Apps concepts on display:
 *  • `app.sendMessage(...)` injects a new user message into the conversation
 *    and triggers a model response — like the user typed it themselves.
 *  • `app.updateModelContext(...)` quietly appends to the model's context
 *    *without* triggering a turn. The model sees it on the *next* turn.
 *    Use this for state ("user changed the budget to 1200"), not requests.
 *  • `app.openLink(...)` asks the host to open a URL externally — the View
 *    must not call `window.open` itself (sandboxed).
 *  • `useApp` from `/react` is the React-friendly wrapper around `new App`:
 *    handles connect/teardown, exposes `{ app, error }`, plays nicely with
 *    StrictMode double-effects.
 */
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

function StepFourApp() {
  const { app, error } = useApp({
    appInfo: { name: "Step 4 — Talk to model", version: "1.0.0" },
    capabilities: {},
  });

  const [note, setNote] = useState("Answer with lots of emojis!");
  const [message, setMessage] = useState("Summarise the conversation so far.");
  const [linkUrl, setLinkUrl] = useState("https://modelcontextprotocol.io/");
  const [status, setStatus] = useState<string>("");

  if (error) return <pre style={{ color: "crimson" }}>Error: {error.message}</pre>;
  if (!app) return <p>Connecting to host…</p>;

  // updateModelContext: silent, no immediate turn — the model sees this text
  // attached to its next prompt.
  const pinToContext = async () => {
    await app.updateModelContext({ content: [{ type: "text", text: note }] });
    setStatus("Pinned to model context (no turn triggered).");
  };

  // sendMessage: behaves like the user typed in the chat box — the model
  // will produce a response immediately.
  const sendAsMessage = async () => {
    const { isError } = await app.sendMessage({
      role: "user",
      content: [{ type: "text", text: message }],
    });
    setStatus(isError ? "Host rejected the message." : "Sent — model is responding.");
  };

  // openLink: navigation belongs to the host. The sandboxed iframe cannot
  // open a top-level window itself.
  const openExternal = async () => {
    const { isError } = await app.openLink({ url: linkUrl });
    setStatus(isError ? "Host rejected the link." : `Asked host to open ${linkUrl}.`);
  };

  return (
    <main style={page}>
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Step 4 — Talk to model</h1>
        <p style={{ margin: ".35rem 0 0", opacity: 0.65, fontSize: ".9rem" }}>
          Three ways a View can drive the conversation: silent context, user turn, external link.
        </p>
      </header>

      <Card
        title="Pin to model context"
        hint="Silent — appended to the model's context on its next turn. No reply triggered."
        action={<Button onClick={pinToContext}>Pin to context</Button>}
      >
        <textarea
          style={input}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </Card>

      <Card
        title="Send as user message"
        hint="Behaves as if the user typed it. The model replies immediately."
        action={
          <Button variant="primary" onClick={sendAsMessage}>
            Send message
          </Button>
        }
      >
        <textarea
          style={input}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
        />
      </Card>

      <Card
        title="Open external link"
        hint="The host opens the URL — the sandboxed iframe cannot navigate the top window itself."
        action={<Button onClick={openExternal}>Open via host</Button>}
      >
        <input
          style={input}
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
        />
      </Card>

      {status && <p style={statusBar}>{status}</p>}
    </main>
  );
}

function Card({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={card}>
      <div>
        <h2 style={cardTitle}>{title}</h2>
        <p style={cardHint}>{hint}</p>
      </div>
      {children}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>{action}</div>
    </section>
  );
}

function Button({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      style={{
        appearance: "none",
        border: "1px solid transparent",
        borderRadius: 6,
        padding: ".5rem .9rem",
        fontSize: ".9rem",
        fontWeight: 500,
        cursor: "pointer",
        background: isPrimary
          ? "#2563eb"
          : "color-mix(in srgb, currentColor 8%, transparent)",
        color: isPrimary ? "#ffffff" : "inherit",
        borderColor: isPrimary
          ? "#2563eb"
          : "color-mix(in srgb, currentColor 18%, transparent)",
      }}
    >
      {children}
    </button>
  );
}

const page: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  padding: "1.5rem",
  maxWidth: 560,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const card: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: ".75rem",
  padding: "1rem 1.1rem",
  borderRadius: 10,
  background: "color-mix(in srgb, currentColor 4%, transparent)",
  border: "1px solid color-mix(in srgb, currentColor 12%, transparent)",
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  fontSize: ".95rem",
  fontWeight: 600,
};

const cardHint: React.CSSProperties = {
  margin: ".15rem 0 0",
  fontSize: ".8rem",
  opacity: 0.65,
  lineHeight: 1.4,
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
  fontSize: ".9rem",
  padding: ".55rem .7rem",
  borderRadius: 6,
  border: "1px solid color-mix(in srgb, currentColor 20%, transparent)",
  background: "Canvas",
  color: "inherit",
  resize: "vertical",
};

const statusBar: React.CSSProperties = {
  margin: ".25rem 0 0",
  padding: ".6rem .85rem",
  fontSize: ".85rem",
  borderRadius: 6,
  background: "color-mix(in srgb, currentColor 6%, transparent)",
  opacity: 0.85,
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StepFourApp />
  </StrictMode>,
);

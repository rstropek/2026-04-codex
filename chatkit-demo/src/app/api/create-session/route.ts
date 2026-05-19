import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const DEFAULT_CHATKIT_BASE = "https://api.openai.com";
const SESSION_COOKIE_NAME = "chatkit_session_id";
const SESSION_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

export const runtime = "nodejs";

type CreateSessionBody = {
  workflow?: { id?: string };
  workflowId?: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY environment variable" },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as CreateSessionBody;
  const workflowId =
    body.workflow?.id?.trim() || body.workflowId?.trim() || process.env.CHATKIT_WORKFLOW_ID?.trim();

  if (!workflowId) {
    return NextResponse.json({ error: "Missing workflow id" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const userId = existing ?? randomUUID();

  const base = process.env.CHATKIT_API_BASE?.trim() || DEFAULT_CHATKIT_BASE;

  let upstream: Response;
  try {
    // Python SDK has a helper function for creating a session.
    // We want to use TypeScript here, so we create the session
    // manually. For real world use cases, consider Python backend!
    // See also https://developers.openai.com/api/docs/guides/chatkit
    upstream = await fetch(`${base}/v1/chatkit/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": "chatkit_beta=v1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ workflow: { id: workflowId }, user: userId }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to reach ChatKit API: ${message}` }, { status: 502 });
  }

  const payload = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;

  if (!upstream.ok) {
    const message =
      (typeof payload.error === "string" && payload.error) ||
      upstream.statusText ||
      "Failed to create session";
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  const clientSecret = payload.client_secret;
  if (!clientSecret) {
    return NextResponse.json({ error: "Missing client secret in response" }, { status: 502 });
  }

  const response = NextResponse.json({
    client_secret: clientSecret,
    expires_after: payload.expires_after,
  });

  if (!existing) {
    response.cookies.set(SESSION_COOKIE_NAME, userId, {
      maxAge: SESSION_COOKIE_MAX_AGE_S,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return response;
}

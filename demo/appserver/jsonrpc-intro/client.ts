// Stage A client — three calls that show the three JSON-RPC shapes you will
// ever see: a successful request/response, a structured error, and a
// fire-and-forget notification.

const URL = "http://localhost:3333/rpc";

let nextId = 1;

// `id: null` means "send as notification" — we omit the id from the envelope.
async function rpc(
  method: string,
  params: unknown,
  opts: { notify?: boolean } = {},
): Promise<unknown> {
  const body: Record<string, unknown> = {
    jsonrpc: "2.0",
    method,
    params,
  };
  if (!opts.notify) body.id = nextId++;

  const res = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  console.log(`→ ${method}`, JSON.stringify(body));
  if (res.status === 204) {
    console.log("← (no response — notification)\n");
    return undefined;
  }
  const data = await res.json();
  console.log("←", JSON.stringify(data), "\n");
  return data;
}

async function main() {
  console.log("=== 1. Request/response ===");
  await rpc("math.add", { a: 2, b: 3 });

  console.log("=== 2. Structured error (HTTP is still 200) ===");
  await rpc("math.divide", { a: 10, b: 0 });

  console.log("=== 3. Notification (no id, no response body) ===");
  await rpc("log", "hello from the client", { notify: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

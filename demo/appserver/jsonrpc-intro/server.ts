// Stage A — JSON-RPC 2.0 from first principles.
//
// One endpoint, one switch statement. Talking points:
//   - Every request carries jsonrpc: "2.0", a method name, optional params, and
//     an `id` that the client picks. The server echoes that id back so the
//     client can correlate response with request (think of it as a tracking
//     number, not a database key).
//   - Errors are NOT HTTP errors. The HTTP response is still 200; the JSON body
//     contains an `error` object with a numeric `code` and a `message`.
//   - A request WITHOUT an `id` is a "notification" — fire-and-forget. The
//     server must not return a response body for it. We use HTTP 204 to signal
//     "nothing to say."

import express from "express";

const app = express();
app.use(express.json());

type JsonRpcRequest = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  id?: number | string;
};

app.post("/rpc", (req, res) => {
  const { method, params, id } = req.body as JsonRpcRequest;
  const isNotification = id === undefined;

  // Tiny dispatcher. Real servers would validate params with zod/ajv.
  switch (method) {
    case "math.add": {
      const { a, b } = params as { a: number; b: number };
      if (isNotification) return res.status(204).end();
      return res.json({ jsonrpc: "2.0", id, result: a + b });
    }

    case "math.divide": {
      const { a, b } = params as { a: number; b: number };
      if (b === 0) {
        // -32602 is the JSON-RPC reserved code for "Invalid params".
        return res.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "division by zero" },
        });
      }
      if (isNotification) return res.status(204).end();
      return res.json({ jsonrpc: "2.0", id, result: a / b });
    }

    case "log": {
      // Notification-style: we just print and return nothing.
      console.log("[server log]", params);
      if (isNotification) return res.status(204).end();
      return res.json({ jsonrpc: "2.0", id, result: null });
    }

    default:
      return res.json({
        jsonrpc: "2.0",
        id: id ?? null,
        // -32601 = "Method not found".
        error: { code: -32601, message: `unknown method: ${method}` },
      });
  }
});

const PORT = 3333;
app.listen(PORT, () => {
  console.log(`JSON-RPC server listening on http://localhost:${PORT}/rpc`);
  console.log("Run client.ts in another terminal:  pnpm client");
});

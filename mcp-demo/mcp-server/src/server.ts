/**
 * The demo server is the union of six independent step modules. Each step
 * registers exactly one tool/UI pair (step 3 and step 5 register a *second*
 * app-only tool that shares the same UI resource — that is part of the lesson).
 *
 * Adding/removing a step here is the only place where the lineup changes; the
 * step folders themselves know nothing about each other.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register as registerStep1 } from "./steps/step1-hello/register.js";
import { register as registerStep2 } from "./steps/step2-host-context/register.js";
import { register as registerStep3 } from "./steps/step3-call-tool/register.js";
import { register as registerStep4 } from "./steps/step4-talk-to-model/register.js";
import { register as registerStep5 } from "./steps/step5-live-polling/register.js";
import { register as registerStep6 } from "./steps/step6-fullscreen-csp/register.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "MCP Apps Training Demo",
    version: "0.1.0",
  });

  registerStep1(server);
  registerStep2(server);
  registerStep3(server);
  registerStep4(server);
  registerStep5(server);
  registerStep6(server);

  return server;
}

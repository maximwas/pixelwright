import type { McpServer } from "@modelcontextprotocol/server";
import { StatusInputSchema, StatusOutputSchema } from "../../schemas/status.ts";
import type { BridgeView, StatusOutput, ToolContext } from "../../types/mcp.ts";
import { describeError } from "../describe-error.ts";
import { registerTool } from "../register-tool.ts";

export function registerStatusTool(server: McpServer, { bridge, version }: ToolContext): void {
  registerTool(server, {
    name: "status",
    title: "Connection status",
    description:
      "Lists the Figma files whose Pixelwright plugin is connected (name, current page, editor, whether Allow edits is on) and marks the active one: the file whose plugin window was in front last, which every tool uses when no file is named. Call it first, and whenever a tool says no file is connected: hint says what to do. probe: true also pings the active file's plugin.",
    input: StatusInputSchema,
    output: StatusOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    run: ({ probe }) => readStatus(bridge, version, probe),
  });
}

export async function readStatus(bridge: BridgeView, version: string, probe: boolean): Promise<StatusOutput> {
  const { role, port, hint } = bridge.status();
  const files = bridge.plugins().map(({ session, info, active }) => ({
    session,
    name: info.file.name,
    key: info.file.key,
    page: info.page.name,
    editorType: info.editorType,
    allowEdits: info.allowEdits,
    active,
    pluginVersion: info.pluginVersion,
  }));

  return {
    server: {
      version,
      role,
      port,
    },
    files,
    probe: probe ? await ping(bridge) : null,
    hint,
  };
}

async function ping(bridge: BridgeView): Promise<StatusOutput["probe"]> {
  const started = performance.now();

  try {
    await bridge.request("ping", null);

    return {
      ok: true,
      ms: Math.round(performance.now() - started),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      ms: null,
      error: describeError(error),
    };
  }
}

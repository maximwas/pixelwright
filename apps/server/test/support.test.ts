import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import { SUPPORT_LINKS } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import * as z from "zod";
import { readConfig } from "../src/config/config.ts";
import { SERVER_INSTRUCTIONS } from "../src/constants/mcp.ts";
import { SUPPORT_REMINDER_INTERVAL_MS } from "../src/constants/support.ts";
import { registerTool } from "../src/mcp/register-tool.ts";
import { registerApplyTool } from "../src/mcp/tools/apply.ts";
import { registerNodeTools } from "../src/mcp/tools/nodes.ts";
import { registerTokensTool } from "../src/mcp/tools/tokens.ts";
import { SupportReminder } from "../src/support/support-reminder.ts";
import type { ToolContext } from "../src/types/mcp.ts";

const stateFile = async () => join(await mkdtemp(join(tmpdir(), "pixelwright-support-")), "support.json");

type Handler = (args: unknown) => Promise<{ structuredContent: Record<string, unknown> }>;

/** An McpServer that only records what is registered. */
function recordingServer() {
  const tools = new Map<string, { outputSchema: z.ZodObject; handler: Handler }>();
  const server = {
    registerTool: (name: string, meta: { outputSchema: z.ZodObject }, handler: Handler) => {
      tools.set(name, {
        outputSchema: meta.outputSchema,
        handler,
      });
    },
  } as unknown as McpServer;

  return {
    server,
    tools,
  };
}

describe("the support note", () => {
  it("comes at most once a week on this computer, with where to support the project", async () => {
    let now = Date.UTC(2026, 9, 12);
    const reminder = new SupportReminder({
      file: await stateFile(),
      enabled: true,
      links: SUPPORT_LINKS,
      now: () => now,
    });
    const note = await reminder.due();

    expect(note).toContain("https://ko-fi.com/maksymvasianin");
    expect(note).toContain("https://send.monobank.ua/jar/7o9oMrbXTj");
    expect(await reminder.due()).toBeNull();
    now += SUPPORT_REMINDER_INTERVAL_MS - 1;
    expect(await reminder.due()).toBeNull();
    now += 1;
    expect(await reminder.due()).toBe(note);
  });

  it("never comes when turned off, and a broken state file only means it is due", async () => {
    const file = await stateFile();

    expect(
      await new SupportReminder({
        file,
        enabled: false,
        links: SUPPORT_LINKS,
      }).due(),
    ).toBeNull();
    await writeFile(file, "{ broken");
    expect(
      await new SupportReminder({
        file,
        enabled: true,
        links: SUPPORT_LINKS,
      }).due(),
    ).not.toBeNull();
  });

  it("is on unless PIXELWRIGHT_SUPPORT_REMINDERS is off", () => {
    expect(readConfig({}).supportReminders).toBe(true);
    expect(readConfig({ PIXELWRIGHT_SUPPORT_REMINDERS: "off" }).supportReminders).toBe(false);
  });

  it("rides on a tool's result only after a change that worked, and the agent is told how to pass it on", async () => {
    const { server, tools } = recordingServer();

    registerTool(
      server,
      {
        name: "write",
        title: "Write",
        description: "Writes.",
        input: z.object({ dryRun: z.boolean() }),
        output: z.object({ changed: z.array(z.string()) }),
        annotations: {},
        run: async ({ dryRun }) => ({ changed: dryRun ? [] : ["1:2"] }),
        changed: (output) => output.changed.length > 0,
      },
      { due: async () => "Pixelwright is free." },
    );

    const write = tools.get("write");

    expect((await write?.handler({ dryRun: false }))?.structuredContent.support).toBe("Pixelwright is free.");
    expect((await write?.handler({ dryRun: true }))?.structuredContent.support).toBeUndefined();
    expect(SERVER_INSTRUCTIONS).toContain("When a result carries support");
  });

  it("can ride on every tool that writes", () => {
    const { server, tools } = recordingServer();
    const context = { support: { due: async () => null } } as unknown as ToolContext;

    registerApplyTool(server, context);
    registerTokensTool(server, context);
    registerNodeTools(server, context);

    for (const name of ["design_apply", "tokens_apply", "nodes_delete"]) {
      expect(Object.keys(tools.get(name)?.outputSchema.shape ?? {}), name).toContain("support");
    }
  });
});

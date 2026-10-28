import { describe, expect, it } from "vitest";
import type { PluginLink, PluginLinkState } from "@/core/ports/plugin-link/plugin-link.port.ts";
import { StatusTool } from "@/server/tools/status/status.tool.ts";
import { VERSION } from "@/shared/version/version.constants.ts";

/** A bridge state as a value: status only reads it. */
class LinkState implements PluginLink {
  readonly #state: PluginLinkState;

  constructor(state: PluginLinkState) {
    this.#state = state;
  }

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  state(): PluginLinkState {
    return this.#state;
  }
}

describe("StatusTool", () => {
  it("shows the server's version, channel and protocol with the bridge's role, port and hint", async () => {
    const link = new LinkState({
      role: "disabled",
      port: 18_721,
      files: [],
      pairing: null,
      hint: "The plugin bridge is off.",
    });
    const answer = await new StatusTool(link).execute({});

    expect(answer.structuredContent).toEqual({
      server: {
        version: VERSION,
        channel: "pixelwright-new",
        role: "disabled",
        protocol: 6,
        port: 18_721,
      },
      files: [],
      probe: null,
      pairing: null,
      hint: "The plugin bridge is off.",
    });
  });

  it("passes on the pairing code the bridge shows while a plugin waits, and the files connected", async () => {
    const pairing = {
      code: "123456",
      expiresInSeconds: 120,
      lockedForSeconds: null,
      waiting: 1,
    };
    const file = {
      session: "6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13",
      name: "Test MCP",
      key: null,
      page: "Start here",
      editorType: "figma",
      allowEdits: false,
      active: true,
      pluginVersion: "0.8.0",
    };
    const answer = await new StatusTool(
      new LinkState({
        role: "owner",
        port: 18_721,
        files: [file],
        pairing,
        hint: "A plugin is waiting to be paired.",
      }),
    ).execute({});

    expect(answer.structuredContent).toMatchObject({
      server: { role: "owner" },
      files: [file],
      pairing,
    });
  });
});

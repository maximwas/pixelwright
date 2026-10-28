import { describe, expect, it } from "vitest";
import type { PluginLink, PluginLinkState } from "../../../core/ports/plugin-link.port.ts";
import { VERSION } from "../../../shared/version/version.constants.ts";
import { StatusTool } from "./status.tool.ts";

/** A bridge state as a value: status only reads it. */
class LinkState implements PluginLink {
  readonly #state: PluginLinkState;

  constructor(state: PluginLinkState) {
    this.#state = state;
  }

  state(): PluginLinkState {
    return this.#state;
  }
}

describe("StatusTool", () => {
  it("shows the server's version, channel and protocol with the bridge's role, port and hint", async () => {
    const link = new LinkState({
      role: "disabled",
      port: 18_721,
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
});

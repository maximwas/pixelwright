import { describe, expect, it } from "vitest";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { TokensUsageTool } from "@/server/tools/tokens-usage/tokens-usage.tool.ts";

/** A text style with letter spacing and case, and an effect style with a background blur, as the variables op lists them. */
const RAW = {
  collections: [],
  variables: [],
  external: {},
  styles: [
    { id: "S:display", name: "Display", type: "TEXT", remote: false },
    { id: "S:glass", name: "Glass", type: "EFFECT", remote: false },
  ],
};

const LAYERS = [{ id: "1:2", name: "Title", type: "TEXT", property: "text" }];

/** A plugin whose variables op answers RAW and whose usage op finds one layer, the requests it got kept. */
class UsagePlugin implements PluginLink {
  readonly requests: { op: string; input: unknown }[] = [];

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  async state(): Promise<PluginLinkState> {
    throw new Error("only status reads the state");
  }

  role(): PluginLinkRole {
    return "owner";
  }

  files(): readonly ConnectedFile[] {
    return [];
  }

  async request({ op, input }: OpRequest): Promise<unknown> {
    this.requests.push({ op, input });

    return op === "variables" ? RAW : { layers: LAYERS, more: false, cut: false };
  }
}

function tool() {
  const plugin = new UsagePlugin();
  const session = new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", plugin, []);

  return { plugin, usage: new TokensUsageTool(session, new TokenNames()) };
}

// T-106, D-20: every token tokens_read writes a style as names that style, its letter spacing, case and blurs too.
describe("the tokens_usage tool", () => {
  it.each([
    ["--Display-font", "S:display", "text style"],
    ["--Display-letter-spacing", "S:display", "text style"],
    ["--Glass-backdrop-filter", "S:glass", "effect style"],
  ])("finds the layers using the style %s is written for", async (token, id, kind) => {
    const { plugin, usage } = tool();
    const answer = (await usage.execute({ token })).structuredContent;

    expect(plugin.requests[1]).toEqual({ op: "usage", input: { id, variable: false, budgetMs: 20_000 } });
    expect(answer).toEqual({
      token,
      kind,
      name: kind === "text style" ? "Display" : "Glass",
      layers: LAYERS,
      more: false,
    });
  });

  it("refuses a token no style is written as: a text style's own name is not one, its font shorthand is", async () => {
    await expect(tool().usage.execute({ token: "--Display" })).rejects.toThrow(
      /No style or variable is named --Display /,
    );
  });
});

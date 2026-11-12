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

const BLACK = { r: 0, g: 0, b: 0 };

/** Raw colour uses as the usage op lists them: a layer may use one colour twice (a fill and a gradient stop). */
const RAW_USES = [
  { id: "1:2", name: "Title", type: "TEXT", property: "fills", color: { r: 1, g: 0, b: 0 } },
  { id: "1:3", name: "Line", type: "RECTANGLE", property: "strokes", color: BLACK, hidden: true },
  { id: "1:4", name: "Card", type: "FRAME", property: "fills", color: BLACK },
  { id: "1:4", name: "Card", type: "FRAME", property: "fills", color: BLACK },
];

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

    if (op === "variables") {
      return RAW;
    }

    const raw = typeof input === "object" && input !== null && "raw" in input;

    return { layers: raw ? RAW_USES : LAYERS, more: false, cut: false };
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

describe("tokens_usage raw", () => {
  it("groups the raw colours by hex, each layer and property once, the colour most layers use first", async () => {
    const { plugin, usage } = tool();
    const answer = (await usage.execute({ raw: true })).structuredContent;

    expect(plugin.requests).toEqual([{ op: "usage", input: { raw: true, budgetMs: 20_000 } }]);
    expect(answer).toEqual({
      colors: [
        {
          color: "#000000",
          count: 2,
          layers: [
            { id: "1:3", name: "Line", type: "RECTANGLE", property: "strokes", hidden: true },
            { id: "1:4", name: "Card", type: "FRAME", property: "fills" },
          ],
        },
        { color: "#FF0000", count: 1, layers: [{ id: "1:2", name: "Title", type: "TEXT", property: "fills" }] },
      ],
      more: false,
    });
  });

  it.each([[{}], [{ token: "--Display-font", raw: true }]])(
    "refuses a call with neither or both of token and raw: %j",
    async (args) => {
      await expect(tool().usage.execute(args)).rejects.toThrow(/exactly one of token .* and raw: true/);
    },
  );
});

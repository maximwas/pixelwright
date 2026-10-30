import { describe, expect, it } from "vitest";
import { DesignLint } from "@/core/checks/design-lint.ts";
import { LayoutRules } from "@/core/checks/lint/layout-rules.ts";
import { LintRegistry } from "@/core/checks/lint/lint-registry.ts";
import { LintWalk } from "@/core/checks/lint/lint-walk.ts";
import { TokenRules } from "@/core/checks/lint/token-rules.ts";
import { FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { EffectsGroup } from "@/core/css/groups/effects/effects-group.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { LayoutGuess } from "@/core/design/hints/layout-guess.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { DesignLintTool } from "@/server/tools/design-lint/design-lint.tool.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/** A frame laid out with a 13 px top padding: one off-scale finding. */
const readOf = (id: string) => ({
  reads: [
    {
      root: {
        id,
        name: `Frame ${id}`,
        type: "FRAME",
        visible: true,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        layoutMode: "VERTICAL",
        paddingTop: 13,
        childCount: 0,
      },
      styles: {},
      variables: {},
    },
  ],
  missing: [],
  cuts: [],
});

/** A file with one page, Pricing, holding two frames; `read` answers the read op for one layer. */
class LintPlugin implements PluginLink {
  readonly asked: string[] = [];
  readonly #read: (id: string) => unknown;

  constructor(read: (id: string) => unknown = readOf) {
    this.#read = read;
  }

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
    if (op === "file_map") {
      this.asked.push(op);

      return { pages: [{ id: "0:1", name: "Pricing", current: true }], more: false };
    }

    if (op === "outline") {
      this.asked.push(`${op} ${(input as { node: string }).node}`);

      return {
        root: {
          id: "0:1",
          name: "Pricing",
          type: "PAGE",
          children: [
            { id: "1:1", name: "Desktop", type: "FRAME" },
            { id: "1:2", name: "Mobile", type: "FRAME" },
          ],
        },
      };
    }

    const [id = ""] = (input as { nodes: string[] }).nodes;

    this.asked.push(`${op} ${id}`);

    return this.#read(id);
  }
}

const format = new NumberFormat();
const names = new TokenNames();

const toolOf = (plugin: LintPlugin) =>
  new DesignLintTool(
    new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", plugin, []),
    new DesignLint(
      new LintRegistry(
        new TokenRules(
          new FontShorthand(format),
          new EffectsGroup(
            new SolidPaint(names),
            new CssLength(new CssVar(new CssSplit()), format, names),
            format,
            names,
          ),
          format,
          names,
        ),
        new LayoutRules(new LayoutGuess(format), format),
      ),
      new LintWalk(),
    ),
  );

const lint = async (plugin: LintPlugin, within?: string[]) =>
  (await toolOf(plugin).execute(within === undefined ? {} : { within })).structuredContent as {
    summary: string;
    findings: { id: string }[];
    notes: string[];
  };

describe("design_lint: what it reads", () => {
  it("lints a page's top layers, each read on its own, and names the page", async () => {
    const plugin = new LintPlugin();
    const { summary, findings } = await lint(plugin, ["0:1"]);

    expect(plugin.asked).toEqual(["file_map", "outline 0:1", "read 1:1", "read 1:2"]);
    expect(summary).toBe("2 findings in page Pricing: 0 errors, 0 warnings, 2 info.");
    expect(findings.map(({ id }) => id)).toEqual(["1:1", "1:2"]);
  });

  it("lints the current page when within is left out", async () => {
    const plugin = new LintPlugin();

    expect((await lint(plugin)).summary).toBe("2 findings in page Pricing: 0 errors, 0 warnings, 2 info.");
  });

  // K-033, O-001: a layer it could not read is named and counted, never taken for a clean one.
  it("names a layer it could not read, and lints the rest", async () => {
    const plugin = new LintPlugin((id) => (id === "9:9" ? { reads: [], missing: ["9:9"], cuts: [] } : readOf(id)));
    const { summary, notes, findings } = await lint(plugin, ["1:1", "9:9"]);

    expect(summary).toBe(
      "Not checked: 1 of 2 layers could not be read (the notes say why). 1 findings in the rest: 0 errors, 0 warnings, 1 info.",
    );
    expect(notes).toEqual([expect.stringMatching(/^9:9 was not read: /)]);
    expect(findings.map(({ id }) => id)).toEqual(["1:1"]);
  });

  // B-008: a read that failed for every layer is an error, never "No findings".
  it("fails, never answering no findings, when it could read none of the layers", async () => {
    const plugin = new LintPlugin(() => {
      throw new PixelwrightError("OP_FAILED", "Attempted to invoke callback with invalid id -32605");
    });

    await expect(lint(plugin, ["3:603"])).rejects.toMatchObject({
      code: "OP_FAILED",
      message: "3:603 was not read: Attempted to invoke callback with invalid id -32605",
    });
  });
});

import { describe, expect, it } from "vitest";
import { VersionedWrite } from "@/server/app/writes/versioned-write.ts";
import { TokensBindTool } from "@/server/tools/tokens-bind/tokens-bind.tool.ts";
import { bindOp } from "@/shared/ops/bind/bind.manifest.ts";
import { bindWriteOp } from "@/shared/ops/bind/bind-write.manifest.ts";
import type { AnyOpContract } from "@/shared/ops/op-contract.ts";
import { saveVersionOp } from "@/shared/ops/save-version/save-version.manifest.ts";
import { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";

const RAW = { collections: [], variables: [], external: {}, styles: [] };

const SCAN = { layers: [], instances: 0, defaults: 0, cut: false };

const GROUP = { kind: "color", field: "background", value: "#369", count: 3, examples: ["1:3", "1:4", "1:5"] };

const PLANNED = {
  bound: [{ ...GROUP, token: "--Brand" }],
  ambiguous: [],
  unmatched: [{ ...GROUP, value: "#346699", count: 1, examples: ["1:6"] }],
  remapped: [],
  layers: 3,
  errors: [],
  notes: [],
  more: false,
};

/** The per-use plan core hands item 51's writer: the answer never carries it. */
const BINDS = { binds: [{ layer: "1:3", kind: "effect" }], remaps: [] };

/** What the writer op says Figma refused, per layer. */
const FAILED = [{ id: "1:4", message: "Figma cannot reach the variable --Brand now: enable its library." }];

/**
 * The tool over a session that keeps every op it runs and its input, and a core whose plan is `planned`; the remaps'
 * from tokens name the sources given.
 */
function setup(sources = ["VariableID:Brand"], planned: unknown = { result: PLANNED, plan: BINDS }) {
  const ops: [AnyOpContract, unknown][] = [];
  const answers = new Map<AnyOpContract, unknown>([
    [bindOp, SCAN],
    [saveVersionOp, { id: "v:1" }],
    [bindWriteOp, { failed: FAILED }],
  ]);
  const session = {
    run: async (op: AnyOpContract, input: unknown) => {
      ops.push([op, input]);

      return answers.get(op) ?? RAW;
    },
  };
  const index = { sources: () => sources };
  const tool = new TokensBindTool(
    session as never,
    new VersionedWrite(),
    { due: () => null } as never,
    { index: () => index, plan: () => planned } as never,
  );

  return { tool, ops };
}

describe("TokensBindTool", () => {
  it("binds core's plan through the writer op after the version, Figma's refusals among the errors (T-167)", async () => {
    const { tool, ops } = setup();
    const answer = await tool.execute({ within: "1:2", version: "Before bind" });

    expect(ops.map(([op]) => op)).toEqual([variablesOp, bindOp, saveVersionOp, bindWriteOp]);
    expect(ops[3]).toEqual([bindWriteOp, BINDS]);
    expect(answer.structuredContent).toEqual({
      ...PLANNED,
      errors: FAILED,
      summary: "Bound 3 raw values to tokens on 3 layers; 1 value has no token; 1 error.",
      version: { id: "v:1", title: "Before bind" },
    });
  });

  it("saves no version and runs no writer when core plans nothing to bind (T-167)", async () => {
    const { tool, ops } = setup(undefined, {
      result: { ...PLANNED, bound: [], layers: 0 },
      plan: { binds: [], remaps: [] },
    });

    await tool.execute({ within: "1:2", version: "Before bind" });
    await tool.execute({ within: "1:2" });

    expect(ops.map(([op]) => op)).toEqual([variablesOp, bindOp, variablesOp, bindOp]);
  });

  it("reads the tokens the layers can use, scans the layers, and answers core's plan with its summary (T-167)", async () => {
    const { tool, ops } = setup();
    const answer = await tool.execute({ within: "1:2", remap: [{ from: "--Brand", to: "--Ink" }], dryRun: true });

    expect(ops).toEqual([
      [variablesOp, { libraries: false, used: true, within: "1:2" }],
      [
        bindOp,
        { within: "1:2", kinds: ["color", "number", "text", "effect"], remap: ["VariableID:Brand"], overrides: false },
      ],
    ]);
    expect(answer.structuredContent).toEqual({
      ...PLANNED,
      summary: "Would bind 3 raw values to tokens on 3 layers; 1 value has no token.",
      dry: true,
    });
  });

  it('reads the tokens every page uses for within "file"', async () => {
    const { tool, ops } = setup();

    await tool.execute({ within: "file", kinds: ["color"], dryRun: true });

    expect(ops[0]).toEqual([variablesOp, { libraries: false, used: true, within: "file" }]);
  });

  it("scans no layer when no remap's from token names a style or variable: core refuses each pair", async () => {
    const { tool, ops } = setup([]);

    await tool.execute({ within: "1:2", remap: [{ from: "--Gone", to: "--Ink" }], dryRun: true });

    expect(ops.map(([op]) => op)).toEqual([variablesOp]);
  });
});

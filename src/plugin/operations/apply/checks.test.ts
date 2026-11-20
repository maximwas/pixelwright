import { describe, expect, it } from "vitest";
import { Capabilities } from "@/plugin/adapters/figma/capabilities.ts";
import { ApplyChecks } from "@/plugin/operations/apply/checks.ts";
import { HIDDEN_KEY, STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";
import { FigmaPropsSchema } from "@/shared/write-intents/write-intent.schema.ts";

function checks() {
  return new ApplyChecks({} as never, {} as never, new Capabilities(), []);
}

function change(props: object): ApplyChangeData {
  return {
    line: 1,
    column: 1,
    kind: "update",
    ref: "r",
    id: "1:1",
    tag: "Text",
    parent: null,
    index: 0,
    props,
    sources: {},
  } as ApplyChangeData;
}

describe("ApplyChecks.refusals: a prop a step writes is not refused as unwritten", () => {
  it("lets a text's font-variation-settings through (NEW-090 live: it was refused as not written)", () => {
    const refusals = checks().refusals({ type: "TEXT" }, change({ fontVariations: { wght: 600 } }));

    expect(refusals).toEqual([]);
  });

  it("refuses a font-variation-settings on a layer that holds no text, as every text setting", () => {
    const refusals = checks().refusals({ type: "FRAME" }, change({ fontVariations: { wght: 600 } }));

    expect(refusals.map(({ keys }) => keys)).toEqual([["fontVariations"]]);
  });

  it("knows every prop a change can carry: no key of the schema is left to the not-written refusal", () => {
    const known = new Set<string>([HIDDEN_KEY, ...Object.values(STEP_KEYS).flat()]);

    expect(Object.keys(FigmaPropsSchema.shape).filter((key) => !known.has(key))).toEqual([]);
  });
});

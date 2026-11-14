import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { BIND_KIND, BIND_LIMIT, BIND_PAINT_AT, BIND_SOURCE } from "@/shared/ops/bind/bind.constants.ts";
import { BindPlanSchema } from "@/shared/ops/bind/bind.schema.ts";

/** A nested instance's layer id, a 66-character token name, a 60-character variable id and a 40-character library key. */
const TARGET = {
  token: "--Brand-Colors-Primary-Action-Background-Hover-Pressed-Disabled-500",
  id: "VariableID:0123456789abcdef0123456789abcdef01234567/1234:5678",
  source: BIND_SOURCE.variable,
  key: "0123456789abcdef0123456789abcdef01234567",
};
const RADII = ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"];
const RANGE = { start: 0, end: 120 };
const BINDS_PER_LAYER = 6;

function layerId(position: number): string {
  return `I1234:5678;1234:5678;1234:${position}`;
}

/** The six kinds of use a layer may hold at once, each with the longest names. */
function usesOf(layer: string) {
  const bound = { layer, target: TARGET, snapped: true };

  return [
    { kind: BIND_KIND.color, at: BIND_PAINT_AT.fills, index: 0, opacity: 0.5, ...bound },
    { kind: BIND_KIND.color, at: BIND_PAINT_AT.run, index: 0, range: RANGE, opacity: 0.5, ...bound },
    { kind: BIND_KIND.number, fields: ["paddingTop"], ...bound },
    { kind: BIND_KIND.number, fields: RADII, ...bound },
    { kind: BIND_KIND.effect, ...bound },
    { kind: BIND_KIND.text, range: RANGE, ...bound },
  ];
}

describe("BindPlanSchema", () => {
  // The scan stops at 2,000 layers, but the plan is what crosses the bridge: a plan over a frame cannot be written.
  it("holds the plan of a full scan, six uses to a layer with the longest names, under one bridge frame (T-167)", () => {
    const layers = [...Array(BIND_LIMIT.maxLayers).keys()].map((position) => layerId(position));
    const binds = layers.flatMap((layer) => usesOf(layer).slice(0, BINDS_PER_LAYER));
    const remaps = layers.flatMap((layer) =>
      Array.from({ length: BINDS_PER_LAYER }, () => ({ layer, from: TARGET.id, to: TARGET })),
    );

    for (const plan of [
      { binds, remaps: [] },
      { binds: [], remaps },
    ]) {
      const bytes = new TextEncoder().encode(JSON.stringify(zod.parse(BindPlanSchema, plan))).length;

      expect(bytes).toBeLessThan(LIMITS.frameBytes);
    }
  });
});

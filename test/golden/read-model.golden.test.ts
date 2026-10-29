import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

/** The four Orbit snapshots (C-190), as files: 0.7.0's plugin snapshots with the model's header added. */
const FIXTURES = ["customers", "desktop-top", "plans", "pricing"];

function fixtureText(name: string): string {
  return readFileSync(new URL(`fixtures/orbit-${name}.json`, import.meta.url), "utf8");
}

describe("the read model over the Orbit fixtures", () => {
  // A schema writes its fields in its own order: the text comes back equal only if every field kept its name and place,
  // which baselines v1 rely on (D-33).
  it.each(FIXTURES)("reads orbit-%s with the strict schema and writes it back to the same JSON", (name) => {
    const text = fixtureText(name);
    const model = zod.parse(ReadModelSchema, JSON.parse(text));

    expect(model).toMatchObject({ model: 1, profile: "design" });
    expect(`${JSON.stringify(model, null, 2)}\n`).toBe(text);
  });

  it("reads a v1 baseline snapshot, which has no header, as a design model", () => {
    const { model: _model, profile: _profile, ...snapshot } = JSON.parse(fixtureText("desktop-top"));

    expect(zod.parse(ReadModelSchema, snapshot)).toStrictEqual({ model: 1, profile: "design", ...snapshot });
  });

  it("refuses a layer field it does not know, so a renamed field never passes unseen", () => {
    const raw = JSON.parse(fixtureText("desktop-top"));
    const { fills, ...root } = raw.root;

    expect(zod.safeParse(ReadModelSchema, { ...raw, root: { ...root, fill: fills } }).success).toBe(false);
  });
});

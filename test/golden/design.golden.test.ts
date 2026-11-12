import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { design, fit, fixture, reader } from "./support/design-classes.ts";

/** A golden file as written. */
function golden(name: string): string {
  return readFileSync(new URL(`./__golden__/${name}`, import.meta.url), "utf8");
}

/** The layer of an id in a read, at any depth. */
function layerOf(layer: ReadLayer, id: string): ReadLayer | undefined {
  return layer.id === id ? layer : (layer.children ?? []).map((child) => layerOf(child, id)).find(Boolean);
}

/**
 * design_read's XML, the rest of its read (tokens, text styles, fonts, assets, truncated) and the cuts that fit it into
 * small budgets, for each Orbit fixture, byte for byte as 0.7.0 wrote them (C-191, C-192, D-21). A golden moves only in
 * its own commit with its decision: D-18 stubs, D-20 notes, a D-15 value.
 */
describe.each(["orbit-customers", "orbit-desktop-top", "orbit-plans", "orbit-pricing"])(
  "golden design (%s)",
  (name) => {
    const model = fixture(name);

    it("keeps the XML", () => {
      expect(`${design.read(model).xml}\n`).toBe(golden(`${name}.xml`));
    });

    it("keeps the rest of the read", () => {
      // 0.7.0's read golden is the XML's own catalogue: the hints have their own golden below.
      const { xml: _xml, hints: _hints, ...rest } = reader.read(model);

      expect(`${JSON.stringify(rest, null, 2)}\n`).toBe(golden(`${name}.read.json`));
    });

    it("keeps the cuts that fit it into small budgets", () => {
      const plans = [300, 800, 2_000, 6_000].map((maxChars) => {
        const { cut, limits } = fit.plan(model, maxChars);

        return { maxChars, cut: [...cut], limits: Object.fromEntries(limits) };
      });

      expect(`${JSON.stringify(plans, null, 2)}\n`).toBe(golden(`${name}.fit.json`));
    });

    it("keeps the hints (C-193)", () => {
      expect(`${JSON.stringify(reader.read(model).hints, null, 2)}\n`).toBe(golden(`${name}.hints.json`));
    });
  },
);

// C-1.3 as 0.7.0 wrote it: a Text's textStyle, then mask, then src; only a Text that is a mask shows the order.
it("writes a masking Text's textStyle before its mask (C-1.3)", () => {
  const model = fixture("orbit-pricing");

  Object.assign(layerOf(model.root, "54:231") ?? {}, { isMask: true, maskType: "ALPHA" });

  expect(design.read(model).xml).toContain('<Text id="54:231" name="Wordmark" textStyle="Heading/H3" mask="alpha"');
});

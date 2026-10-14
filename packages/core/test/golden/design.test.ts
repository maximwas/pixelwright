import { describe, expect, it } from "vitest";
import { designHints, designMotion, designXml, fitPlan, motionSummary } from "../../src/index.ts";
import { everyHintSnapshot } from "../helpers/every-hint.ts";
import { fixture } from "../helpers/fixtures.ts";
import { everyMotionSnapshot } from "../helpers/motion.ts";

/**
 * design_read's XML, the rest of its read (assets, tokens), the cuts that fit it into small budgets and its hints for
 * each Orbit fixture, as the code before the rewrite wrote them. A rewrite must reproduce them byte for byte.
 */
describe.each(["orbit-customers", "orbit-desktop-top", "orbit-plans", "orbit-pricing"])(
  "golden design (%s)",
  (name) => {
    const snapshot = fixture(name);
    const { xml, ...rest } = designXml(snapshot);

    it("keeps the XML", async () => {
      await expect(`${xml}\n`).toMatchFileSnapshot(`__golden__/${name}.xml`);
    });

    it("keeps the rest of the read", async () => {
      await expect(`${JSON.stringify(rest, null, 2)}\n`).toMatchFileSnapshot(`__golden__/${name}.read.json`);
    });

    it("keeps the cuts that fit it into small budgets", async () => {
      const plans = [300, 800, 2_000, 6_000].map((maxChars) => {
        const { cut, limits } = fitPlan(snapshot, maxChars);

        return {
          maxChars,
          cut: [...cut],
          limits: Object.fromEntries(limits),
        };
      });

      await expect(`${JSON.stringify(plans, null, 2)}\n`).toMatchFileSnapshot(`__golden__/${name}.fit.json`);
    });

    it("keeps the hints", async () => {
      await expect(`${JSON.stringify(designHints(snapshot), null, 2)}\n`).toMatchFileSnapshot(
        `__golden__/${name}.hints.json`,
      );
    });
  },
);

describe("golden hints", () => {
  it("keeps every kind's words, in their order", async () => {
    await expect(`${JSON.stringify(designHints(everyHintSnapshot()), null, 2)}\n`).toMatchFileSnapshot(
      "__golden__/every-hint.hints.json",
    );
  });
});

describe("golden motion", () => {
  it("keeps every case's keyframes and summaries", async () => {
    const snapshot = everyMotionSnapshot();
    const summaries = Object.fromEntries(
      (snapshot.root.children ?? []).map((node) => [node.id, motionSummary(node) ?? null]),
    );

    await expect(
      `${JSON.stringify(
        {
          motion: designMotion(snapshot),
          summaries,
        },
        null,
        2,
      )}\n`,
    ).toMatchFileSnapshot("__golden__/every-motion.json");
  });
});

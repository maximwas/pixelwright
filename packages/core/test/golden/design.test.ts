import { describe, expect, it } from "vitest";
import { designXml } from "../../src/index.ts";
import { fixture } from "../helpers/fixtures.ts";

/**
 * design_read's XML and the rest of its read (assets, hints) for each Orbit fixture, as the code before the rewrite
 * wrote them. A rewrite must reproduce them byte for byte.
 */
describe.each(["orbit-customers", "orbit-desktop-top", "orbit-plans", "orbit-pricing"])(
  "golden design (%s)",
  (name) => {
    const { xml, ...rest } = designXml(fixture(name));

    it("keeps the XML", async () => {
      await expect(`${xml}\n`).toMatchFileSnapshot(`__golden__/${name}.xml`);
    });

    it("keeps the rest of the read", async () => {
      await expect(`${JSON.stringify(rest, null, 2)}\n`).toMatchFileSnapshot(`__golden__/${name}.read.json`);
    });
  },
);

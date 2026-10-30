import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

/** Orbit's Pricing – Desktop frame. */
const DESKTOP = "54:227";

/** An id no file has: the read op lists it as missing. */
const MISSING = "999999:1";

const NAME = { gap: "live:lint:gap" } as const;

/** What these cases read of design_lint's answer. */
interface Lint {
  readonly summary: string;
  readonly findings: readonly { readonly rule: string; readonly severity: string; readonly id: string }[];
}

/** The rules item 53 checks; the rest come with item 54. */
const CHECKED = ["text-style", "no-auto-layout", "overflow", "raw-number", "off-scale", "effect-style"];

const RANK: Readonly<Record<string, number>> = { error: 0, warning: 1, info: 2 };

// Makes its layer through execute, so no retry; the run's sweep removes every live: layer at the end.
describe("read/lint", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;
  let gap: string;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();

    const { result } = await client.call("execute", {
      file,
      code: `const section = await pw.node(${JSON.stringify(scratch)});
const frame = figma.createFrame();
frame.name = ${JSON.stringify(NAME.gap)};
section.appendChild(frame);
frame.layoutMode = "HORIZONTAL";
frame.itemSpacing = 13;
for (const index of [0, 1]) {
  const box = figma.createRectangle();
  box.name = "live:lint:box-" + index;
  frame.appendChild(box);
}
return frame.id;`,
    });

    gap = String(result);
  });

  afterAll(async () => {
    await client.close();
  });

  it("lints Orbit's Pricing – Desktop with this item's rules only, errors first", async () => {
    const { findings } = (await client.call("design_lint", { file, within: [DESKTOP] })) as unknown as Lint;
    const ranks = findings.map(({ severity }) => RANK[severity] ?? -1);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every(({ rule }) => CHECKED.includes(rule))).toBe(true);
    expect(ranks).toEqual([...ranks].sort((first, second) => first - second));
  });

  it("finds a raw 13 px gap off the 4 px grid", async () => {
    const { findings } = (await client.call("design_lint", { file, within: [gap] })) as unknown as Lint;

    expect(findings).toContainEqual(expect.objectContaining({ rule: "off-scale", id: gap }));
  });

  // K-033: an id that does not exist is counted as not checked, never passed as clean.
  it("says a layer it could not read was not checked", async () => {
    const { summary } = (await client.call("design_lint", { file, within: [gap, MISSING] })) as unknown as Lint;

    expect(summary).toMatch(/^Not checked: 1 of 2 layers could not be read/);
  });
});

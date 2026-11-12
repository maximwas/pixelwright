import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { designXml, fitDesign, type Snapshot, type SnapshotNode, SnapshotSchema } from "../src/index.ts";

const fixture = (name: string) =>
  SnapshotSchema.parse(JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8")));

/** Orbit's three plan cards, each with three features; Pro has a badge the others lack. */
const PLANS = fixture("orbit-plans");

/** Orbit's customers section: three logos placed by hand, in two brands. */
const CUSTOMERS = fixture("orbit-customers");

/** The snapshot with one layer's children cut to their first `count`. */
function withChildren(snapshot: Snapshot, id: string, count: number): Snapshot {
  const cut = (node: SnapshotNode): SnapshotNode => ({
    ...node,
    ...(node.children === undefined
      ? {}
      : {
          children: (node.id === id ? node.children.slice(0, count) : node.children).map(cut),
          childCount: node.id === id ? count : node.childCount,
        }),
  });

  return {
    ...snapshot,
    root: cut(snapshot.root),
  };
}

describe("design_read's repeats", () => {
  it("reads alike neighbours as their first, marked $repeat, with each one's own values as rows", () => {
    const read = designXml(PLANS, { repeats: true });

    expect(read.xml).toContain(
      '<Frame id="I54:244;54:214" name="Feature" display="flex" align-items="center" gap="var(--space-8)" overflow="hidden" $repeat="3">',
    );
    expect(read.xml).not.toContain('id="I54:244;54:218"');
    expect(read.repeats?.[0]).toEqual({
      template: "I54:244;54:214",
      layers: ["I54:244;54:214", "I54:244;54:218", "I54:244;54:222"],
      fields: [
        {
          layer: "I54:244;54:215",
          path: 'Icon "Icon/Check"',
          attribute: "src",
        },
        {
          layer: "I54:244;54:217",
          path: 'Text "Text"',
          attribute: "$text",
        },
      ],
      rows: [
        ["assets/icon-check.svg", "Unlimited projects"],
        ["assets/icon-check-2.svg", "Version history for 30 days"],
        ["assets/icon-check-3.svg", "Email support"],
      ],
    });
    // The cards differ (Pro has a badge), so each card's features are a run of their own.
    expect(read.repeats?.map(({ template }) => template)).toEqual([
      "I54:244;54:214",
      "I54:268;54:214",
      "I54:292;54:214",
    ]);
  });

  it("folds layers apart in variant, file and place, the template's own values in the first row", () => {
    expect(designXml(CUSTOMERS, { repeats: true }).repeats).toEqual([
      {
        template: "54:437",
        layers: ["54:437", "54:441", "54:445"],
        fields: [
          {
            layer: "54:437",
            attribute: "variant",
          },
          {
            layer: "54:437",
            attribute: "src",
          },
          {
            layer: "54:437",
            attribute: "left",
          },
        ],
        rows: [
          ["Brand=Nova", "assets/logo-nova.svg", "40px"],
          ["Brand=Lumen", "assets/logo-lumen.svg", "190px"],
          ["Brand=Nova", "assets/logo-nova-2.svg", "340px"],
        ],
      },
    ]);
  });

  it("fits a read without unfolding its runs: a run's first is never cut into, only cut with its run", () => {
    const folded = designXml(PLANS, { repeats: true });
    const mates = (folded.repeats ?? []).flatMap(({ layers }) => layers.slice(1));
    const close = fitDesign(PLANS, folded.xml.length - 200, { repeats: true });

    // Cutting into a first unfolded its run, and the fit went on to empty every run.
    expect(close.xml.length).toBeLessThanOrEqual(folded.xml.length - 200);
    expect(close.repeats?.map(({ layers }) => layers)).toEqual(folded.repeats?.map(({ layers }) => layers));
    expect(close.repeats?.[0]).toEqual(folded.repeats?.[0]);

    for (const maxChars of [folded.xml.length - 200, Math.floor(folded.xml.length / 2), 2_500]) {
      const tight = fitDesign(PLANS, maxChars, { repeats: true });

      expect(tight.xml.length, `maxChars ${maxChars}`).toBeLessThanOrEqual(maxChars);
      expect(mates.filter((id) => tight.xml.includes(`id="${id}"`))).toEqual([]);
    }
  });

  it("folds a run whose instance texts are overridden in some layers only, $override going with the rows", () => {
    const overridden = (id: string) => {
      const set = (node: SnapshotNode): SnapshotNode => ({
        ...node,
        ...(node.id === id ? { overrides: ["characters"] } : {}),
        ...(node.children === undefined ? {} : { children: node.children.map(set) }),
      });

      return designXml(
        {
          ...PLANS,
          root: set(PLANS.root),
        },
        { repeats: true },
      ).repeats?.[0];
    };

    expect(overridden("I54:244;54:217")).toMatchObject({
      template: "I54:244;54:214",
      fields: [
        { attribute: "src" },
        {
          layer: "I54:244;54:217",
          attribute: "$override",
        },
        { attribute: "$text" },
      ],
      rows: [
        ["assets/icon-check.svg", "text", "Unlimited projects"],
        ["assets/icon-check-2.svg", "", "Version history for 30 days"],
        ["assets/icon-check-3.svg", "", "Email support"],
      ],
    });
    // Only the last one overrides its text: the template has no $override, the field is still there.
    expect(overridden("I54:244;54:225")).toMatchObject({
      template: "I54:244;54:214",
      fields: [{ attribute: "src" }, { attribute: "$override" }, { attribute: "$text" }],
      rows: [
        ["assets/icon-check.svg", "", "Unlimited projects"],
        ["assets/icon-check-2.svg", "", "Version history for 30 days"],
        ["assets/icon-check-3.svg", "text", "Email support"],
      ],
    });
  });

  it("keeps two alike layers as they are, and a read without the option as it was", () => {
    const pair = withChildren(PLANS, "I54:244;54:213", 2);

    expect(designXml(pair, { repeats: true }).repeats?.map(({ template }) => template)).toEqual([
      "I54:268;54:214",
      "I54:292;54:214",
    ]);
    expect(designXml(PLANS, { repeats: false })).toEqual(designXml(PLANS));
    expect(designXml(PLANS).repeats).toBeUndefined();
  });
});

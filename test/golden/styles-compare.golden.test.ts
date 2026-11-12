import { describe, expect, it } from "vitest";
import { BuildStyles } from "@/core/checks/build-styles/build-styles.ts";
import { ShapeMatch } from "@/core/checks/build-styles/shape-match.ts";
import { Shorthands } from "@/core/checks/build-styles/shorthands.ts";
import { StyleCheck } from "@/core/checks/build-styles/style-check.ts";
import { StyleMatch } from "@/core/checks/build-styles/style-match.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { GradientParser } from "@/core/css/gradients/gradient-parser.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { builder, catalogue, fixture, planner } from "./support/design-classes.ts";

const split = new CssSplit();
const vars = new CssVar(split);

/** The check as the server root binds it. */
const check = new StyleCheck(
  new Shorthands(split, vars),
  new StyleMatch(
    split,
    new ShapeMatch(split, new GradientParser(split, vars, new GradientGeometry()), new CssUrl(split)),
  ),
);

const styles = new BuildStyles(builder, planner, catalogue, check);

/** Orbit's Customers block: a sticker turned -8deg in the accent colour, a title in Heading/H3. */
const CUSTOMERS = fixture("orbit-customers");

const STICKER_ID = "54:450";

/** The read op's read of the sticker alone: the sticker as its root. */
const STICKER = { ...CUSTOMERS, root: CUSTOMERS.root.children?.find(({ id }) => id === STICKER_ID) ?? CUSTOMERS.root };

/** The sticker hidden, as the read op reads a hidden root: whole. */
const HIDDEN = { ...STICKER, root: { ...STICKER.root, visible: false } };

/** Customers with the sticker hidden in it: below a root a hidden layer is a stub, its header alone (D-18). */
const STUBBED = {
  ...CUSTOMERS,
  root: {
    ...CUSTOMERS.root,
    children: (CUSTOMERS.root.children ?? []).map((child) => {
      const { id, name, type, x, y, width, height, childCount } = child;

      return id === STICKER_ID ? { id, name, type, visible: false, x, y, width, height, childCount } : child;
    }),
  },
};

describe("styles_compare over a read", () => {
  it("holds a build's computed styles against each layer as design_read writes it in its parent", () => {
    const result = styles.compare(
      [STICKER, CUSTOMERS],
      [
        {
          node: STICKER_ID,
          label: ".sticker",
          css: {
            display: "flex",
            position: "absolute",
            left: "521px",
            top: "282.4px",
            paddingTop: "6px",
            paddingRight: "12px",
            paddingBottom: "6px",
            paddingLeft: "12px",
            transform: "matrix(0.990268, -0.139173, 0.139173, 0.990268, 0, 0)",
            overflowX: "hidden",
            overflowY: "hidden",
            borderTopLeftRadius: "999px",
            borderTopRightRadius: "999px",
            borderBottomRightRadius: "999px",
            borderBottomLeftRadius: "999px",
            backgroundColor: "rgb(255, 107, 61)",
          },
        },
        {
          node: "54:435",
          css: {
            position: "absolute",
            left: "40px",
            top: "40px",
            width: "251.3px",
            height: "30px",
            color: "rgb(20, 22, 31)",
            "font-family": '"Space Grotesk", sans-serif',
            "font-size": "24px",
            "font-weight": "600",
            "font-style": "normal",
            "line-height": "30px",
            "letter-spacing": "-0.24px",
          },
        },
        { node: "9:9", css: {} },
      ],
      1,
    );

    // Differences first.
    expect(result).toEqual({
      layers: [
        {
          node: "54:435",
          name: "Title",
          tag: "Text",
          matched: 11,
          mismatches: [{ property: "font-weight", design: "500", from: 'textStyle="Heading/H3"', build: "600" }],
          notGiven: [],
          notCompared: [],
        },
        {
          node: STICKER_ID,
          name: "Sticker",
          tag: "Frame",
          label: ".sticker",
          matched: 16,
          mismatches: [],
          notGiven: [],
          notCompared: [],
        },
      ],
      missing: ["9:9"],
      same: false,
      notes: [],
    });
  });

  it("compares a layer no other pair's read holds as its own read's root: its size, not its place", () => {
    const [layer] = styles.compare([STICKER], [{ node: STICKER_ID, css: {} }], 1).layers;

    expect(layer?.notGiven).toEqual(expect.arrayContaining(["width", "height"]));
    expect(layer?.notGiven).not.toContain("left");
  });

  // T-090, 0.7.0's decision 1: the read op gives a root's parent (ancestors), so a layer alone sits where it is.
  it("places a layer no other pair's read holds in its parent from the read's ancestors: its place, not its size", () => {
    const placed = { ...STICKER, ancestors: [{ ...CUSTOMERS.root, children: [STICKER.root] }] };
    const [layer] = styles.compare([placed], [{ node: STICKER_ID, css: {} }], 1).layers;

    expect(layer?.notGiven).toEqual(expect.arrayContaining(["position", "left", "top"]));
  });

  // T-090: the read op reads a hidden root whole, so it is compared as shown; below a root it is a stub (D-18).
  it.each([
    ["its own read first", [HIDDEN, STUBBED]],
    ["the stub's read first", [STUBBED, HIDDEN]],
  ] as const)("compares a hidden root as shown and never its stub in another read, %s", (_order, reads) => {
    const result = styles.compare(reads, [{ node: STICKER_ID, css: {} }], 1);

    expect(result.layers[0]?.notGiven).toEqual(expect.arrayContaining(["width", "height", "padding-top"]));
  });
});

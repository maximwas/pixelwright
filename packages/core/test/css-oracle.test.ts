import { describe, expect, it } from "vitest";
import { type CssContext, cleanOracle, nodeCss, type SnapshotNode } from "../src/index.ts";
import { fixture, nodesOf } from "./helpers/fixtures.ts";

const FIXTURES = ["positivus-services-row", "positivus-services-block", "positivus-hero", "positivus-landing-top"];

/** Oracle properties we leave out on purpose: SVG paint of vectors, Figma's flex-shrink on every fixed child. */
const NOT_WRITTEN = new Set(["flex-shrink", "fill", "stroke", "stroke-width", "font-feature-settings"]);

/** Dev Mode guesses a flex layout for a frame without auto layout; we place its children as Figma does. */
const GUESSED_LAYOUT = new Set(["display", "flex-direction", "padding", "justify-content", "align-items", "gap"]);

const DEFAULTS: Readonly<Record<string, string>> = {
  "align-items": "flex-start",
  "flex-direction": "row",
  "justify-content": "flex-start",
};

/** getCSSAsync's CSS reduced to what our table writes: our names, our rounding, no defaults, one font shorthand. */
function oracleOf(node: SnapshotNode): Map<string, string> {
  const oracle = new Map<string, string>();
  const css = node.css ?? {};

  for (const [property, raw] of Object.entries(css)) {
    const value = cleanOracle(raw).replace(/^inline-flex$/, "flex");

    if (
      NOT_WRITTEN.has(property) ||
      property.startsWith("font-") ||
      property === "line-height" ||
      DEFAULTS[property] === value ||
      (GUESSED_LAYOUT.has(property) && node.layoutMode === undefined) ||
      (property === "border-radius" && node.type === "ELLIPSE") ||
      (property === "background" && value.includes("url("))
    ) {
      continue;
    }

    oracle.set(property, value);
  }

  if (css["font-family"] !== undefined) {
    const italic = css["font-style"] === "italic" ? "italic " : "";
    const family = css["font-family"].replaceAll('"', "'");

    oracle.set(
      "font",
      `${italic}${css["font-weight"]} ${cleanOracle(css["font-size"] ?? "")}/${cleanOracle(css["line-height"] ?? "normal")} ${family}`,
    );
  }

  return oracle;
}

describe("our CSS against getCSSAsync on the Positivus fixtures", () => {
  it("agrees on every property both write", () => {
    const mismatches: string[] = [];

    for (const name of FIXTURES) {
      const snapshot = fixture(name);
      const context: CssContext = {
        styles: snapshot.styles,
        variables: snapshot.variables,
        tokens: new Map(),
        root: snapshot.root,
      };

      for (const { node, parent } of nodesOf(snapshot)) {
        if (node.css === undefined || !node.visible) {
          continue;
        }

        const written = nodeCss(node, parent, context);
        const ours = new Map([...written.properties, ...written.readOnly]);
        const textStyled = ours.get("font") === undefined && node.textStyleId !== undefined;

        for (const [property, value] of oracleOf(node)) {
          if (textStyled && property === "font") {
            continue;
          }

          if (property === "gap" && (node.children?.filter((child) => child.visible).length ?? node.childCount) < 2) {
            // A gap with one child spaces nothing: we leave it out.
            continue;
          }

          if (scaled(node, property)) {
            // A SCALE constraint is a percent of the parent for us; Dev Mode writes the pixels it has now.
            continue;
          }

          if (property === "transform" && sameRotation(ours.get(property), value)) {
            continue;
          }

          if (ours.get(property) !== value) {
            mismatches.push(
              `${name} ${node.id} ${node.type} "${node.name}" ${property}: ours ${ours.get(property)}, Figma's ${value}`,
            );
          }
        }
      }
    }

    expect(mismatches).toEqual([]);
  });
});

/** Figma's CSS takes the angle from the matrix, we from rotation: they differ in the hundredths of a degree. */
function sameRotation(ours: string | undefined, theirs: string): boolean {
  const angle = (value: string | undefined) => Number(/^rotate\((-?[\d.]+)deg\)$/.exec(value ?? "")?.[1] ?? Number.NaN);

  return Math.abs(angle(ours) - angle(theirs)) < 0.05;
}

function scaled(node: SnapshotNode, property: string): boolean {
  const horizontal = node.constraints?.horizontal === "SCALE" && ["width", "left"].includes(property);
  const vertical = node.constraints?.vertical === "SCALE" && ["height", "top"].includes(property);

  return horizontal || vertical;
}

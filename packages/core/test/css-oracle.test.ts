import { describe, expect, it } from "vitest";
import { type CssContext, cleanOracle, nodeCss, type SnapshotNode } from "../src/index.ts";
import { fixture, nodesOf } from "./helpers/fixtures.ts";

const FIXTURES = ["orbit-plans", "orbit-pricing", "orbit-customers", "orbit-desktop-top"];

/** Oracle properties we leave out on purpose: SVG paint of vectors, Figma's flex-shrink on every fixed child. */
const NOT_WRITTEN = new Set(["flex-shrink", "fill", "stroke", "stroke-width", "font-feature-settings"]);

/** Dev Mode guesses a flex layout for a frame without auto layout; we place its children as Figma does. */
const GUESSED_LAYOUT = new Set(["display", "flex-direction", "padding", "justify-content", "align-items", "gap"]);

/** What a text style holds, so a styled text leaves it to the style; Figma writes it again, rounded to whole pixels. */
const STYLE_HELD = /^(letter-spacing|text-transform|text-decoration|text-underline)/;

/** What a text says per run: a text of several runs is read as its base and spans, Figma's CSS gives one run's. */
const RUN_HELD = /^(color|font|letter-spacing|text-transform|text-decoration|text-underline)/;

/** Properties Figma writes by value though a style holds them (effect styles); colours it writes as var() itself. */
const BY_VALUE = new Set(["box-shadow", "filter", "backdrop-filter"]);

/** A layer's place in its parent: the read root's parent is not read, so none of it is written. */
const PARENT_HELD = new Set(["align-self", "flex"]);

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
    const family = css["font-family"].includes('"')
      ? css["font-family"].replaceAll('"', "'")
      : `'${css["font-family"]}'`;

    oracle.set(
      "font",
      `${italic}${css["font-weight"]} ${cleanOracle(css["font-size"] ?? "")}/${cleanOracle(css["line-height"] ?? "normal")} ${family}`,
    );
  }

  return oracle;
}

describe("our CSS against getCSSAsync on the Orbit fixtures", () => {
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
        // A read-only value may carry our note after the value Figma writes: "-367px (the children overlap)".
        const ours = new Map([
          ...written.properties,
          ...written.readOnly.map(([property, value]): [string, string] => [property, value.replace(/ \(.*\)$/, "")]),
        ]);
        const textStyled = ours.get("font") === undefined && node.textStyleId !== undefined;
        const runs = node.text?.segments.length ?? 1;
        // Our value with its tokens' values in place, where Figma writes the style by value (effects).
        const resolved = (property: string, value: string | undefined) =>
          BY_VALUE.has(property)
            ? value?.replace(/var\((--[^)]+)\)/g, (whole, token: string) => context.tokens.get(token) ?? whole)
            : value;

        for (const [property, value] of oracleOf(node)) {
          if (
            (textStyled && (property === "font" || (STYLE_HELD.test(property) && !ours.has(property)))) ||
            (runs > 1 && RUN_HELD.test(property)) ||
            (parent === null && PARENT_HELD.has(property))
          ) {
            continue;
          }

          if (property === "flex" && value === "1 0 0" && ours.get(property) === "1") {
            // Grow from nothing: with a zero basis, shrinking never happens either way.
            continue;
          }

          if (property === "padding" && sides(ours.get(property)) === sides(value)) {
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

          if (ours.get(property) !== value && resolved(property, ours.get(property)) !== value) {
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

/** A padding shorthand as its four sides, so "8px 16px 4px" and "8px 16px 4px 16px" are the same. */
function sides(value: string | undefined): string {
  const [top, right = top, bottom = top, left = right] = (value ?? "").split(" ");

  return [top, right, bottom, left].join(" ");
}

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

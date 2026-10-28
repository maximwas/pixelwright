import type { SnapshotNode } from "../../../types/snapshot.ts";
import type { CssDeclarations } from "../../css-declarations.ts";
import { boxShorthand } from "../../values/format.ts";

/** An auto layout's padding, flex or grid alike, as the shorthand; none when every side is 0. */
export function readPadding(node: SnapshotNode, css: CssDeclarations): void {
  const sides = (["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const).map((key) =>
    css.length(key, node[key] ?? 0),
  );

  if (sides.some((side) => side !== "0")) {
    css.set("padding", boxShorthand(...(sides as [string, string, string, string])));
  }
}

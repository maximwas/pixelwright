import { TEXT_TYPES, VECTOR_TYPES } from "../constants/css.ts";
import type { CssContext, NodeCss } from "../types/css.ts";
import type { SnapshotNode } from "../types/snapshot.ts";
import { CssDeclarations } from "./css-declarations.ts";
import { readAppearance, readLayoutGrids, readRadius } from "./groups/appearance.ts";
import { readEffects } from "./groups/effects.ts";
import { readGeometry } from "./groups/geometry/geometry.ts";
import { readLayout } from "./groups/layout/layout.ts";
import { readBackground } from "./groups/paint/fills.ts";
import { readLine } from "./groups/paint/line.ts";
import { readStrokes } from "./groups/paint/strokes.ts";
import { readText } from "./groups/text/block.ts";

/**
 * A layer's CSS from its raw Figma properties, through the one mapping table design_apply reads back. `parent` decides
 * how the layer sits (flowing in auto layout, or placed absolutely); the read's root always gets its size.
 */
export function nodeCss(node: SnapshotNode, parent: SnapshotNode | null, context: CssContext): NodeCss {
  const css = new CssDeclarations(node, context);
  const scope = {
    node,
    parent,
    context,
    css,
  };
  let textStyle: string | undefined;

  readLayout(node, css);

  if (node.type === "LINE") {
    readLine(scope);
  } else {
    readGeometry(scope);
  }

  readAppearance(node, css);

  if (TEXT_TYPES.has(node.type)) {
    textStyle = readText(node, css, context);
  } else if (!VECTOR_TYPES.has(node.type) && node.type !== "LINE") {
    readRadius(node, css);
    readStrokes(node, css, context);
    readBackground(node, css, context);
  }

  readEffects(node, css, context);
  readLayoutGrids(node, css);

  return css.build(textStyle);
}

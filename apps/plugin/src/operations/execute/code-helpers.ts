import { Color } from "@pixelwright/core";
import { documentColor } from "../../figma/color-profile.ts";
import { loadTextFonts } from "../../figma/fonts.ts";
import { TokenIndex } from "../../figma/tokens/token-index.ts";
import { layersUntil } from "../../figma/walk.ts";

/**
 * Pixelwright's helpers on execute's `pw`, as the tool's description lists them: a layer by id, the fonts of the texts
 * under a layer loaded, a CSS colour as a paint, a variable by the CSS name design_read gives it.
 */
export function codeHelpers(): Record<string, unknown> {
  return {
    node: layerById,
    fonts: async (node: BaseNode) =>
      await loadTextFonts(
        layersUntil([node], Number.POSITIVE_INFINITY).layers.filter((each): each is TextNode => each.type === "TEXT"),
      ),
    paint: solidPaint,
    variable: async (token: string) => await (await TokenIndex.of()).variable(token),
  };
}

async function layerById(id: string): Promise<BaseNode> {
  const node = await figma.getNodeByIdAsync(id);

  if (node === null) {
    throw new Error(`No layer ${id} in this file.`);
  }

  return node;
}

/** A CSS colour as a solid paint in the file's colours, its alpha as the paint's opacity. */
function solidPaint(css: string): SolidPaint {
  const color = Color.parse(css);

  if (color === null) {
    throw new Error(`pw.paint: ${css} is not a CSS colour.`);
  }

  const { r, g, b, a } = documentColor(color.value());

  return {
    type: "SOLID",
    color: {
      r,
      g,
      b,
    },
    opacity: a,
  };
}

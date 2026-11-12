import { injectable } from "@needle-di/core";
import { APPEARANCE_FIELD } from "@/plugin/adapters/figma/layer-read/layer-read.constants.ts";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";

/**
 * How a layer shows and sits (0.7.0's blending, layout grid and corner readers): opacity, blend mode, mask, clipping,
 * constraints, layout grids, corners, and the designer's export settings (C-142). Figma's raw values, its defaults left out; the server maps them to CSS.
 */
@injectable()
export class AppearanceFieldReader implements FieldReader {
  read(node: SceneNode): Partial<ReadLayer> {
    return {
      ...this.#blending(node),
      ...this.#constraints(node),
      ...this.#grids(node),
      ...this.#corners(node),
      ...this.#exports(node),
    };
  }

  /** The designer's export settings: the layer is meant to be an asset, in this format and scale. */
  #exports(node: SceneNode): Partial<ReadLayer> {
    return "exportSettings" in node && node.exportSettings.length > 0
      ? { exportSettings: node.exportSettings.map((setting) => ({ ...setting })) }
      : {};
  }

  #blending(node: SceneNode): Partial<ReadLayer> {
    return {
      ...("opacity" in node && node.opacity !== APPEARANCE_FIELD.opaque ? { opacity: node.opacity } : {}),
      ...("blendMode" in node && !APPEARANCE_FIELD.plainBlends.some((mode) => mode === node.blendMode)
        ? { blendMode: node.blendMode }
        : {}),
      ...("isMask" in node && node.isMask ? { isMask: true, maskType: node.maskType } : {}),
      ...("clipsContent" in node && node.clipsContent ? { clipsContent: true } : {}),
    };
  }

  /** Constraints other than Figma's default, pinned to the start on both axes. */
  #constraints(node: SceneNode): Partial<ReadLayer> {
    if (!("constraints" in node)) {
      return {};
    }

    const { horizontal, vertical } = node.constraints;

    return horizontal === APPEARANCE_FIELD.start && vertical === APPEARANCE_FIELD.start
      ? {}
      : { constraints: { horizontal, vertical } };
  }

  /** The layout grids, and the grid style they come from (C-1.5: the read writes it as `$grid-style`). */
  #grids(node: SceneNode): Partial<ReadLayer> {
    return {
      ...("layoutGrids" in node && node.layoutGrids.length > 0
        ? { layoutGrids: node.layoutGrids.map((grid) => ({ ...grid })) }
        : {}),
      ...("gridStyleId" in node && node.gridStyleId !== "" ? { gridStyleId: node.gridStyleId } : {}),
    };
  }

  /** The corner radius, each corner when they differ, and the corners' smoothing. */
  #corners(node: SceneNode): Partial<ReadLayer> {
    if (!("cornerRadius" in node)) {
      return {};
    }

    const radius = node.cornerRadius;
    const smoothing =
      "cornerSmoothing" in node && node.cornerSmoothing !== 0 ? { cornerSmoothing: node.cornerSmoothing } : {};

    if (radius !== figma.mixed) {
      return { ...(radius === 0 ? {} : { cornerRadius: radius }), ...smoothing };
    }

    return {
      cornerRadius: READ_VALUE.mixed,
      ...("topLeftRadius" in node
        ? {
          topLeftRadius: node.topLeftRadius,
          topRightRadius: node.topRightRadius,
          bottomRightRadius: node.bottomRightRadius,
          bottomLeftRadius: node.bottomLeftRadius,
        }
        : {}),
      ...smoothing,
    };
  }
}

import { injectable } from "@needle-di/core";
import { LAYOUT_FIELD } from "@/plugin/adapters/figma/layer-read/layer-read.constants.ts";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** A layer that can lay its children out: a frame, a component, an instance. */
type LayoutNode = Extract<SceneNode, { layoutMode: unknown }>;

type Track = NonNullable<ReadLayer["gridColumnSizes"]>[number];

/**
 * A layer's layout fields (0.7.0's layout reader): its own auto layout or grid, its place in a parent grid, and how it
 * sizes in its parent's layout. Figma's raw values; the server maps them to CSS. Missing, null and default values are
 * left out, as 0.7.0's snapshot left them.
 */
@injectable()
export class LayoutFieldReader implements FieldReader {
  read(node: SceneNode): Partial<ReadLayer> {
    return this.#present({ ...this.#layout(node), ...this.#cell(node), ...this.#sizing(node) });
  }

  #layout(node: SceneNode): Partial<ReadLayer> {
    if (!("layoutMode" in node) || node.layoutMode === LAYOUT_FIELD.noLayout) {
      return {};
    }

    return {
      layoutMode: node.layoutMode,
      layoutWrap: node.layoutWrap,
      primaryAxisAlignItems: node.primaryAxisAlignItems,
      counterAxisAlignItems: node.counterAxisAlignItems,
      counterAxisAlignContent: node.counterAxisAlignContent,
      itemSpacing: node.itemSpacing,
      counterAxisSpacing: node.counterAxisSpacing,
      paddingTop: node.paddingTop,
      paddingRight: node.paddingRight,
      paddingBottom: node.paddingBottom,
      paddingLeft: node.paddingLeft,
      itemReverseZIndex: node.itemReverseZIndex,
      strokesIncludedInLayout: node.strokesIncludedInLayout,
      ...(node.layoutMode === LAYOUT_FIELD.grid ? this.#grid(node) : {}),
    };
  }

  /**
   * A grid's counts, gaps and tracks. Each track size Figma hands over spends a host callback id, never reused
   * (FX-008): the design profile, the only one the read op has yet, needs them for grid-template-*.
   */
  #grid(node: LayoutNode): Partial<ReadLayer> {
    return {
      gridRowCount: node.gridRowCount,
      gridColumnCount: node.gridColumnCount,
      gridRowGap: node.gridRowGap,
      gridColumnGap: node.gridColumnGap,
      gridRowSizes: node.gridRowSizes.map((track) => this.#track(track)),
      gridColumnSizes: node.gridColumnSizes.map((track) => this.#track(track)),
    };
  }

  #track({ type, value }: GridTrackSize): Track {
    return value === undefined ? { type } : { type, value };
  }

  /** Where a grid's child sits in it. */
  #cell(node: SceneNode): Partial<ReadLayer> {
    const { parent } = node;

    if (
      parent === null ||
      !("layoutMode" in parent) ||
      parent.layoutMode !== LAYOUT_FIELD.grid ||
      !("gridRowSpan" in node)
    ) {
      return {};
    }

    return {
      gridRowAnchorIndex: node.gridRowAnchorIndex,
      gridColumnAnchorIndex: node.gridColumnAnchorIndex,
      gridRowSpan: node.gridRowSpan,
      gridColumnSpan: node.gridColumnSpan,
      gridChildHorizontalAlign: node.gridChildHorizontalAlign,
      gridChildVerticalAlign: node.gridChildVerticalAlign,
    };
  }

  /** How the layer sizes in its parent's layout, and the sizes it is held between. */
  #sizing(node: SceneNode): Record<string, unknown> {
    if (!("layoutSizingHorizontal" in node)) {
      return {};
    }

    return {
      layoutSizingHorizontal: node.layoutSizingHorizontal,
      layoutSizingVertical: node.layoutSizingVertical,
      ...("layoutPositioning" in node && node.layoutPositioning !== LAYOUT_FIELD.flowing
        ? { layoutPositioning: node.layoutPositioning }
        : {}),
      ...("layoutGrow" in node && node.layoutGrow !== 0 ? { layoutGrow: node.layoutGrow } : {}),
      ...("layoutAlign" in node && node.layoutAlign !== LAYOUT_FIELD.inherit ? { layoutAlign: node.layoutAlign } : {}),
      ...("minWidth" in node
        ? { minWidth: node.minWidth, maxWidth: node.maxWidth, minHeight: node.minHeight, maxHeight: node.maxHeight }
        : {}),
    };
  }

  /** The fields Figma gave: a null (a size limit not set, a line spacing that follows the gap) is left out. */
  #present(fields: Record<string, unknown>): Partial<ReadLayer> {
    return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null));
  }
}

import { inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { CssScope, PropertyGroup } from "@/core/css/css.types.ts";
import {
  FIGMA_GEOMETRY,
  GEOMETRY_ATTRIBUTES,
  GEOMETRY_AXIS,
  GEOMETRY_SOURCES,
  GEOMETRY_TEXT,
  GEOMETRY_VALUE,
  SIZE_LIMITS,
} from "@/core/css/groups/geometry/geometry.constants.ts";
import { type GeometryAxis, PLACEMENT, type SizeOverride } from "@/core/css/groups/geometry/placement.ts";
import { LAYOUT_MODE } from "@/core/css/groups/layout/layout.constants.ts";
import type { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { CSS_VALUE } from "@/core/css/values/values.constants.ts";
import { LINE_AXIS } from "@/core/kernel/geometry/geometry.constants.ts";
import { Turn } from "@/core/kernel/geometry/turn.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/**
 * Where a layer is and how big (C-050, C-054, C-057): its turn and mirror, its place from its constraints, its size
 * (the read's root always has one; FILL in a flex parent is flex or stretch; HUG is left out) and its limits.
 */
@injectable()
export class GeometryGroup implements PropertyGroup {
  readonly attributes = GEOMETRY_ATTRIBUTES;
  readonly sources = GEOMETRY_SOURCES;
  readonly #placement;
  readonly #lengths;
  readonly #format;

  constructor(
    placement = inject(PLACEMENT),
    lengths = inject(CSS_LENGTH),
    format = inject(NUMBER_FORMAT),
  ) {
    this.#placement = placement;
    this.#lengths = lengths;
    this.#format = format;
  }

  read(given: CssScope): void {
    const [scope, thin] = this.#upright(given);
    const decided = { ...this.#placement.read(scope), ...thin };

    this.#transform(scope.layer, scope.css);
    this.#size(scope, GEOMETRY_AXIS.horizontal, decided);
    this.#size(scope, GEOMETRY_AXIS.vertical, decided);

    for (const [property, field] of SIZE_LIMITS) {
      const limit = scope.layer[field];
      const written = limit === undefined ? CSS_VALUE.zero : this.#lengths.px(limit);

      if (written !== CSS_VALUE.zero) {
        scope.css.set(property, written);
      }
    }
  }

  /**
   * A line lying flat or standing (within half a degree) is an unturned box one border thick (the strokes group draws
   * the border): its length along its axis, no size across. A standing one is that box upright, placed by its centre.
   */
  #upright(scope: CssScope): [CssScope, SizeOverride] {
    const { layer } = scope;
    const axis = layer.type === FIGMA_GEOMETRY.line ? new Turn(layer.rotation, undefined).lineAxis() : null;

    if (axis === null) {
      return [scope, {}];
    }

    const standing = axis === LINE_AXIS.standing;
    const upright = standing
      ? { ...layer, rotation: 0, width: layer.height, height: layer.width }
      : { ...layer, rotation: 0 };

    return [{ ...scope, layer: upright }, { [standing ? CSS_PROPERTY.width : CSS_PROPERTY.height]: null }];
  }

  /**
   * The turn and mirror (C-057, K-068): CSS turns clockwise, Figma counter-clockwise, so the sign flips; a mirrored
   * layer is scaleX(-1) after the turn left once the flip is taken out.
   */
  #transform(layer: ReadLayer, css: CssDeclarations): void {
    const turn = new Turn(layer.rotation, layer.mirrorTransform);
    const degrees = this.#format.round(turn.degrees(), PRECISION.angle);
    const parts = [
      ...(degrees === 0 ? [] : [GEOMETRY_TEXT.rotate(-degrees)]),
      ...(turn.mirrored() ? [GEOMETRY_VALUE.mirror] : []),
    ];

    if (parts.length > 0) {
      css.set(CSS_PROPERTY.transform, parts.join(GEOMETRY_VALUE.partJoint));
    }
  }

  /** One axis's size: the one the constraints decided, the layer's own where fixed, or how it fills a flex parent. */
  #size(
    { layer, parent, css }: CssScope,
    axis: GeometryAxis,
    decided: SizeOverride,
  ): void {
    const given = decided[axis.size];
    const sizing = layer[axis.sizing];

    if (given !== undefined) {
      if (given !== null) {
        css.set(axis.size, given);
      }
    } else if (parent === null || sizing === FIGMA_GEOMETRY.fixed || sizing === undefined) {
      css.set(axis.size, this.#lengths.px(layer[axis.size]));
    } else if (
      sizing === FIGMA_GEOMETRY.fill &&
      this.#flows(parent) &&
      layer.layoutPositioning !== FIGMA_GEOMETRY.absolute
    ) {
      if (parent.layoutMode === axis.direction) {
        css.set(CSS_PROPERTY.flex, GEOMETRY_VALUE.grow);
      } else {
        css.set(CSS_PROPERTY.alignSelf, GEOMETRY_VALUE.stretch);
      }
    }
  }

  #flows(parent: ReadLayer): boolean {
    return parent.layoutMode === LAYOUT_MODE.horizontal || parent.layoutMode === LAYOUT_MODE.vertical;
  }
}

import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { CssScope } from "@/core/css/css.types.ts";
import {
  FIGMA_CONSTRAINT,
  FIGMA_GEOMETRY,
  GEOMETRY_AXIS,
  GEOMETRY_NUMBER,
  GEOMETRY_TEXT,
  GEOMETRY_VALUE,
} from "@/core/css/groups/geometry/geometry.constants.ts";
import { LAYOUT_MODE } from "@/core/css/groups/layout/layout.constants.ts";
import type { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { Area } from "@/core/kernel/geometry/area.ts";
import { GEOMETRY } from "@/core/kernel/geometry/geometry.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** A size the constraints decide instead of the layer's own, by CSS property: left out (null) or a percent. */
export type SizeOverride = Partial<Record<string, string | null>>;

export type GeometryAxis = (typeof GEOMETRY_AXIS)[keyof typeof GEOMETRY_AXIS];

/** Where a layer sits on one axis of its parent: its offset from the start, its length, the parent's length. */
interface AxisBox {
  readonly offset: number;
  readonly length: number;
  readonly parentLength: number;
}

/**
 * Where a layer placed absolutely (or in a parent without layout) sits, from its constraints (C-050). A turned or
 * mirrored layer turns about its centre in CSS, so its unturned box is placed with the centres met: Figma's own x and
 * y are the turned corner, the far one at -180. The read's root sits nowhere.
 */
@injectable()
export class Placement {
  readonly #lengths;
  readonly #format;

  constructor(lengths = inject(CSS_LENGTH), format = inject(NUMBER_FORMAT)) {
    this.#lengths = lengths;
    this.#format = format;
  }

  /** Sets position and the edges; returns the sizes the constraints decide. */
  read({ layer, parent, css }: CssScope): SizeOverride {
    if (parent === null || !(layer.layoutPositioning === FIGMA_GEOMETRY.absolute || !this.#laysOut(parent))) {
      return {};
    }

    const centre = layer.bounds === undefined ? null : new Area(layer.bounds).centre();
    const constraints = parent.type === FIGMA_GEOMETRY.group ? undefined : layer.constraints;
    const half = (length: number) => length / GEOMETRY.halves;

    css.set(CSS_PROPERTY.position, GEOMETRY_VALUE.absolute);

    return {
      ...this.#axis(css, GEOMETRY_AXIS.horizontal, constraints?.horizontal ?? FIGMA_CONSTRAINT.start, {
        offset: (centre === null ? layer.x : centre.x - half(layer.width)) - parent.x,
        length: layer.width,
        parentLength: parent.width,
      }),
      ...this.#axis(css, GEOMETRY_AXIS.vertical, constraints?.vertical ?? FIGMA_CONSTRAINT.start, {
        offset: (centre === null ? layer.y : centre.y - half(layer.height)) - parent.y,
        length: layer.height,
        parentLength: parent.height,
      }),
    };
  }

  /**
   * One axis from its constraint: pinned to the start (MIN) or the end (MAX), held at its offset from the centre,
   * stretched between both edges, or scaled as percents of the parent.
   */
  #axis(
    css: CssDeclarations,
    { start, end, size }: GeometryAxis,
    constraint: string,
    { offset, length, parentLength }: AxisBox,
  ): SizeOverride {
    const toEnd = parentLength - offset - length;

    if (constraint === FIGMA_CONSTRAINT.end) {
      css.set(end, this.#lengths.px(toEnd));
    } else if (constraint === FIGMA_CONSTRAINT.centre) {
      css.set(start, this.#fromCentre(offset - parentLength / GEOMETRY.halves));
    } else if (constraint === FIGMA_CONSTRAINT.stretch) {
      css.set(start, this.#lengths.px(offset));
      css.set(end, this.#lengths.px(toEnd));

      return { [size]: null };
    } else if (constraint === FIGMA_CONSTRAINT.scale && parentLength > 0) {
      css.set(start, this.#percent(offset, parentLength));

      return { [size]: this.#percent(length, parentLength) };
    } else {
      css.set(start, this.#lengths.px(offset));
    }

    return {};
  }

  /** `50%`, or `calc(50% ± Npx)` in whole px: the one calc() form design_apply reads back. */
  #fromCentre(offset: number): string {
    const pixels = this.#lengths.px(Math.abs(offset));

    if (pixels === this.#lengths.px(0)) {
      return GEOMETRY_VALUE.centre;
    }

    return GEOMETRY_TEXT.fromCentre(offset < 0 ? GEOMETRY_VALUE.minus : GEOMETRY_VALUE.plus, pixels);
  }

  #percent(part: number, whole: number): string {
    return GEOMETRY_TEXT.percent(this.#format.round((part / whole) * GEOMETRY_NUMBER.percent, PRECISION.decimal));
  }

  /** Whether the parent lays its children out (auto layout or a grid): then they flow, unless placed absolutely. */
  #laysOut(parent: ReadLayer): boolean {
    return Object.values(LAYOUT_MODE).some((mode) => mode === parent.layoutMode);
  }
}

export const PLACEMENT = new InjectionToken<Placement>("Placement");

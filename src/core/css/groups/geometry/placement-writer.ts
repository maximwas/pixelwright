import { inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import {
  GEOMETRY_AXIS,
  GEOMETRY_ERROR,
  GEOMETRY_PATTERN,
  GEOMETRY_VALUE,
  GEOMETRY_WRITE,
  PLACEMENT_ATTRIBUTES,
} from "@/core/css/groups/geometry/geometry.constants.ts";
import type { GeometryAxis } from "@/core/css/groups/geometry/placement.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import type { AxisPlacement } from "@/core/kernel/geometry/placement-span.ts";
import { INTENT_AXIS, INTENT_HUG, INTENT_KEY } from "@/shared/write-intents/write-intent.constants.ts";

type PlacementFound = { readonly placement: AxisPlacement };

type PlacementRefused = { readonly attribute: string; readonly error: string };

/** A placement read from the edges, or why it cannot be. */
type Placed = PlacementFound | PlacementRefused;

/**
 * position, and each axis's edges and size written back (C-051, C-052). The element's edges replace the layer's as a
 * pair, so a new right edge unpins the left one; a size alone keeps the edge the layer is pinned to. Where the layer
 * sits is an intent the plugin resolves on the live parent (PlacementSpan).
 */
@injectable()
export class PlacementWriter implements PropertyWriter {
  readonly attributes = PLACEMENT_ATTRIBUTES;
  readonly #lengths;

  constructor(lengths = inject(CSS_LENGTH)) {
    this.#lengths = lengths;
  }

  write(input: WriteInput, out: WriteOutput): void {
    if (input.changed(CSS_PROPERTY.position)) {
      this.#position(input.own(CSS_PROPERTY.position) ?? "", out);
    }

    for (const axis of Object.values(GEOMETRY_AXIS)) {
      if ([CSS_PROPERTY.position, axis.start, axis.end, axis.size].some(input.changed)) {
        const placed = this.#edges(axis, input, out);

        if (input.changed(axis.size) && placed?.kind !== INTENT_AXIS.SCALE) {
          this.#size(axis, input, out, placed);
        }
      }
    }
  }

  #position(value: string, out: WriteOutput): void {
    if (value === GEOMETRY_VALUE.absolute) {
      out.set(INTENT_KEY.absolute, true, CSS_PROPERTY.position);
    } else if (value === GEOMETRY_WRITE.relative || value === GEOMETRY_WRITE.static) {
      out.set(INTENT_KEY.absolute, false, CSS_PROPERTY.position);
    } else {
      out.fail(CSS_PROPERTY.position, GEOMETRY_ERROR.badPosition(value));
    }
  }

  /** The axis's placement from its edges (the element's pair, else the layer's); edges on a flowing layer are errors. */
  #edges(
    { start, end, size, constraint }: GeometryAxis,
    { own, merged, changed }: WriteInput,
    out: WriteOutput,
  ): AxisPlacement | null {
    const ownEdges = own(start) !== undefined || own(end) !== undefined;
    const edge = (name: string) => {
      const value = ownEdges ? own(name) : merged(name);

      return value === GEOMETRY_WRITE.auto ? undefined : value;
    };
    const from = edge(start);
    const to = edge(end);

    if (from === undefined && to === undefined) {
      return null;
    }

    if (merged(CSS_PROPERTY.position) !== GEOMETRY_VALUE.absolute) {
      for (const name of [start, end].filter((name) => changed(name) && own(name) !== GEOMETRY_WRITE.auto)) {
        out.fail(name, GEOMETRY_ERROR.flows(name), GEOMETRY_ERROR.flowsHint(name));
      }

      return null;
    }

    const relative = from === undefined ? null : this.#relative(start, from, merged(size));
    const placed = relative ?? this.#pixels(start, end, from, to);

    if (!(GEOMETRY_WRITE.placement in placed)) {
      out.fail(placed.attribute, placed.error);

      return null;
    }

    out.set(constraint, placed.placement, from === undefined ? end : start);

    return placed.placement;
  }

  /**
   * The size: a length or a token, auto as hugging. Between both edges auto leaves the size to them, and a length wins
   * over the end edge as in CSS: the layer starts at its start edge and still stretches with its parent.
   */
  #size(
    { start, size }: GeometryAxis,
    { own }: WriteInput,
    out: WriteOutput,
    placed: AxisPlacement | null,
  ): void {
    const value = own(size) ?? "";

    if (GEOMETRY_WRITE.hugs.some((word) => word === value)) {
      if (placed?.kind !== INTENT_AXIS.STRETCH) {
        out.set(size, INTENT_HUG, size);
      }

      return;
    }

    const length = this.#lengths.pixels(value);

    if (length === null) {
      const hint = this.#percent(value) === null ? undefined : GEOMETRY_ERROR.percentSize(start);

      out.fail(size, GEOMETRY_ERROR.badSize(size, value), hint);
    } else {
      out.set(size, length, size);
    }
  }

  /** A start edge at `50%` or `calc(50% ± Npx)` (from the centre), or in percents with the size in percents (scaled). */
  #relative(
    start: string,
    from: string,
    size: string | undefined,
  ): Placed | null {
    const centre = from === GEOMETRY_VALUE.centre ? [] : GEOMETRY_PATTERN.fromCentre.exec(from);

    if (centre !== null) {
      const offset = centre.length === 0 ? 0 : Number(centre[2]) * (centre[1] === GEOMETRY_VALUE.minus ? -1 : 1) || 0;

      return { placement: { kind: INTENT_AXIS.CENTER, offset } };
    }

    const percent = this.#percent(from);

    if (percent === null) {
      return null;
    }

    const sizePercent = size === undefined ? null : this.#percent(size);

    return sizePercent === null
      ? { attribute: start, error: GEOMETRY_ERROR.percentStart(start) }
      : { placement: { kind: INTENT_AXIS.SCALE, start: percent, size: sizePercent } };
  }

  /** Edges in pixels: both stretch the layer, one pins it to its side; a token cannot place a layer. */
  #pixels(
    start: string,
    end: string,
    from: string | undefined,
    to: string | undefined,
  ): Placed {
    const first = this.#edgePixels(from);
    const last = this.#edgePixels(to);

    if (first === null) {
      return { attribute: start, error: GEOMETRY_ERROR.badStart(start, from ?? "") };
    }

    if (last === null) {
      return { attribute: end, error: GEOMETRY_ERROR.badEnd(end, to ?? "") };
    }

    if (first !== undefined && last !== undefined) {
      return { placement: { kind: INTENT_AXIS.STRETCH, start: first, end: last } };
    }

    return {
      placement:
        first === undefined ? { kind: INTENT_AXIS.MAX, offset: last ?? 0 } : { kind: INTENT_AXIS.MIN, offset: first },
    };
  }

  /** An edge in pixels: undefined when not given, null when not pixels. */
  #edgePixels(value: string | undefined): number | null | undefined {
    const length = value === undefined ? undefined : this.#lengths.pixels(value.trim());

    return typeof length === "object" ? null : length;
  }

  #percent(value: string): number | null {
    const match = GEOMETRY_PATTERN.percent.exec(value.trim());

    return match === null ? null : Number(match[1]);
  }
}

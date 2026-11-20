import { inject, injectable } from "@needle-di/core";
import { ATTRIBUTE } from "@/core/apply/apply.constants.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import { PATH_GEOMETRY } from "@/core/css/groups/text/path-geometry.ts";
import { PATH_ERROR, PATH_PATTERN, PATH_WRITTEN } from "@/core/css/groups/text/text.constants.ts";
import { INTENT_AXIS, INTENT_KEY } from "@/shared/write-intents/write-intent.constants.ts";

/** The edges an arc places its layer by itself. */
const EDGES = [CSS_PROPERTY.left, CSS_PROPERTY.top, CSS_PROPERTY.right, CSS_PROPERTY.bottom];

/**
 * A TextPath's own attributes written back (T-140): the path a new one is made along (d, or arc, which places it too)
 * and where its text starts. Figma keeps the path a text on a path was made along, so a d or arc on one there is
 * refused, never dropped (B-035's rule: refuse what Figma would not write).
 */
@injectable()
export class TextPathWriter implements PropertyWriter {
  readonly attributes = PATH_WRITTEN;
  readonly #paths;

  constructor(paths = inject(PATH_GEOMETRY)) {
    this.#paths = paths;
  }

  write(input: WriteInput, out: WriteOutput): void {
    if (input.changed(ATTRIBUTE.d)) {
      this.#madeAlong(input, out);
    }

    if (input.changed(ATTRIBUTE.arc)) {
      this.#arc(input, out);
    }

    if (input.changed(ATTRIBUTE.start)) {
      this.#start(input.own(ATTRIBUTE.start) ?? "", out);
    }
  }

  #madeAlong({ own, existing }: WriteInput, out: WriteOutput): void {
    const value = own(ATTRIBUTE.d) ?? "";
    const path = this.#paths.figmaPath(value);

    if (existing) {
      out.fail(ATTRIBUTE.d, PATH_ERROR.madeAlong, PATH_ERROR.madeHint);
    } else if (path === null) {
      out.fail(ATTRIBUTE.d, PATH_ERROR.badPath(value), PATH_ERROR.badPathHint);
    } else {
      out.set(INTENT_KEY.path, path, ATTRIBUTE.d);
    }
  }

  /** An arc of a circle in the parent: the path in the box it covers, the layer placed there absolutely. */
  #arc({ own, existing }: WriteInput, out: WriteOutput): void {
    const value = own(ATTRIBUTE.arc) ?? "";
    const arc = this.#paths.arc(value);

    if (existing) {
      out.fail(ATTRIBUTE.arc, PATH_ERROR.arcThere, PATH_ERROR.madeHint);
    } else if (own(ATTRIBUTE.d) !== undefined || EDGES.some((edge) => own(edge) !== undefined)) {
      out.fail(ATTRIBUTE.arc, PATH_ERROR.arcPlaces);
    } else if (arc === null) {
      out.fail(ATTRIBUTE.arc, PATH_ERROR.badArc(value), PATH_ERROR.badArcHint);
    } else {
      out.set(INTENT_KEY.path, arc.path, ATTRIBUTE.arc);
      out.set(INTENT_KEY.absolute, true, ATTRIBUTE.arc);
      out.set(INTENT_KEY.horizontal, { kind: INTENT_AXIS.MIN, offset: arc.x }, ATTRIBUTE.arc);
      out.set(INTENT_KEY.vertical, { kind: INTENT_AXIS.MIN, offset: arc.y }, ATTRIBUTE.arc);
    }
  }

  /** `segment place`: a whole segment from 0, and a place on it from 0 to 1. */
  #start(value: string, out: WriteOutput): void {
    const parts = value.trim().split(PATH_PATTERN.spaces);
    const [segment, position] = parts.map((part) => (PATH_PATTERN.number.test(part) ? Number(part) : Number.NaN));

    if (
      parts.length === 2 &&
      segment !== undefined &&
      Number.isInteger(segment) &&
      segment >= 0 &&
      position !== undefined &&
      position >= 0 &&
      position <= 1
    ) {
      out.set(INTENT_KEY.pathStart, { segment, position }, ATTRIBUTE.start);
    } else {
      out.fail(ATTRIBUTE.start, PATH_ERROR.badStart(value), PATH_ERROR.badStartHint);
    }
  }
}

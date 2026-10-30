import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ALIGNED_NAMES, INSPECT_NUMBER, MEASURE_SIDE, MEASURE_TEXT } from "@/core/inspect/inspect.constants.ts";
import type { MeasuredPair } from "@/core/inspect/inspect.schema.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A layer to measure: its id, name, layout box and painted box (null when Figma gives none). */
export interface MeasuredLayer {
  readonly id: string;
  readonly name: string;
  readonly box: Box;
  readonly paintedBox: Box | null;
}

interface Sides {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

type Ref = MeasuredPair["a"];

/** Which box holds the other, and how far in the inner one sits. */
type Containment = Required<Pick<MeasuredPair, "contains" | "inset">>;

/** What the sentence of a pair says. */
interface Relation {
  readonly gap: MeasuredPair["gap"];
  readonly right: boolean;
  readonly below: boolean;
  readonly edges: MeasuredPair["edges"];
  readonly containment: Containment | null;
}

/**
 * Each layer against the one before it in the list (T-084, K-061): the gap between their boxes on each axis (negative
 * where they overlap), how their edges and centres line up (B's minus A's; aligned within 0.01), and, when one holds
 * the other, how far it sits from each edge, with a sentence per pair. Layout boxes, or painted ones.
 */
@injectable()
export class Measure {
  readonly #format;

  constructor(format = inject(NUMBER_FORMAT)) {
    this.#format = format;
  }

  pairs(layers: readonly MeasuredLayer[], painted: boolean): MeasuredPair[] {
    return layers.flatMap((layer, index) => {
      const next = layers[index + 1];

      return next === undefined ? [] : [this.#pair(layer, next, painted)];
    });
  }

  #pair(
    earlier: MeasuredLayer,
    later: MeasuredLayer,
    painted: boolean,
  ): MeasuredPair {
    const first = this.#sides(painted ? (earlier.paintedBox ?? earlier.box) : earlier.box);
    const second = this.#sides(painted ? (later.paintedBox ?? later.box) : later.box);
    const gap = {
      x: this.#round(Math.max(second.left - first.right, first.left - second.right)),
      y: this.#round(Math.max(second.top - first.bottom, first.top - second.bottom)),
    };
    const edges = this.#edges(first, second);
    const containment = this.#containment(first, second);
    const refs = { a: { id: earlier.id, name: earlier.name }, b: { id: later.id, name: later.name } };
    const relation = { gap, right: second.left >= first.right, below: second.top >= first.bottom, edges, containment };

    return { ...refs, summary: this.#summary(refs.a, refs.b, relation), gap, edges, ...containment };
  }

  /** How far each of the second box's edges, and its centre, lies from the first's. */
  #edges(first: Sides, second: Sides): MeasuredPair["edges"] {
    return {
      left: this.#round(second.left - first.left),
      right: this.#round(second.right - first.right),
      top: this.#round(second.top - first.top),
      bottom: this.#round(second.bottom - first.bottom),
      centerX: this.#round((second.left + second.right - first.left - first.right) / 2),
      centerY: this.#round((second.top + second.bottom - first.top - first.bottom) / 2),
    };
  }

  #containment(first: Sides, second: Sides): Containment | null {
    if (this.#within(second, first)) {
      return { contains: MEASURE_SIDE.a, inset: this.#inset(first, second) };
    }

    return this.#within(first, second) ? { contains: MEASURE_SIDE.b, inset: this.#inset(second, first) } : null;
  }

  #inset(outer: Sides, inner: Sides): Containment["inset"] {
    return {
      top: this.#round(inner.top - outer.top),
      right: this.#round(outer.right - inner.right),
      bottom: this.#round(outer.bottom - inner.bottom),
      left: this.#round(inner.left - outer.left),
    };
  }

  #within(inner: Sides, outer: Sides): boolean {
    const aligned = INSPECT_NUMBER.same;

    return (
      inner.left >= outer.left - aligned &&
      inner.top >= outer.top - aligned &&
      inner.right <= outer.right + aligned &&
      inner.bottom <= outer.bottom + aligned
    );
  }

  #summary(
    first: Ref,
    second: Ref,
    { gap, right, below, edges, containment }: Relation,
  ): string {
    if (containment !== null) {
      const [outer, inner] = containment.contains === MEASURE_SIDE.a ? [first, second] : [second, first];

      return MEASURE_TEXT.inside(this.#named(inner), this.#named(outer), containment.inset);
    }

    const apart = [
      ...(gap.x >= 0 ? [MEASURE_TEXT.apartX(gap.x, right)] : []),
      ...(gap.y >= 0 ? [MEASURE_TEXT.apartY(gap.y, below)] : []),
    ];
    const where =
      apart.length === 0
        ? MEASURE_TEXT.overlaps(this.#named(first), -gap.x, -gap.y)
        : MEASURE_TEXT.apart(apart, this.#named(first));
    const aligned = ALIGNED_NAMES.filter(([key]) => Math.abs(edges[key]) <= INSPECT_NUMBER.same).map(
      ([, word]) => word,
    );

    return MEASURE_TEXT.sentence(this.#named(second), where, MEASURE_TEXT.list(aligned));
  }

  #named({ id, name }: Ref): string {
    return MEASURE_TEXT.named(id, name);
  }

  #sides({ x, y, width, height }: Box): Sides {
    return { left: x, top: y, right: x + width, bottom: y + height };
  }

  #round(value: number): number {
    return this.#format.round(value, PRECISION.distance);
  }
}

export const MEASURE = new InjectionToken<Measure>("Measure");

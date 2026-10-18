import type { BindCandidate, BindKind } from "@pixelwright/core";

/** One raw value on a layer that a token may stand for, the tokens holding it, and how to bind one there. */
export interface RawUse {
  readonly layer: SceneNode;
  readonly kind: BindKind;
  /** Where the value is, by its CSS name: background, border, color, gap, padding, border-radius, font, effects. */
  readonly field: string;
  readonly value: string;
  readonly candidates: readonly BindCandidate[];
  /** Whether a paint style may take the value's place: a paint style is the whole list of a layer's paints. */
  readonly stylable?: boolean;
  /** Binds the token there; `snapped` when the value is not the token's, so the layer takes the token's value. */
  readonly bind: (candidate: BindCandidate, snapped: boolean) => Promise<void>;
}

/** Candidates from two sources, each once, in the order found. */
export function merged(first: readonly BindCandidate[], second: readonly BindCandidate[]): BindCandidate[] {
  const byId = new Map<string, BindCandidate>();

  for (const candidate of [...first, ...second]) {
    if (!byId.has(candidate.id)) {
      byId.set(candidate.id, candidate);
    }
  }

  return [...byId.values()];
}

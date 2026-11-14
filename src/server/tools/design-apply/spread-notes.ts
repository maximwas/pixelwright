import type { ApplyChange, ApplyError } from "@/core/apply/apply.types.ts";
import type { WritePlan } from "@/core/apply/plan/plan.types.ts";
import { ShadowSpread } from "@/core/css/groups/effects/shadow-spread.ts";
import {
  SPREAD_INHERITED_TAGS,
  SPREAD_NOTE,
  SPREAD_TAG_TYPE,
} from "@/server/tools/design-apply/design-apply.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/**
 * A written shadow spread Figma will not draw (FIX-090A): its layer as the write leaves it, the XML's clipping and
 * fills over the layer's own, read by ShadowSpread. A note, not a refusal, the same on dry and real runs: the spread is
 * written all the same.
 */
export class SpreadNotes {
  readonly #spread = new ShadowSpread();

  notes({ written, assessed }: Pick<WritePlan, "written" | "assessed">): ApplyError[] {
    const held = new Map(
      assessed.flatMap(({ element, entry }) => (entry === undefined ? [] : [[element.ref, entry.layer] as const])),
    );

    return written.flatMap((change) => (this.#undrawn(change, held.get(change.ref)) ? [this.#note(change)] : []));
  }

  /** Whether the change writes a spread its layer will not draw. */
  #undrawn(change: ApplyChange, layer: ReadLayer | undefined): boolean {
    const { effects, clipsContent, fills } = change.props;
    const inherited =
      layer === undefined &&
      (change.copyOf !== undefined || change.source !== undefined || SPREAD_INHERITED_TAGS.includes(change.tag));

    if (!Array.isArray(effects) || !effects.some(({ spread }) => (spread ?? 0) !== 0)) {
      return false;
    }

    // shortcut: a copy or a new instance takes its source's clipping and fills, which the plan does not read, so it is
    // noted only when the XML sets both; read the source when such notes are asked for.
    if (inherited && (clipsContent === undefined || fills === undefined)) {
      return false;
    }

    // A new Frame is written unclipped and createComponent() starts unclipped (probed in Figma, 2026-11-14).
    return !this.#spread.draws({
      type: layer?.type ?? SPREAD_TAG_TYPE[change.tag] ?? change.tag,
      clipsContent: clipsContent ?? layer?.clipsContent,
      fills: fills ?? layer?.fills,
    });
  }

  #note({ line, column, id, tag, sources }: ApplyChange): ApplyError {
    return {
      line,
      column,
      ...(id === null ? {} : { id }),
      ...(sources.effects === undefined ? {} : { attribute: sources.effects }),
      message: SPREAD_NOTE.message(tag),
      hint: SPREAD_NOTE.hint,
    };
  }
}

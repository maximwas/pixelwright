import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { PIN_NEED, type PinNeed } from "@/plugin/operations/apply/writers/writers.constants.ts";
import { APPLY_CHANGE_KIND } from "@/shared/ops/apply/apply.constants.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";
import { INTENT_ASSET, INTENT_LAYOUT_MODE } from "@/shared/write-intents/write-intent.constants.ts";

/** What an existing layer has before the call writes it. */
interface Own {
  readonly fills?: unknown;
  readonly strokes?: unknown;
  readonly effects?: unknown;
  readonly layoutMode?: string;
}

/** What a layer holds once the call has written it; a need not told is one a dry run cannot see. */
type Held = Partial<Record<PinNeed, boolean>>;

/**
 * Which of a note's pins its layer cannot hold (NEW-090): Figma refuses a pin of a property the layer lacks, so the
 * layer's state after the call is read the same on dry and real runs. An existing layer is read as it is, with what the
 * call sets over it; a new one is what the call gives it (a dry run has only a stand-in for it, a real one a layer whose
 * Figma defaults the call's own new-layer step already cleared), a new text with Figma's own fill. A copy or a new
 * instance has what its source or component has, which a stand-in lacks: neither run tells it.
 */
export class PinNeeds {
  /** The first of these pin types the layer cannot hold, with what it lacks; none when it holds them all. */
  lacking(
    types: readonly string[],
    layer: TypedLayer,
    change: ApplyChangeData,
  ): { readonly type: string; readonly need: PinNeed } | undefined {
    const held = this.#held(layer, change);

    for (const type of types) {
      const need = Reflect.get(PIN_NEED, type) as PinNeed | undefined;

      if (need !== undefined && Object.hasOwn(held, need) && !held[need]) {
        return { type, need };
      }
    }

    return undefined;
  }

  #held(layer: TypedLayer, change: ApplyChangeData): Held {
    const { props } = change;
    const made = change.kind === APPLY_CHANGE_KIND.create;
    const own = layer as Own;
    const before = (value: unknown) => !made && this.#some(value);
    const text = layer.type === FIGMA_NODE_TYPE.text || layer.type === FIGMA_NODE_TYPE.textPath;
    const types = { text, instance: layer.type === FIGMA_NODE_TYPE.instance };

    if (made && (change.copyOf !== undefined || types.instance)) {
      return types;
    }

    const mode = props.layoutMode ?? (made ? INTENT_LAYOUT_MODE.NONE : (own.layoutMode ?? INTENT_LAYOUT_MODE.NONE));
    const fill = text
      ? made || before(own.fills)
      : props.fills === undefined
        ? props.asset?.kind === INTENT_ASSET.image || before(own.fills)
        : props.fills.length > 0;

    return {
      ...types,
      fill,
      stroke: props.strokes === undefined ? before(own.strokes) : props.strokes.paints.length > 0,
      effect:
        props.effects === undefined ? before(own.effects) : !Array.isArray(props.effects) || props.effects.length > 0,
      autoLayout: mode !== INTENT_LAYOUT_MODE.NONE,
      grid: mode === INTENT_LAYOUT_MODE.GRID,
    };
  }

  /** Whether a list the layer has holds one; a mixed value (a symbol) is a value. */
  #some(value: unknown): boolean {
    return Array.isArray(value) ? value.length > 0 : value !== undefined;
  }
}

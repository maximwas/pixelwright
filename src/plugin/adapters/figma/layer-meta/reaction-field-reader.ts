import { inject, injectable } from "@needle-di/core";
import { FIGMA_ACTION_TYPE } from "@/plugin/adapters/figma/layer-meta/layer-meta.constants.ts";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

type ReadReaction = NonNullable<ReadLayer["reactions"]>[number];
type ReadAction = NonNullable<ReadReaction["actions"]>[number];

/**
 * The layer's prototype interactions as Figma keeps them (P-089): a reaction's `actions`, or the single `action` older
 * files keep; each NODE action with its destination's name (a variant's name says which state it changes to), each
 * destination looked up once; the URL an interaction opens as href.
 */
@injectable()
export class ReactionFieldReader implements FieldReader {
  readonly #lookup;

  constructor(lookup = inject(NODE_LOOKUP)) {
    this.#lookup = lookup;
  }

  async read(node: SceneNode): Promise<Partial<ReadLayer>> {
    if (!("reactions" in node) || node.reactions.length === 0) {
      return {};
    }

    const names = new Map<string, string>();
    const reactions: ReadReaction[] = [];

    for (const reaction of node.reactions) {
      const actions: ReadAction[] = [];

      for (const action of this.#actions(reaction)) {
        actions.push(await this.#named(action, names));
      }

      reactions.push({ trigger: this.#plain(reaction.trigger), actions });
    }

    const href = node.reactions
      .flatMap((reaction) => this.#actions(reaction))
      .find((action) => action.type === FIGMA_ACTION_TYPE.url);

    return { ...(href?.type === FIGMA_ACTION_TYPE.url ? { href: href.url } : {}), reactions };
  }

  /** A reaction's actions: its list, or the single action older files keep. */
  #actions(reaction: Reaction): readonly Action[] {
    return reaction.actions ?? (reaction.action === undefined ? [] : [reaction.action]);
  }

  async #named(action: Action, names: Map<string, string>): Promise<ReadAction> {
    const plain = this.#plain<ReadAction>(action);

    if (action.type !== FIGMA_ACTION_TYPE.node || action.destinationId === null) {
      return plain;
    }

    const id = action.destinationId;
    const name = names.get(id) ?? (await this.#lookup.node(id).catch(() => null))?.name ?? id;

    names.set(id, name);

    return { ...plain, destinationName: name };
  }

  /** Plugin API objects are frozen: a JSON copy is what goes on the wire anyway. */
  #plain<Value>(value: unknown): Value {
    return JSON.parse(JSON.stringify(value)) as Value;
  }
}

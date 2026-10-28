import { plain } from "../utils/plain.ts";

/**
 * The layer's prototype interactions as Figma keeps them, each NODE action with its destination's name (a variant's
 * name says which state it changes to). The old single `action` becomes `actions`.
 */
export async function reactionsOf(node: SceneNode): Promise<Record<string, unknown>[]> {
  if (!("reactions" in node) || node.reactions.length === 0) {
    return [];
  }

  const names = new DestinationNames();
  const reactions: Record<string, unknown>[] = [];

  for (const reaction of node.reactions) {
    const actions: Record<string, unknown>[] = [];

    for (const action of actionsOf(reaction)) {
      const plainAction = plain<Record<string, unknown>>(action);

      if (action.type === "NODE" && action.destinationId !== null) {
        plainAction.destinationName = await names.of(action.destinationId);
      }

      actions.push(plainAction);
    }

    reactions.push({
      trigger: plain(reaction.trigger),
      actions,
    });
  }

  return reactions;
}

/** The URL a prototype interaction of the layer opens, if one does. */
export function urlOf(node: SceneNode): string | null {
  if (!("reactions" in node)) {
    return null;
  }

  for (const reaction of node.reactions) {
    for (const action of actionsOf(reaction)) {
      if (action.type === "URL") {
        return action.url;
      }
    }
  }

  return null;
}

/** A reaction's actions: its list, or the single action older files keep. */
function actionsOf(reaction: Reaction): readonly Action[] {
  return reaction.actions ?? (reaction.action === undefined ? [] : [reaction.action]);
}

/** The names of the layers a layer's interactions go to, each looked up once. */
class DestinationNames {
  readonly #names = new Map<string, string>();

  async of(id: string): Promise<string | undefined> {
    if (!this.#names.has(id)) {
      this.#names.set(id, (await figma.getNodeByIdAsync(id))?.name ?? id);
    }

    return this.#names.get(id);
  }
}

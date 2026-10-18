import { BridgeError } from "@pixelwright/core";
import { IdLookup } from "../../figma/id-lookup.ts";
import { requireNode } from "../../figma/nodes.ts";
import { collectionsAround, type ModedNode } from "../../figma/variable-modes.ts";
import type { PluginServices } from "../../services/plugin-services.ts";

/** What a render in other variable modes needs: it writes for a moment, as Pixelwright, one at a time. */
type ModeWrites = Pick<PluginServices, "edits" | "journal" | "modeTurns">;

/** A collection to set on the layer for the render, the mode to set, and the layer's own mode to set back. */
interface ModeChoice {
  readonly collection: VariableCollection;
  readonly mode: string;
  readonly before: string | undefined;
}

/**
 * Runs a render with the layer in the variable modes asked for (collection and mode by name, any case), then sets its
 * modes back: a write for a moment, so Allow edits must be on; one undo step that leaves the file as it was. One mode
 * render at a time: two at once (light and dark side by side) would each see the other's mode as the layer's.
 */
export function inModes<T>(
  id: string,
  modes: Readonly<Record<string, string>>,
  run: () => Promise<T>,
  services: ModeWrites,
): Promise<T> {
  return services.modeTurns.run(async () => {
    services.edits.require();

    const node = await requireNode(id);

    if (!("resolvedVariableModes" in node) || !("setExplicitVariableModeForCollection" in node)) {
      throw new BridgeError("OP_FAILED", `${id} is a ${node.type.toLowerCase()}, which takes no variable modes.`);
    }

    const chosen = await choicesFor(node, id, modes);

    return services.journal.asOwnWrite(() => renderedIn(node, chosen, run));
  });
}

/** The collections and modes asked for, by name, among those that apply to the layer and the file's own. */
async function choicesFor(node: ModedNode, id: string, modes: Readonly<Record<string, string>>): Promise<ModeChoice[]> {
  const collections = await collectionsAround(node, new IdLookup());

  return Object.entries(modes).map(([collectionName, modeName]) => {
    const collection = collections.find((each) => each.name.toLowerCase() === collectionName.toLowerCase());

    if (collection === undefined) {
      throw new BridgeError(
        "OP_FAILED",
        `No variable collection named ${collectionName} applies to ${id}: ${collections.map((each) => each.name).join(", ") || "none does"}.`,
      );
    }

    const mode = collection.modes.find((each) => each.name.toLowerCase() === modeName.toLowerCase());

    if (mode === undefined) {
      throw new BridgeError(
        "OP_FAILED",
        `${collection.name} has no mode ${modeName}: ${collection.modes.map((each) => each.name).join(", ")}.`,
      );
    }

    return {
      collection,
      mode: mode.modeId,
      before: node.explicitVariableModes[collection.id],
    };
  });
}

/** The render with the chosen modes set, then the layer's own modes back, as one undo step. */
async function renderedIn<T>(node: ModedNode, chosen: readonly ModeChoice[], run: () => Promise<T>): Promise<T> {
  try {
    for (const { collection, mode } of chosen) {
      node.setExplicitVariableModeForCollection(collection, mode);
    }

    return await run();
  } finally {
    for (const { collection, before } of chosen) {
      if (before === undefined) {
        node.clearExplicitVariableModeForCollection(collection);
      } else {
        node.setExplicitVariableModeForCollection(collection, before);
      }
    }

    figma.commitUndo();
  }
}

import { type ModedNode, namedModes } from "../../variable-modes.ts";
import type { LayerEntry } from "../layer-entry.ts";

/** The variable modes set on the layer itself, by collection and mode name. */
export async function readModes(entry: LayerEntry): Promise<void> {
  const explicit = (entry.node as ModedNode).explicitVariableModes;

  if (explicit === undefined || Object.keys(explicit).length === 0) {
    return;
  }

  const modes = await namedModes(explicit, entry.context.references.collections);

  if (modes.length > 0) {
    entry.set("modes", modes);
  }
}

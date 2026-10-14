import { reactionsOf, urlOf } from "../../../figma/reactions.ts";
import type { LayerEntry } from "../layer-entry.ts";

/** The link a layer opens, and its prototype interactions. */
export async function readPrototype(entry: LayerEntry): Promise<void> {
  const href = urlOf(entry.node);

  if (href !== null) {
    entry.set("href", href);
  }

  const reactions = await reactionsOf(entry.node);

  if (reactions.length > 0) {
    entry.set("reactions", reactions);
  }
}

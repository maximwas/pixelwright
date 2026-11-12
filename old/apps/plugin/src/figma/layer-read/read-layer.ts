import type { SnapshotNode } from "@pixelwright/core";
import { readBlending } from "./fields/blending.ts";
import { readCss } from "./fields/css.ts";
import { readFacts } from "./fields/facts.ts";
import { readGeometry } from "./fields/geometry.ts";
import { readInstance } from "./fields/instance.ts";
import { readLayout } from "./fields/layout.ts";
import { readModes } from "./fields/modes.ts";
import { readNotes } from "./fields/notes.ts";
import { readCorners, readPaints } from "./fields/paints.ts";
import { readPrototype } from "./fields/prototype.ts";
import { readText } from "./fields/text.ts";
import { readTokens } from "./fields/tokens.ts";
import { type EntryContext, LayerEntry } from "./layer-entry.ts";

/** One group of a layer's fields, read into its entry. */
type FieldReader = (entry: LayerEntry) => void | Promise<void>;

/** The groups of fields a layer's entry holds, in the order they go on the wire. */
const FIELD_READERS: readonly FieldReader[] = [
  readGeometry,
  readBlending,
  readLayout,
  readPaints,
  readCorners,
  readTokens,
  readModes,
  readFacts,
  readNotes,
  readPrototype,
  readText,
  readInstance,
  readCss,
];

/**
 * A layer as a snapshot carries it: Figma's raw fields for core to turn into CSS, its boxes from the read's origin, the
 * styles and variables it uses collected for the end of the read. A hidden layer is a name, a box and a child count,
 * unless the read wants it whole.
 */
export async function entryOf(node: SceneNode, context: EntryContext): Promise<SnapshotNode> {
  const entry = new LayerEntry(node, context);
  const childCount = "children" in node ? node.children.length : 0;

  if (!node.visible && !context.whole) {
    entry.set("childCount", childCount);

    return entry.snapshot();
  }

  for (const read of FIELD_READERS) {
    await read(entry);
  }

  entry.set("childCount", childCount);
  context.references.collect(entry.fields(), node);

  return entry.snapshot();
}

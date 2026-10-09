import type { DesignRead, DesignXmlOptions } from "../types/design.ts";
import type { Snapshot } from "../types/snapshot.ts";
import { renderDesign } from "./design.ts";

/** What a cut branch still costs: its own opening tag stays, with `$truncated="true"`. */
const STUB_EXTRA = ' $truncated="true"/>'.length;

/**
 * The read, cut to `maxChars`: branches are emptied deepest first and, at one depth, largest first, so every section
 * keeps its place and its own attributes, and the model can read a cut branch on its own by the id in `truncated`.
 */
export function fitDesign(snapshot: Snapshot, maxChars: number, options: DesignXmlOptions = {}): DesignRead {
  const { read, lines, spans } = renderDesign(snapshot, options);

  if (read.xml.length <= maxChars) {
    return read;
  }

  const lengths = lines.map((line) => line.length + 1);
  const prefix = [0];

  for (const length of lengths) {
    prefix.push((prefix.at(-1) ?? 0) + length);
  }

  const size = new Map<string, number>();

  for (const [id, span] of spans) {
    size.set(id, (prefix[span.end + 1] ?? 0) - (prefix[span.start] ?? 0));
  }

  const candidates = [...spans]
    .filter(([, span]) => span.end > span.start && span.parent !== null)
    .sort(([a, left], [b, right]) => right.level - left.level || (size.get(b) ?? 0) - (size.get(a) ?? 0));
  const cut = new Set<string>();
  let total = read.xml.length;

  for (const [id, span] of candidates) {
    if (total <= maxChars) {
      break;
    }

    const stub = (lengths[span.start] ?? 0) + STUB_EXTRA;
    const saving = (size.get(id) ?? 0) - stub;

    if (saving <= 0) {
      continue;
    }

    cut.add(id);
    total -= saving;
    size.set(id, stub);

    // The ancestors shrink with it; a branch cut earlier inside this one is now inside a cut and drops out.
    for (let parent = span.parent; parent !== null; parent = spans.get(parent)?.parent ?? null) {
      size.set(parent, (size.get(parent) ?? 0) - saving);
    }

    for (const inner of cut) {
      if (inner !== id && isInside(inner, id, spans)) {
        cut.delete(inner);
      }
    }
  }

  return renderDesign(snapshot, {
    ...options,
    cut,
  }).read;
}

function isInside(id: string, ancestor: string, spans: ReadonlyMap<string, { parent: string | null }>): boolean {
  for (let parent = spans.get(id)?.parent ?? null; parent !== null; parent = spans.get(parent)?.parent ?? null) {
    if (parent === ancestor) {
      return true;
    }
  }

  return false;
}

import { designXml, renderDesign } from "../design/design-xml.ts";
import type { DesignRead, DesignSpan, DesignXmlOptions } from "../types/design.ts";
import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";

/** What a cut branch still costs: its own opening tag stays, with `$truncated="true"`. */
const STUB_EXTRA = ' $truncated="true"/>'.length;

/** What a list cut short adds: `$children="1234"`. */
const LIMIT_EXTRA = ' $children="00000"'.length;

/** Rounds of cutting and measuring again: each round's estimate is checked by a real render. */
const ROUNDS = 8;

/** How a read is cut to fit maxChars: branches emptied, lists cut short, texts shortened. */
export interface FitPlan {
  readonly cut: Set<string>;
  readonly limits: Map<string, number>;
}

/**
 * The read, cut to `maxChars`: branches are emptied deepest first and, at one depth, largest first, so every section
 * keeps its place and its own attributes; when that is not enough (a flat or very wide tree), the widest elements keep
 * only their first children, and at last the longest texts are shortened. The model reads a cut branch on its own by
 * the id in `truncated`.
 */
export function fitDesign(snapshot: Snapshot, maxChars: number, options: DesignXmlOptions = {}): DesignRead {
  return designXml(snapshot, {
    ...options,
    ...fitPlan(snapshot, maxChars, options),
  });
}

/** The cuts that make the read fit, to render it again with other asset paths and the same cuts. */
export function fitPlan(snapshot: Snapshot, maxChars: number, options: DesignXmlOptions = {}): FitPlan {
  const plan: FitPlan = {
    cut: new Set(),
    limits: new Map(),
  };
  const nodes = indexNodes(snapshot.root);

  for (let round = 0; round < ROUNDS; round++) {
    const { read, lines, spans } = renderDesign(snapshot, {
      ...options,
      ...plan,
    });

    if (read.xml.length <= maxChars) {
      break;
    }

    const size = measure(lines, spans);
    let total = read.xml.length;

    total = cutBranches(spans, lines, size, plan, total, maxChars);

    if (total > maxChars) {
      total = shortenLists(spans, size, plan, total, maxChars);
    }

    if (total > maxChars) {
      shortenTexts(spans, nodes, plan, total, maxChars);
    }
  }

  return plan;
}

function indexNodes(root: SnapshotNode): Map<string, SnapshotNode> {
  const nodes = new Map<string, SnapshotNode>();
  const walk = (node: SnapshotNode) => {
    nodes.set(node.id, node);

    for (const child of node.children ?? []) {
      walk(child);
    }
  };

  walk(root);

  return nodes;
}

/** Each element's characters in the XML, its children included. */
function measure(lines: readonly string[], spans: ReadonlyMap<string, DesignSpan>): Map<string, number> {
  const prefix = [0];

  for (const line of lines) {
    prefix.push((prefix.at(-1) ?? 0) + line.length + 1);
  }

  return new Map([...spans].map(([id, span]) => [id, (prefix[span.end + 1] ?? 0) - (prefix[span.start] ?? 0)]));
}

/** Empties branches, deepest first and largest first at one depth, until the read fits or none is left. */
function cutBranches(
  spans: ReadonlyMap<string, DesignSpan>,
  lines: readonly string[],
  size: Map<string, number>,
  plan: FitPlan,
  total: number,
  maxChars: number,
): number {
  const candidates = [...spans]
    .filter(([id, span]) => span.end > span.start && span.parent !== null && !plan.cut.has(id))
    .sort(([a, left], [b, right]) => right.level - left.level || (size.get(b) ?? 0) - (size.get(a) ?? 0));
  let left = total;

  for (const [id, span] of candidates) {
    if (left <= maxChars) {
      break;
    }

    const stub = (lines[span.start]?.length ?? 0) + 1 + STUB_EXTRA;
    const saving = (size.get(id) ?? 0) - stub;

    if (saving <= 0) {
      continue;
    }

    plan.cut.add(id);
    left -= saving;
    size.set(id, stub);

    // The ancestors shrink with it; a branch cut earlier inside this one is now inside a cut and drops out.
    for (let parent = span.parent; parent !== null; parent = spans.get(parent)?.parent ?? null) {
      size.set(parent, (size.get(parent) ?? 0) - saving);
    }

    for (const inner of plan.cut) {
      if (inner !== id && isInside(inner, id, spans)) {
        plan.cut.delete(inner);
      }
    }
  }

  return left;
}

/** Cuts the widest lists short from their end, widest first, until the read fits; each keeps at least one child. */
function shortenLists(
  spans: ReadonlyMap<string, DesignSpan>,
  size: ReadonlyMap<string, number>,
  plan: FitPlan,
  total: number,
  maxChars: number,
): number {
  const children = new Map<string, string[]>();

  for (const [id, span] of [...spans].sort(([, a], [, b]) => a.start - b.start)) {
    if (span.parent !== null && !plan.cut.has(span.parent)) {
      children.set(span.parent, [...(children.get(span.parent) ?? []), id]);
    }
  }

  const widest = [...children]
    .filter(([, list]) => list.length > 1)
    .map(([parent, list]): [string, string[], number] => [
      parent,
      list,
      list.reduce((sum, id) => sum + (size.get(id) ?? 0), 0),
    ])
    .sort(([, , a], [, , b]) => b - a);
  let left = total;

  for (const [parent, list] of widest) {
    if (left <= maxChars) {
      break;
    }

    let kept = Math.min(list.length, plan.limits.get(parent) ?? list.length);
    let removed = 0;

    while (kept > 1 && left - removed + LIMIT_EXTRA > maxChars) {
      kept -= 1;
      removed += size.get(list[kept] ?? "") ?? 0;
    }

    if (removed > 0) {
      plan.limits.set(parent, kept);
      left -= removed - LIMIT_EXTRA;
    }
  }

  return left;
}

/** Shortens the longest texts until the read fits. */
function shortenTexts(
  spans: ReadonlyMap<string, DesignSpan>,
  nodes: ReadonlyMap<string, SnapshotNode>,
  plan: FitPlan,
  total: number,
  maxChars: number,
): void {
  const texts = [...spans.keys()]
    .map((id) => nodes.get(id))
    .filter((node): node is SnapshotNode => node?.type === "TEXT" && !plan.limits.has(node.id))
    .sort((a, b) => (b.text?.characters.length ?? 0) - (a.text?.characters.length ?? 0));
  let left = total;

  for (const text of texts) {
    if (left <= maxChars) {
      break;
    }

    const length = text.text?.characters.length ?? 0;
    // Escaped characters take more room than they count; the next round measures again.
    const keep = Math.max(0, length - (left - maxChars) - STUB_EXTRA * 2);

    plan.limits.set(text.id, keep);
    left -= length - keep;
  }
}

function isInside(id: string, ancestor: string, spans: ReadonlyMap<string, { parent: string | null }>): boolean {
  for (let parent = spans.get(id)?.parent ?? null; parent !== null; parent = spans.get(parent)?.parent ?? null) {
    if (parent === ancestor) {
      return true;
    }
  }

  return false;
}

import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";
import { designXml, type RenderedDesign, renderDesign } from "./design-xml.ts";
import type { DesignRead, DesignSpan, DesignXmlOptions } from "./types.ts";

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
    const render = renderDesign(snapshot, {
      ...options,
      ...plan,
    });

    if (render.read.xml.length <= maxChars) {
      break;
    }

    const fitting = new FitRound(render, plan, maxChars);

    fitting.cutBranches();

    if (!fitting.fits) {
      fitting.shortenLists();
    }

    if (!fitting.fits) {
      fitting.shortenTexts(nodes);
    }
  }

  return plan;
}

/**
 * One round of fitting: a render measured, and the plan's cuts made on it one kind after another while the estimate
 * of what is left stays over maxChars.
 */
class FitRound {
  readonly #lines: readonly string[];
  readonly #spans: ReadonlyMap<string, DesignSpan>;
  /** Each element's characters, its children included, as the cuts so far leave them. */
  readonly #size: Map<string, number>;
  readonly #plan: FitPlan;
  readonly #maxChars: number;
  #left: number;

  constructor(render: RenderedDesign, plan: FitPlan, maxChars: number) {
    this.#lines = render.lines;
    this.#spans = render.spans;
    this.#size = measure(render.lines, render.spans);
    this.#plan = plan;
    this.#maxChars = maxChars;
    this.#left = render.read.xml.length;
  }

  /** Whether the read fits, as far as this round can tell. */
  get fits(): boolean {
    return this.#left <= this.#maxChars;
  }

  /** Empties branches, deepest first and largest first at one depth, until the read fits or none is left. */
  cutBranches(): void {
    const candidates = [...this.#spans]
      .filter(([id, span]) => span.end > span.start && span.parent !== null && !this.#plan.cut.has(id))
      .sort(([a, left], [b, right]) => right.level - left.level || this.#sizeOf(b) - this.#sizeOf(a));

    for (const [id, span] of candidates) {
      if (this.fits) {
        break;
      }

      const stub = (this.#lines[span.start]?.length ?? 0) + 1 + STUB_EXTRA;

      if (this.#sizeOf(id) > stub) {
        this.#cut(id, span, stub);
      }
    }
  }

  /** Cuts the widest lists short from their end, widest first, until the read fits; each keeps at least one child. */
  shortenLists(): void {
    for (const { parent, list } of this.#widestLists()) {
      if (this.fits) {
        break;
      }

      this.#shorten(parent, list);
    }
  }

  /** Shortens the longest texts until the read fits. */
  shortenTexts(nodes: ReadonlyMap<string, SnapshotNode>): void {
    const texts = [...this.#spans.keys()]
      .map((id) => nodes.get(id))
      .filter((node): node is SnapshotNode => node?.type === "TEXT" && !this.#plan.limits.has(node.id))
      .sort((a, b) => (b.text?.characters.length ?? 0) - (a.text?.characters.length ?? 0));

    for (const text of texts) {
      if (this.fits) {
        break;
      }

      const length = text.text?.characters.length ?? 0;
      // Escaped characters take more room than they count; the next round measures again.
      const keep = Math.max(0, length - (this.#left - this.#maxChars) - STUB_EXTRA * 2);

      this.#plan.limits.set(text.id, keep);
      this.#left -= length - keep;
    }
  }

  #sizeOf(id: string): number {
    return this.#size.get(id) ?? 0;
  }

  /** Empties a branch down to its stub: its ancestors shrink with it, and cuts made inside it drop out. */
  #cut(id: string, span: DesignSpan, stub: number): void {
    const saving = this.#sizeOf(id) - stub;

    this.#plan.cut.add(id);
    this.#left -= saving;
    this.#size.set(id, stub);

    for (let parent = span.parent; parent !== null; parent = this.#spans.get(parent)?.parent ?? null) {
      this.#size.set(parent, this.#sizeOf(parent) - saving);
    }

    for (const inner of this.#plan.cut) {
      if (inner !== id && isInside(inner, id, this.#spans)) {
        this.#plan.cut.delete(inner);
      }
    }
  }

  /** The lists of children no cut hides, longer than one, widest first. */
  #widestLists(): { parent: string; list: string[] }[] {
    const children = new Map<string, string[]>();

    for (const [id, span] of [...this.#spans].sort(([, a], [, b]) => a.start - b.start)) {
      if (span.parent !== null && !this.#plan.cut.has(span.parent)) {
        children.set(span.parent, [...(children.get(span.parent) ?? []), id]);
      }
    }

    return [...children]
      .filter(([, list]) => list.length > 1)
      .map(([parent, list]) => ({
        parent,
        list,
        width: list.reduce((sum, id) => sum + this.#sizeOf(id), 0),
      }))
      .sort((a, b) => b.width - a.width);
  }

  /** Drops a list's children from its end while the read is over; its first child always stays. */
  #shorten(parent: string, list: readonly string[]): void {
    let kept = Math.min(list.length, this.#plan.limits.get(parent) ?? list.length);
    let removed = 0;

    while (kept > 1 && this.#left - removed + LIMIT_EXTRA > this.#maxChars) {
      kept -= 1;
      removed += this.#sizeOf(list[kept] ?? "");
    }

    if (removed > 0) {
      this.#plan.limits.set(parent, kept);
      this.#left -= removed - LIMIT_EXTRA;
    }
  }
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

function isInside(id: string, ancestor: string, spans: ReadonlyMap<string, { parent: string | null }>): boolean {
  for (let parent = spans.get(id)?.parent ?? null; parent !== null; parent = spans.get(parent)?.parent ?? null) {
    if (parent === ancestor) {
      return true;
    }
  }

  return false;
}

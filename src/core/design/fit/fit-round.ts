import type { RenderedDesign } from "@/core/design/design.types.ts";
import { FIT } from "@/core/design/fit/fit.constants.ts";
import type { FitPlan } from "@/core/design/fit/fit.types.ts";
import type { XmlSpan } from "@/core/xml/xml.types.ts";

/**
 * One round of fitting (T-054): a render measured, and the plan's cuts made on it one kind after another while the
 * estimate of what is left stays over maxChars. A run read as its first is cut whole and never inside: a cut makes its
 * first unlike the others, and the run would be written out in full again.
 */
export class FitRound {
  readonly #lines: readonly string[];
  readonly #spans: ReadonlyMap<string, XmlSpan>;
  /** Each element's characters, its children included, as the cuts so far leave them. */
  readonly #size: Map<string, number>;
  readonly #plan: FitPlan;
  readonly #maxChars: number;
  /** The layers of each run, by its first. */
  readonly #runs: ReadonlyMap<string, readonly string[]>;
  /** The elements inside a run's first. */
  readonly #inRuns: ReadonlySet<string>;
  #left: number;

  constructor(
    render: RenderedDesign,
    plan: FitPlan,
    maxChars: number,
  ) {
    this.#lines = render.lines;
    this.#spans = render.spans;
    this.#size = this.#measure();
    this.#plan = plan;
    this.#maxChars = maxChars;
    this.#runs = new Map((render.read.repeats ?? []).map(({ template, layers }) => [template, layers]));
    this.#inRuns = new Set(
      [...render.spans.keys()].filter((id) => [...this.#runs.keys()].some((first) => this.#isInside(id, first))),
    );
    this.#left = render.read.xml.length;
  }

  /** Whether the read fits, as far as this round can tell. */
  get fits(): boolean {
    return this.#left <= this.#maxChars;
  }

  /** Empties branches, deepest first and largest first at one depth, until the read fits or none is left. */
  cutBranches(): void {
    const candidates = [...this.#spans]
      .filter(
        ([id, span]) =>
          span.end > span.start && span.parent !== null && !this.#plan.cut.has(id) && !this.#inRuns.has(id),
      )
      // At one depth a run's first goes last: it stands for every layer of its run.
      .sort(
        ([first, left], [second, right]) =>
          right.level - left.level ||
          Number(this.#runs.has(first)) - Number(this.#runs.has(second)) ||
          this.#sizeOf(second) - this.#sizeOf(first),
      );

    for (const [id, span] of candidates) {
      if (this.fits) {
        break;
      }

      const stub = (this.#lines[span.start]?.length ?? 0) + 1 + FIT.stubExtra;

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

  /** Shortens the longest texts until the read fits: `texts` holds each text layer's length by its id. */
  shortenTexts(texts: ReadonlyMap<string, number>): void {
    const shown = [...this.#spans.keys()]
      .filter((id) => texts.has(id) && !this.#plan.limits.has(id) && !this.#folded(id))
      .sort((first, second) => (texts.get(second) ?? 0) - (texts.get(first) ?? 0));

    for (const id of shown) {
      if (this.fits) {
        break;
      }

      const length = texts.get(id) ?? 0;
      // Escaped characters take more room than they count; the next round measures again.
      const keep = Math.max(0, length - (this.#left - this.#maxChars) - FIT.stubExtra * 2);

      this.#plan.limits.set(id, keep);
      this.#left -= length - keep;
    }
  }

  #sizeOf(id: string): number {
    return this.#size.get(id) ?? 0;
  }

  /** Whether an element is a run's first or inside one: what changes it unfolds the run. */
  #folded(id: string): boolean {
    return this.#runs.has(id) || this.#inRuns.has(id);
  }

  /** Empties a branch (a run: each of its layers) down to its stub: its ancestors shrink with it, cuts inside drop. */
  #cut(
    id: string,
    span: XmlSpan,
    stub: number,
  ): void {
    const saving = this.#sizeOf(id) - stub;

    for (const layer of this.#runs.get(id) ?? [id]) {
      this.#plan.cut.add(layer);
    }

    this.#left -= saving;
    this.#size.set(id, stub);

    for (let parent = span.parent; parent !== null; parent = this.#spans.get(parent)?.parent ?? null) {
      this.#size.set(parent, this.#sizeOf(parent) - saving);
    }

    for (const inner of this.#plan.cut) {
      if (inner !== id && this.#isInside(inner, id)) {
        this.#plan.cut.delete(inner);
      }
    }
  }

  /** The lists of children no cut hides, longer than one, widest first. */
  #widestLists(): { parent: string; list: string[] }[] {
    const children = new Map<string, string[]>();

    for (const [id, span] of [...this.#spans].sort(([, first], [, second]) => first.start - second.start)) {
      if (span.parent !== null && !this.#plan.cut.has(span.parent) && !this.#folded(span.parent)) {
        children.set(span.parent, [...(children.get(span.parent) ?? []), id]);
      }
    }

    return [...children]
      .filter(([, list]) => list.length > 1)
      .map(([parent, list]) => ({ parent, list, width: list.reduce((sum, id) => sum + this.#sizeOf(id), 0) }))
      .sort((first, second) => second.width - first.width);
  }

  /** Drops a list's children from its end while the read is over; its first child always stays, a run counts whole. */
  #shorten(parent: string, list: readonly string[]): void {
    let kept = Math.min(list.length, this.#plan.limits.get(parent) ?? list.length);
    let removed = 0;

    while (kept > 1 && this.#left - removed + FIT.limitExtra > this.#maxChars) {
      kept -= 1;
      removed += this.#sizeOf(list[kept] ?? "");
    }

    if (removed > 0) {
      this.#plan.limits.set(
        parent,
        list.slice(0, kept).reduce((count, id) => count + (this.#runs.get(id)?.length ?? 1), 0),
      );
      this.#left -= removed - FIT.limitExtra;
    }
  }

  /** Each element's characters in the XML, its children included. */
  #measure(): Map<string, number> {
    const prefix = [0];

    for (const line of this.#lines) {
      prefix.push((prefix.at(-1) ?? 0) + line.length + 1);
    }

    return new Map([...this.#spans].map(([id, span]) => [id, (prefix[span.end + 1] ?? 0) - (prefix[span.start] ?? 0)]));
  }

  #isInside(id: string, ancestor: string): boolean {
    for (
      let parent = this.#spans.get(id)?.parent ?? null;
      parent !== null;
      parent = this.#spans.get(parent)?.parent ?? null
    ) {
      if (parent === ancestor) {
        return true;
      }
    }

    return false;
  }
}

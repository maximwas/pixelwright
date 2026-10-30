import { inject, injectable } from "@needle-di/core";
import { DESIGN_LINT } from "@/core/checks/design-lint.ts";
import type { DesignLintOutput } from "@/core/checks/lint/lint.schema.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { DESIGN_LINT_LIMITS, DESIGN_LINT_TEXT } from "@/server/tools/design-lint/design-lint.constants.ts";
import { type DesignLintInput, DesignLintInputSchema } from "@/server/tools/design-lint/design-lint.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { NODE_TEXT } from "@/shared/errors/errors.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { fileMapOp } from "@/shared/ops/file-map/file-map.manifest.ts";
import { OUTLINE } from "@/shared/ops/outline/outline.constants.ts";
import { outlineOp } from "@/shared/ops/outline/outline.manifest.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";
import type { ReadCut } from "@/shared/ops/read/read.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** The layers a lint reads, its scope's name, and what it left out. */
interface Roots {
  readonly ids: readonly string[];
  readonly scope: string;
  readonly notes: readonly string[];
}

/** A layer that was not read: why, and the code a lint that read nothing fails with. */
interface Unread {
  readonly note: string;
  readonly code: PixelwrightError["code"];
}

/** The reads, the layers not read, and where a read stopped at its size budget. */
interface Reads {
  readonly reads: readonly ReadModel[];
  readonly unread: readonly Unread[];
  readonly cuts: readonly string[];
}

/**
 * design_lint (K-031..K-038): each layer of `within` read on its own (a page's top layers for a page id, the current
 * page's when none is given), core's DesignLint over the reads. A layer not read is a note and opens the summary; with
 * none read the lint fails, never answering "No findings" (K-033, B-008, O-001).
 */
@injectable()
export class DesignLintTool extends Tool<DesignLintInput, DesignLintOutput> {
  protected readonly input = DesignLintInputSchema;
  readonly #session;
  readonly #lint;

  constructor(session = inject(PLUGIN_SESSION), lint = inject(DESIGN_LINT)) {
    super();
    this.#session = session;
    this.#lint = lint;
  }

  protected async run({ within, rules, limit }: DesignLintInput): Promise<DesignLintOutput> {
    const roots = await this.#roots(within);
    const { reads, unread, cuts } = await this.#reads(roots.ids);
    const notes = unread.map(({ note }) => note);
    const [first] = unread;

    if (reads.length === 0 && first !== undefined) {
      throw new PixelwrightError(first.code, notes.join(DESIGN_LINT_TEXT.space));
    }

    const lint = this.#lint.lint({ reads, unread: unread.length }, { rules, limit, scope: roots.scope });

    return { ...lint, notes: [...roots.notes, ...notes, ...cuts, ...lint.notes] };
  }

  /** The layers to read: each id given, a page's top layers for a page id, at most DESIGN_LINT_LIMITS.roots of them. */
  async #roots(within: readonly string[] | undefined): Promise<Roots> {
    const { pages } = await this.#session.run(fileMapOp, { layers: false });
    const asked = within ?? pages.filter(({ current }) => current).map(({ id }) => id);
    const ids: string[] = [];
    const labels: string[] = [];

    for (const id of asked) {
      const page = pages.find((entry) => entry.id === id);

      if (page === undefined) {
        ids.push(id);
        labels.push(id);
      } else {
        // A page's top layers come one by one: a page of thousands would pass push(...)'s argument limit.
        for (const top of await this.#tops(page.id)) {
          ids.push(top);
        }

        labels.push(DESIGN_LINT_TEXT.page(page.name));
      }
    }

    const scope = labels.join(DESIGN_LINT_TEXT.joint);
    const kept = ids.slice(0, DESIGN_LINT_LIMITS.roots);

    return {
      ids: kept,
      scope,
      notes: ids.length > kept.length ? [DESIGN_LINT_TEXT.more(ids.length - kept.length, scope)] : [],
    };
  }

  /** A page's top layers, from its outline one level deep (the read op takes layers, not pages). */
  async #tops(page: string): Promise<string[]> {
    const { root } = await this.#session.run(outlineOp, { node: page, depth: OUTLINE.minDepth });

    return (root.children ?? []).map(({ id }) => id);
  }

  /** Each layer read on its own, so one that fails leaves the others read (B-008); those not read, with why. */
  async #reads(ids: readonly string[]): Promise<Reads> {
    const reads: ReadModel[] = [];
    const unread: Unread[] = [];
    const cuts: string[] = [];

    for (const id of ids) {
      try {
        const answer = await this.#session.run(readOp, { nodes: [id] });
        const [read] = answer.reads;

        if (read === undefined) {
          unread.push({ note: DESIGN_LINT_TEXT.unread(id, NODE_TEXT.notFound(id)), code: ERROR_CODE.nodeNotFound });
        } else {
          reads.push(read);
          cuts.push(...this.#cut(read, answer.cuts));
        }
      } catch (error) {
        unread.push({
          note: DESIGN_LINT_TEXT.unread(id, error instanceof Error ? error.message : String(error)),
          code: error instanceof PixelwrightError ? error.code : ERROR_CODE.opFailed,
        });
      }
    }

    return { reads, unread, cuts };
  }

  /** Where a read stopped at its size budget: the children below were not linted (K-034). */
  #cut(read: ReadModel, cuts: readonly ReadCut[]): string[] {
    const [first] = cuts;

    return first === undefined ? [] : [DESIGN_LINT_TEXT.cut(read.root, cuts.length, first.id)];
  }
}

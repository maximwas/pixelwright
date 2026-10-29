import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { NAME_VALUE_LIST } from "@/core/kernel/lists/name-value-list.ts";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { PAGE_LOADER } from "@/plugin/adapters/figma/lookup/page-loader.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { FIND_NODE_TYPE, FIND_TEXT } from "@/plugin/operations/find/find.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { FIND_COUNT } from "@/shared/ops/find/find.constants.ts";
import type { findOp } from "@/shared/ops/find/find.manifest.ts";
import type { Counted, Found } from "@/shared/ops/find/find.schema.ts";

type FindInput = zod.output<typeof findOp.input>;

type FindOutput = zod.output<typeof findOp.output>;

type Values = Readonly<Record<string, string>>;

/** What a find keeps: the layers that matched (up to one past the limit), the counts asked for, whether time ran out. */
interface Search {
  readonly found: SceneNode[];
  readonly counts?: Counted[];
  readonly cut: boolean;
}

/** The layers a find lists, up to one past its limit, and its instances counted by main component when asked. */
interface Tally {
  readonly found: SceneNode[];
  readonly counts: Map<string, Counted> | null;
  readonly limit: number;
}

/**
 * Layers inside a layer or a page, the current page when none is given (T-040), in document order: by name, type and
 * text, an instance's component or variant; with `counts`, every instance found is also counted by component and
 * variant, past the limit listed (T-042). The walk stops at the op's deadline (P-075): what it reached is answered, with
 * `more` (and `countsCut`). Boxes are Figma's: the server rounds them (D-15).
 */
@injectable()
export class FindOperation extends Operation<FindInput, FindOutput> {
  readonly #loader;
  readonly #walk;
  readonly #lists;

  constructor(
    report = inject(OP_REPORT),
    loader = inject(PAGE_LOADER),
    walk = inject(LAYER_WALK),
    lists = inject(NAME_VALUE_LIST),
  ) {
    super(report);
    this.#loader = loader;
    this.#walk = walk;
    this.#lists = lists;
  }

  protected async execute(input: FindInput): Promise<FindOutput> {
    const variant = input.variant === undefined ? undefined : this.#variant(input.variant);
    // The deadline counts the page's loading too: offline, Figma takes 10 s to give up on it.
    const deadline = this.#walk.deadline();
    const roots = await this.#loader.children(input.within);
    const byMain = input.component !== undefined || variant !== undefined || (input.counts ?? false);
    const walked = this.#walk.until(this.#walk.layers(roots), deadline, {
      accepts: this.#matcher(input),
      enough: byMain ? Number.POSITIVE_INFINITY : input.limit + 1,
    });
    const search = byMain
      ? await this.#byMain(walked.kept, input, variant, deadline)
      : { found: walked.kept, cut: false };
    const cut = walked.cut || search.cut;

    return {
      nodes: search.found.slice(0, input.limit).map((node) => this.#found(node)),
      more: cut || search.found.length > input.limit,
      ...(variant === undefined ? {} : { variant }),
      ...(search.counts === undefined ? {} : { counts: search.counts }),
      ...(search.counts !== undefined && cut ? { countsCut: true as const } : {}),
    };
  }

  /** The variant's values as asked; a list naming no property is refused, since it would match every instance. */
  #variant(text: string): Values {
    const values = this.#lists.parse(text);

    if (values === null || Object.keys(values).length === 0) {
      throw new PixelwrightError(ERROR_CODE.opFailed, FIND_TEXT.variant);
    }

    return values;
  }

  /** Whether a layer matches the name, type and text, and is an instance when a component or variant is asked for. */
  #matcher(input: FindInput): (node: SceneNode) => boolean {
    const name = input.name?.toLowerCase();
    const type = input.type?.toUpperCase();
    const text = input.text?.toLowerCase();
    const instances = input.component !== undefined || input.variant !== undefined;

    return (node) =>
      (name === undefined || node.name.toLowerCase().includes(name)) &&
      (type === undefined || node.type === type) &&
      (text === undefined || (node.type === FIND_NODE_TYPE.text && node.characters.toLowerCase().includes(text))) &&
      (!instances || node.type === FIND_NODE_TYPE.instance);
  }

  /**
   * The candidates whose main component matches, looked up in batches until one past the limit is found (when
   * counting, to the end), the instances among them counted, until the deadline.
   */
  async #byMain(
    candidates: readonly SceneNode[],
    input: FindInput,
    variant: Values | undefined,
    deadline: number,
  ): Promise<Search> {
    const wanted = this.#mainMatcher(input.component, variant);
    const tally: Tally = { found: [], counts: (input.counts ?? false) ? new Map() : null, limit: input.limit };
    const search = (cut: boolean): Search => ({
      found: tally.found,
      ...(tally.counts === null ? {} : { counts: [...tally.counts.values()] }),
      cut,
    });

    for (
      let start = 0;
      start < candidates.length && (tally.counts !== null || tally.found.length <= input.limit);
      start += LIMITS.mainComponentBatch
    ) {
      if (this.#walk.passed(deadline)) {
        return search(true);
      }

      const batch = candidates.slice(start, start + LIMITS.mainComponentBatch);
      const mains = await Promise.all(batch.map((node) => this.#mainOf(node)));

      for (const [at, node] of batch.entries()) {
        const main = mains[at] ?? null;

        if (wanted(main)) {
          this.#take(tally, node, main);
        }
      }
    }

    return search(false);
  }

  /** A matching layer: listed while the list is not one past the limit, and counted when it is an instance. */
  #take(
    tally: Tally,
    node: SceneNode,
    main: ComponentNode | null,
  ): void {
    if (tally.found.length <= tally.limit) {
      tally.found.push(node);
    }

    if (tally.counts !== null && main !== null) {
      const set = main.parent?.type === FIND_NODE_TYPE.componentSet ? main.parent : null;
      const names = set === null ? { component: main.name } : { component: set.name, variant: main.name };
      const key = FIND_COUNT.key(names.component, names.variant);

      tally.counts.set(key, { ...names, count: (tally.counts.get(key)?.count ?? 0) + 1 });
    }
  }

  /** An instance's main component; null for any other layer, and for an instance whose component is gone. */
  #mainOf(node: SceneNode): Promise<ComponentNode | null> {
    return node.type === FIND_NODE_TYPE.instance ? node.getMainComponentAsync() : Promise.resolve(null);
  }

  /**
   * Whether a main component is named like the component asked for (its own name or its set's) and has every variant
   * value asked for, names and values in any case; with neither asked, every layer matches.
   */
  #mainMatcher(component: string | undefined, variant: Values | undefined): (main: ComponentNode | null) => boolean {
    if (component === undefined && variant === undefined) {
      return () => true;
    }

    const query = component?.toLowerCase();
    const pairs = this.#lowered(variant ?? {});

    return (main) => {
      if (main === null) {
        return false;
      }

      const names = [main.name, main.parent?.type === FIND_NODE_TYPE.componentSet ? main.parent.name : undefined];
      // A variant's values come from Figma, or from its name when Figma gives none.
      const values = new Map(this.#lowered(main.variantProperties ?? this.#lists.parse(main.name) ?? {}));

      return (
        (query === undefined || names.some((name) => name?.toLowerCase().includes(query))) &&
        pairs.every(([name, value]) => values.get(name) === value)
      );
    };
  }

  #lowered(values: Values): [string, string][] {
    return Object.entries(values).map(([name, value]) => [name.toLowerCase(), value.toLowerCase()]);
  }

  #found(node: SceneNode): Found {
    const box = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;

    return { id: node.id, name: node.name, type: node.type, box, path: this.#path(node) };
  }

  /** The names of a layer's ancestors below its page, outermost first. */
  #path(node: SceneNode): string[] {
    const names: string[] = [];

    for (
      let current = node.parent;
      current !== null && current.type !== FIND_NODE_TYPE.page && current.type !== FIND_NODE_TYPE.document;
      current = current.parent
    ) {
      names.unshift(current.name);
    }

    return names;
  }
}

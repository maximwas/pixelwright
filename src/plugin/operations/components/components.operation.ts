import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { COMPONENT_FINDER } from "@/plugin/operations/components/component-finder.ts";
import { COMPONENT_LINKS, type Linked } from "@/plugin/operations/components/component-links.ts";
import type { FoundComponents } from "@/plugin/operations/components/components.types.ts";
import { EXPOSED_INSTANCES } from "@/plugin/operations/components/exposed-instances.ts";
import { COMPONENTS_SCOPE } from "@/shared/ops/components/components.constants.ts";
import type { componentsOp } from "@/shared/ops/components/components.manifest.ts";
import type { ComponentEntry } from "@/shared/ops/components/components.schema.ts";

type ComponentsInput = zod.output<typeof componentsOp.input>;

type ComponentsOutput = zod.output<typeof componentsOp.output>;

/**
 * The file's own components or the ones a layer's instances come from (T-190, P-124), narrowed by name and cut at the
 * limit, each with the nested instances it exposes; with `links`, their Dev Mode links (T-192). A big file answers within
 * the op's budget with what it reached and `more`.
 */
@injectable()
export class ComponentsOperation extends Operation<ComponentsInput, ComponentsOutput> {
  readonly #finder;
  readonly #exposed;
  readonly #links;

  constructor(
    report = inject(OP_REPORT),
    finder = inject(COMPONENT_FINDER),
    exposed = inject(EXPOSED_INSTANCES),
    links = inject(COMPONENT_LINKS),
  ) {
    super(report);
    this.#finder = finder;
    this.#exposed = exposed;
    this.#links = links;
  }

  protected async execute({ scope, within, query, limit, links }: ComponentsInput): Promise<ComponentsOutput> {
    const found = scope === COMPONENTS_SCOPE.local ? await this.#finder.local(within) : await this.#finder.used(within);
    const wanted = query?.toLowerCase();
    const matching = [...found.entries.values()].filter(
      (entry) => wanted === undefined || entry.name.toLowerCase().includes(wanted),
    );
    const listed = await this.#withExposed(matching.slice(0, limit), found);
    const linked: Linked = links ? await this.#links.linked(listed, found) : { entries: listed };

    return {
      components: linked.entries,
      more: found.cut || matching.length > limit,
      ...(found.notRead.length === 0 ? {} : { pagesNotRead: [...found.notRead] }),
      ...(linked.note === undefined ? {} : { linksNote: linked.note }),
    };
  }

  /** The entries with the nested instances their components expose, where there are any. */
  #withExposed(entries: readonly ComponentEntry[], found: FoundComponents): Promise<ComponentEntry[]> {
    return Promise.all(
      entries.map(async (entry) => {
        const owner = found.owners.get(entry.id);
        const exposed = owner === undefined ? [] : await this.#exposed.of(owner);

        return exposed.length === 0 ? entry : { ...entry, exposed };
      }),
    );
  }
}

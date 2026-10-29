import { inject, injectable } from "@needle-di/core";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { WITHIN_SCOPE } from "@/server/app/scope/within-scope.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import {
  type NodesFindInput,
  NodesFindInputSchema,
  type NodesFindOutput,
} from "@/server/tools/nodes-find/nodes-find.schema.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { FIND_COUNT } from "@/shared/ops/find/find.constants.ts";
import { findOp } from "@/shared/ops/find/find.manifest.ts";
import type { Counted, Found } from "@/shared/ops/find/find.schema.ts";

type Query = Omit<NodesFindInput, "file" | "within">;

/**
 * Layers in the call's file (T-040): the plugin's find in each root `within` gives, page after page for "file" (T-041)
 * until the limit is passed, or through every page when counting, the counts added up (T-042); all of them in one
 * budget, the pages past it unread and the answer cut (P-075); boxes rounded (D-15).
 */
@injectable()
export class NodesFindTool extends Tool<NodesFindInput, NodesFindOutput> {
  protected readonly input = NodesFindInputSchema;
  readonly #session;
  readonly #scope;
  readonly #numbers;
  readonly #clock;

  constructor(
    session = inject(PLUGIN_SESSION),
    scope = inject(WITHIN_SCOPE),
    numbers = inject(NUMBER_FORMAT),
    clock = inject(CLOCK),
  ) {
    super();
    this.#session = session;
    this.#scope = scope;
    this.#numbers = numbers;
    this.#clock = clock;
  }

  protected async run({ file, within, ...query }: NodesFindInput): Promise<NodesFindOutput> {
    const answers: NodesFindOutput[] = [];
    const ends = this.#clock.now() + LIMITS.opBudgetMs;

    for (const root of await this.#scope.roots(this.#session, within)) {
      const budgetMs = Math.min(ends - this.#clock.now(), LIMITS.opBudgetMs);

      if (budgetMs <= 0) {
        // The roots left are unread: the answer says there is more, and that its counts are cut.
        answers.push({ nodes: [], more: true, ...((query.counts ?? false) ? { countsCut: true as const } : {}) });
        break;
      }

      const found = await this.#session.run(findOp, { ...query, within: root, budgetMs });

      answers.push(found);

      if (!(query.counts ?? false) && (found.more || answers.flatMap(({ nodes }) => nodes).length > query.limit)) {
        break;
      }
    }

    return this.#merged(answers, query);
  }

  /** Every root's answer as one: the first layers up to the limit, and the counts added up in the order first met. */
  #merged(answers: readonly NodesFindOutput[], { limit, counts }: Query): NodesFindOutput {
    const nodes = answers.flatMap((found) => found.nodes);
    const tally = new Map<string, Counted>();
    const [first] = answers;

    for (const entry of answers.flatMap((found) => found.counts ?? [])) {
      const key = FIND_COUNT.key(entry.component, entry.variant);

      tally.set(key, { ...entry, count: (tally.get(key)?.count ?? 0) + entry.count });
    }

    return {
      nodes: nodes.slice(0, limit).map((node) => this.#rounded(node)),
      more: nodes.length > limit || answers.some((found) => found.more),
      ...(first?.variant === undefined ? {} : { variant: first.variant }),
      ...((counts ?? false) ? { counts: [...tally.values()] } : {}),
      ...(answers.some((found) => found.countsCut ?? false) ? { countsCut: true as const } : {}),
    };
  }

  /** The layer with its box in whole px (D-15). */
  #rounded(node: Found): Found {
    const { box } = node;
    const round = (value: number) => this.#numbers.round(value, PRECISION.box);

    return {
      ...node,
      box:
        box === null ? null : { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) },
    };
  }
}

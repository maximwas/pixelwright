import { expect, it } from "vitest";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { Clock } from "@/core/ports/clock.port.ts";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { WithinScope } from "@/server/app/scope/within-scope.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { NodesFindTool } from "@/server/tools/nodes-find/nodes-find.tool.ts";

const PAGES = ["1:1", "2:1", "3:1"];

/** How long counting one page takes the plugin, when its budget lets it. */
const PAGE_MS = 12_000;

/** Time as the finds spend it. */
class SpentClock implements Clock {
  ms = 0;

  now(): number {
    return this.ms;
  }
}

/** A plugin whose every page has one Button: a find spends 12 s on it, or its whole budget and is cut when that is less. */
class CountingPlugin implements PluginLink {
  readonly finds: unknown[] = [];
  readonly #clock: SpentClock;

  constructor(clock: SpentClock) {
    this.#clock = clock;
  }

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  async state(): Promise<PluginLinkState> {
    throw new Error("only status reads the state");
  }

  role(): PluginLinkRole {
    return "owner";
  }

  files(): readonly ConnectedFile[] {
    return [];
  }

  async request({ op, input }: OpRequest): Promise<unknown> {
    if (op === "file_map") {
      return { pages: PAGES.map((id, index) => ({ id, name: id, current: index === 0 })) };
    }

    const { within, budgetMs } = input as { within: string; budgetMs?: number };
    const cut = (budgetMs ?? Number.POSITIVE_INFINITY) < PAGE_MS;

    this.finds.push({ within, budgetMs });
    this.#clock.ms += cut ? (budgetMs ?? 0) : PAGE_MS;

    return { nodes: [], more: cut, counts: [{ component: "Button", count: 1 }], ...(cut ? { countsCut: true } : {}) };
  }
}

// P-075: counting through the file has one 20 s budget, not one per page; what is left unread says more and countsCut.
it("gives each page's find what the pages before it left of 20 s, and stops cut once it is spent", async () => {
  const clock = new SpentClock();
  const plugin = new CountingPlugin(clock);
  const tool = new NodesFindTool(
    new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", plugin, []),
    new WithinScope(),
    new NumberFormat(),
    clock,
  );

  const answer = await tool.execute({ within: "file", component: "Button", counts: true });

  expect(plugin.finds).toEqual([
    { within: "1:1", budgetMs: 20_000 },
    { within: "2:1", budgetMs: 8_000 },
  ]);
  expect(answer.structuredContent).toEqual({
    nodes: [],
    more: true,
    counts: [{ component: "Button", count: 2 }],
    countsCut: true,
  });
});

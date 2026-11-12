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

/** A plugin whose every page has one Card frame at its top. */
class CardsPlugin extends CountingPlugin {
  override async request(request: OpRequest): Promise<unknown> {
    if (request.op === "file_map") {
      return super.request(request);
    }

    const { within } = request.input as { within: string };

    return { nodes: [{ id: `${within}5`, name: "Card", type: "FRAME", box: null, path: [] }], more: false };
  }
}

// Within "file", each layer found names the page it is on: the server knows which page's find gave it.
it("names the page of every layer found within the file", async () => {
  const clock = new SpentClock();
  const tool = new NodesFindTool(
    new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", new CardsPlugin(clock), []),
    new WithinScope(),
    new NumberFormat(),
    clock,
  );
  const answer = await tool.execute({ within: "file", name: "Card" });

  expect(answer.structuredContent).toEqual({
    nodes: PAGES.map((page) => ({
      id: `${page}5`,
      name: "Card",
      type: "FRAME",
      box: null,
      path: [],
      page: { id: page, name: page },
    })),
    more: false,
  });
});

/** A plugin that answers one image layer per root and keeps every find's input. */
class ImagesPlugin extends CountingPlugin {
  readonly inputs: unknown[] = [];

  override async request(request: OpRequest): Promise<unknown> {
    const { within } = request.input as { within: string };

    this.inputs.push(request.input);

    return { nodes: [{ id: `${within}7`, name: "Photo", type: "RECTANGLE", box: null, path: [] }], more: false };
  }
}

// "Every image layer in these 4 frames" is one call: within takes a list of roots, fill a paint type.
it("finds layers with an image fill in each root of a within list, in one call", async () => {
  const clock = new SpentClock();
  const plugin = new ImagesPlugin(clock);
  const tool = new NodesFindTool(
    new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", plugin, []),
    new WithinScope(),
    new NumberFormat(),
    clock,
  );
  const answer = await tool.execute({ within: ["10:1", "20:1"], fill: "IMAGE" });

  expect(plugin.inputs).toEqual([
    expect.objectContaining({ within: "10:1", fill: "IMAGE" }),
    expect.objectContaining({ within: "20:1", fill: "IMAGE" }),
  ]);
  expect(answer.structuredContent).toEqual({
    nodes: [
      { id: "10:17", name: "Photo", type: "RECTANGLE", box: null, path: [] },
      { id: "20:17", name: "Photo", type: "RECTANGLE", box: null, path: [] },
    ],
    more: false,
  });
});

// fields keeps a long answer short: only the fields named, id, name and type always.
it("keeps only the fields asked for, with id, name and type", async () => {
  const clock = new SpentClock();
  const tool = new NodesFindTool(
    new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", new CardsPlugin(clock), []),
    new WithinScope(),
    new NumberFormat(),
    clock,
  );
  const answer = await tool.execute({ within: "file", name: "Card", fields: ["page"] });

  expect(answer.structuredContent).toEqual({
    nodes: PAGES.map((page) => ({ id: `${page}5`, name: "Card", type: "FRAME", page: { id: page, name: page } })),
    more: false,
  });
});

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

// T-040: without within, the current page is searched: the answer names it, and an empty one says how to look further.
it("names the current page it searched, and hints within when it found nothing there", async () => {
  const clock = new SpentClock();
  const tool = new NodesFindTool(
    new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", new CountingPlugin(clock), []),
    new WithinScope(),
    new NumberFormat(),
    clock,
  );
  const answer = await tool.execute({ name: "Plans" });

  expect(answer.structuredContent).toEqual({
    nodes: [],
    more: false,
    page: "1:1",
    hint: 'Nothing found on the current page, "1:1": pass within (a page id, or "file" for every page) to search elsewhere.',
  });
});

// A pattern that backtracks exponentially would freeze Figma in one uninterruptible test: it is refused before the op.
it.each([["(a+)+$"], ["^(\\w+\\s?)*$"]])("refuses the pattern %s without calling the plugin", async (textRegex) => {
  const clock = new SpentClock();
  const plugin = new CountingPlugin(clock);
  const tool = new NodesFindTool(
    new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", plugin, []),
    new WithinScope(),
    new NumberFormat(),
    clock,
  );

  await expect(tool.execute({ within: "1:1", textRegex })).rejects.toThrow(/freezes Figma/);
  expect(plugin.finds).toEqual([]);
});

it.each([["\\d+px"], ["^\\$\\d+"]])("sends the pattern %s to the plugin", async (textRegex) => {
  const clock = new SpentClock();
  const plugin = new CountingPlugin(clock);
  const tool = new NodesFindTool(
    new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", plugin, []),
    new WithinScope(),
    new NumberFormat(),
    clock,
  );

  await tool.execute({ within: "1:1", textRegex });

  expect(plugin.finds).toHaveLength(1);
});

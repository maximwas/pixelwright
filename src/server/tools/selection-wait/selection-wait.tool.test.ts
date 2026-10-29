import { describe, expect, it } from "vitest";
import type { Clock } from "@/core/ports/clock.port.ts";
import type { Logger } from "@/core/ports/logger.port.ts";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { CallId } from "@/server/app/tool-runner/call-id.ts";
import { SelectionWaitTool } from "@/server/tools/selection-wait/selection-wait.tool.ts";

const SELECTED = ["81:1627"];

/** Time as the rounds spend it: a round that runs out moves it on by all of its own. */
class RoundClock implements Clock {
  ms = 0;

  now(): number {
    return this.ms;
  }
}

/** A plugin whose user selects nothing new: each round runs out its time and answers with the selection it began from. */
class UnchangedPlugin implements PluginLink {
  readonly rounds: unknown[] = [];
  readonly #clock: RoundClock;
  readonly #during: () => void;

  constructor(clock: RoundClock, during: () => void = () => {}) {
    this.#clock = clock;
    this.#during = during;
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

  async request({ input }: OpRequest): Promise<unknown> {
    this.rounds.push(input);
    this.#during();
    this.#clock.ms += (input as { timeoutMs: number }).timeoutMs;

    return { changed: false, from: SELECTED, nodes: [] };
  }
}

/** The Logger port keeping nothing: the tool writes no lines of its own. */
class SilentLogger implements Logger {
  trace(): void {}

  debug(): void {}

  info(): void {}

  warn(): void {}

  error(): void {}

  child(): Logger {
    return this;
  }
}

const waitTool = (
  link: PluginLink,
  clock: Clock,
  signal: AbortSignal,
) =>
  new SelectionWaitTool(
    new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", link, []),
    { callId: CallId.next(), logger: new SilentLogger(), signal },
    clock,
  );

describe("SelectionWaitTool", () => {
  it("waits in rounds of at most 25 s until the timeout, each from the selection the first one saw (T-031)", async () => {
    const clock = new RoundClock();
    const plugin = new UnchangedPlugin(clock);
    const answer = await waitTool(plugin, clock, new AbortController().signal).execute({ timeout: 60 });

    expect(plugin.rounds).toEqual([
      { timeoutMs: 25_000, from: null },
      { timeoutMs: 25_000, from: SELECTED },
      { timeoutMs: 10_000, from: SELECTED },
    ]);
    expect(answer.structuredContent).toEqual({ changed: false, nodes: [] });
  });

  it("starts no round after the client aborted the call: it ends with the current one (T-014)", async () => {
    const clock = new RoundClock();
    const abort = new AbortController();
    const plugin = new UnchangedPlugin(clock, () => abort.abort());
    const answer = await waitTool(plugin, clock, abort.signal).execute({ timeout: 300 });

    expect(plugin.rounds).toEqual([{ timeoutMs: 25_000, from: null }]);
    expect(answer.structuredContent).toEqual({ changed: false, nodes: [] });
  });
});

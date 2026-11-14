import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLUGIN_ARRIVAL } from "@/core/ports/plugin-link.constants.ts";
import { PluginWatch } from "@/server/adapters/bridge/sessions/plugin-watch.ts";
import { PLUGIN_WINDOW_MS } from "@/server/adapters/bridge/sessions/sessions.constants.ts";

describe("PluginWatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** Its clock is the fake timers': Date.now() moves only when a test advances them. */
  const watch = () => new PluginWatch({ now: () => Date.now() });

  /** A call nobody cancels. */
  const calm = () => new AbortController().signal;

  /**
   * A waker left behind cannot be seen by behaviour (it wakes a call that is already over), so the wait is
   * started under a spy on the one Set the watch keeps its wakers in, and `held` reads that Set.
   */
  const waitSeeingWakers = (plugins: PluginWatch, signal: AbortSignal) => {
    const add = vi.spyOn(Set.prototype, "add");
    const waiting = plugins.wait(signal);
    const wakers = add.mock.contexts[0] as Set<unknown> | undefined;

    add.mockRestore();

    return { waiting, held: () => wakers?.size };
  };

  it("does not wait when no plugin is expected", async () => {
    await expect(watch().wait(calm())).resolves.toBe(PLUGIN_ARRIVAL.absent);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("answers arrived as soon as a file connects during the wait, and leaves no timer behind", async () => {
    const plugins = watch();

    plugins.up();

    const waiting = plugins.wait(calm());

    await vi.advanceTimersByTimeAsync(3_000);
    plugins.arrived();

    await expect(waiting).resolves.toBe(PLUGIN_ARRIVAL.arrived);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits only for what is left of the window since the bridge came up, then says no plugin came", async () => {
    const plugins = watch();

    plugins.up();
    await vi.advanceTimersByTimeAsync(15_000);

    let settled = false;
    const waiting = plugins.wait(calm()).then((arrival) => {
      settled = true;

      return arrival;
    });

    await vi.advanceTimersByTimeAsync(PLUGIN_WINDOW_MS - 15_000 - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(waiting).resolves.toBe(PLUGIN_ARRIVAL.absent);
  });

  it("says the plugin left when a file went a moment ago and none came back", async () => {
    const plugins = watch();

    plugins.left();

    const waiting = plugins.wait(calm());

    await vi.advanceTimersByTimeAsync(PLUGIN_WINDOW_MS);

    await expect(waiting).resolves.toBe(PLUGIN_ARRIVAL.left);
  });

  it("a cancelled wait ends at once and leaves no waker", async () => {
    const plugins = watch();
    const cancelling = new AbortController();

    plugins.up();

    const { waiting, held } = waitSeeingWakers(plugins, cancelling.signal);
    let outcome: unknown = null;

    waiting.then(
      (arrival) => {
        outcome = arrival;
      },
      (error: unknown) => {
        outcome = error;
      },
    );
    await vi.advanceTimersByTimeAsync(3_000);
    cancelling.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome).toMatchObject({ name: "AbortError" });
    expect(held()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a timed-out wait leaves no waker", async () => {
    const plugins = watch();

    plugins.up();

    const { waiting, held } = waitSeeingWakers(plugins, calm());

    await vi.advanceTimersByTimeAsync(PLUGIN_WINDOW_MS);

    await expect(waiting).resolves.toBe(PLUGIN_ARRIVAL.absent);
    expect(held()).toBe(0);
  });

  it("expects no plugin once the window has passed", async () => {
    const plugins = watch();

    plugins.up();
    plugins.left();
    await vi.advanceTimersByTimeAsync(PLUGIN_WINDOW_MS);

    await expect(plugins.wait(calm())).resolves.toBe(PLUGIN_ARRIVAL.absent);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLUGIN_ARRIVAL } from "@/core/ports/plugin-link.constants.ts";
import { PluginWatch } from "@/server/adapters/bridge/sessions/plugin-watch.ts";
import { PLUGIN_WINDOW_MS } from "@/server/adapters/bridge/sessions/sessions.constants.ts";

describe("PluginWatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Its clock is the fake timers': Date.now() moves only when a test advances them. */
  const watch = () => new PluginWatch({ now: () => Date.now() });

  it("does not wait when no plugin is expected", async () => {
    await expect(watch().wait()).resolves.toBe(PLUGIN_ARRIVAL.absent);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("answers arrived as soon as a file connects during the wait, and leaves no timer behind", async () => {
    const plugins = watch();

    plugins.up();

    const waiting = plugins.wait();

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
    const waiting = plugins.wait().then((arrival) => {
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

    const waiting = plugins.wait();

    await vi.advanceTimersByTimeAsync(PLUGIN_WINDOW_MS);

    await expect(waiting).resolves.toBe(PLUGIN_ARRIVAL.left);
  });

  it("expects no plugin once the window has passed", async () => {
    const plugins = watch();

    plugins.up();
    plugins.left();
    await vi.advanceTimersByTimeAsync(PLUGIN_WINDOW_MS);

    await expect(plugins.wait()).resolves.toBe(PLUGIN_ARRIVAL.absent);
  });
});

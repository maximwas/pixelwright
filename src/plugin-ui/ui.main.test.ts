import type { InjectionToken } from "@needle-di/core";
import { describe, expect, it } from "vitest";
import { MAIN_CHANNEL } from "@/plugin-ui/adapters/main-channel/main-channel.tokens.ts";
import { BACKOFF } from "@/plugin-ui/link/backoff/backoff.tokens.ts";
import { SOCKET_LINK, SOCKET_OPENER } from "@/plugin-ui/link/socket-link/socket-link.tokens.ts";
import { STOP_REASONS } from "@/plugin-ui/link/stop-reasons/stop-reasons.tokens.ts";
import { WINDOW_LINK } from "@/plugin-ui/link/window-link/window-link.tokens.ts";
import { UiMain } from "@/plugin-ui/ui.main.ts";
import { PLUGIN_WINDOW } from "@/plugin-ui/view/plugin-window/plugin-window.tokens.ts";

const SINGLETONS: [string, InjectionToken<unknown>][] = [
  ["MAIN_CHANNEL", MAIN_CHANNEL],
  ["PLUGIN_WINDOW", PLUGIN_WINDOW],
  ["SOCKET_OPENER", SOCKET_OPENER],
  ["BACKOFF", BACKOFF],
  ["STOP_REASONS", STOP_REASONS],
  ["SOCKET_LINK", SOCKET_LINK],
  ["WINDOW_LINK", WINDOW_LINK],
];

// No DOM, no socket here: building the container touches neither, only start() does.
describe("UiMain's composition", () => {
  it.each(SINGLETONS)("resolves %s, and a child container reaches the root's own instance", (_name, token) => {
    const container = new UiMain().container();

    expect(container.get(token)).toBeDefined();
    expect(container.createChild().get(token)).toBe(container.get(token));
  });
});

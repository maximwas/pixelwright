import type { InjectionToken } from "@needle-di/core";
import { describe, expect, it } from "vitest";
import { MAIN_CHANNEL } from "@/plugin-ui/adapters/main-channel.ts";
import { BACKOFF } from "@/plugin-ui/link/backoff.ts";
import { SOCKET_LINK, SOCKET_OPENER } from "@/plugin-ui/link/socket-link.ts";
import { WINDOW_LINK } from "@/plugin-ui/link/window-link.ts";
import { UiMain } from "@/plugin-ui/ui.main.ts";
import { BUSY_STATE } from "@/plugin-ui/view/busy-state.ts";
import { PLUGIN_WINDOW } from "@/plugin-ui/view/plugin-window.ts";
import { STATUS_LINE } from "@/plugin-ui/view/status-line.ts";

const SINGLETONS: [string, InjectionToken<unknown>][] = [
  ["MAIN_CHANNEL", MAIN_CHANNEL],
  ["STATUS_LINE", STATUS_LINE],
  ["BUSY_STATE", BUSY_STATE],
  ["PLUGIN_WINDOW", PLUGIN_WINDOW],
  ["SOCKET_OPENER", SOCKET_OPENER],
  ["BACKOFF", BACKOFF],
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

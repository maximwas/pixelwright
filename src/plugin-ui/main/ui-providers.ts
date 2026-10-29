import type { Container } from "@needle-di/core";
import { BrowserSockets } from "@/plugin-ui/adapters/browser-sockets.ts";
import { MAIN_CHANNEL, MainChannel } from "@/plugin-ui/adapters/main-channel.ts";
import { BACKOFF, Backoff } from "@/plugin-ui/link/backoff.ts";
import { SOCKET_LINK, SOCKET_OPENER, SocketLink } from "@/plugin-ui/link/socket-link.ts";
import { WINDOW_LINK, WindowLink } from "@/plugin-ui/link/window-link.ts";
import { BUSY_STATE, BusyState } from "@/plugin-ui/view/busy-state.ts";
import { PLUGIN_WINDOW, PluginWindow } from "@/plugin-ui/view/plugin-window.ts";
import { RECENT_ACTIONS, RecentActions } from "@/plugin-ui/view/recent-actions.ts";
import { STATUS_LINE, StatusLine } from "@/plugin-ui/view/status-line.ts";

/**
 * The window's bindings (A§4b.3): main's channel, the view with its words, its activity and its busy state, the
 * browser's sockets, and the link over them.
 */
export class UiProviders {
  register(container: Container): void {
    container
      .bind({ provide: MAIN_CHANNEL, useClass: MainChannel })
      .bind({ provide: STATUS_LINE, useClass: StatusLine })
      .bind({ provide: RECENT_ACTIONS, useClass: RecentActions })
      .bind({ provide: BUSY_STATE, useClass: BusyState })
      .bind({ provide: PLUGIN_WINDOW, useClass: PluginWindow })
      .bind({ provide: SOCKET_OPENER, useClass: BrowserSockets })
      .bind({ provide: BACKOFF, useClass: Backoff })
      .bind({ provide: SOCKET_LINK, useClass: SocketLink })
      .bind({ provide: WINDOW_LINK, useClass: WindowLink });
  }
}

import type { Container } from "@needle-di/core";
import { BrowserSockets } from "@/plugin-ui/adapters/browser-sockets.ts";
import { MAIN_CHANNEL, MainChannel } from "@/plugin-ui/adapters/main-channel.ts";
import { BACKOFF, Backoff } from "@/plugin-ui/link/backoff.ts";
import { SOCKET_LINK, SOCKET_OPENER, SocketLink } from "@/plugin-ui/link/socket-link.ts";
import { WINDOW_LINK, WindowLink } from "@/plugin-ui/link/window-link.ts";
import { PLUGIN_WINDOW, PluginWindow } from "@/plugin-ui/view/plugin-window.ts";

/** The window's bindings (A§4b.3): main's channel, the view, the browser's sockets, and the link over them. */
export class UiProviders {
  register(container: Container): void {
    container
      .bind({ provide: MAIN_CHANNEL, useClass: MainChannel })
      .bind({ provide: PLUGIN_WINDOW, useClass: PluginWindow })
      .bind({ provide: SOCKET_OPENER, useClass: BrowserSockets })
      .bind({ provide: BACKOFF, useClass: Backoff })
      .bind({ provide: SOCKET_LINK, useClass: SocketLink })
      .bind({ provide: WINDOW_LINK, useClass: WindowLink });
  }
}

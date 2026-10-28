import type { Container } from "@needle-di/core";
import { BrowserSockets } from "@/plugin-ui/adapters/browser-sockets/browser-sockets.ts";
import { MAIN_CHANNEL } from "@/plugin-ui/adapters/main-channel/main-channel.tokens.ts";
import { MainChannel } from "@/plugin-ui/adapters/main-channel/main-channel.ts";
import { BACKOFF } from "@/plugin-ui/link/backoff/backoff.tokens.ts";
import { Backoff } from "@/plugin-ui/link/backoff/backoff.ts";
import { SOCKET_LINK, SOCKET_OPENER } from "@/plugin-ui/link/socket-link/socket-link.tokens.ts";
import { SocketLink } from "@/plugin-ui/link/socket-link/socket-link.ts";
import { STOP_REASONS } from "@/plugin-ui/link/stop-reasons/stop-reasons.tokens.ts";
import { StopReasons } from "@/plugin-ui/link/stop-reasons/stop-reasons.ts";
import { WINDOW_LINK } from "@/plugin-ui/link/window-link/window-link.tokens.ts";
import { WindowLink } from "@/plugin-ui/link/window-link/window-link.ts";
import { PLUGIN_WINDOW } from "@/plugin-ui/view/plugin-window/plugin-window.tokens.ts";
import { PluginWindow } from "@/plugin-ui/view/plugin-window/plugin-window.ts";

/** The window's bindings (A§4b.3): main's channel, the view, the browser's sockets, and the link over them. */
export class UiProviders {
  register(container: Container): void {
    container
      .bind({
        provide: MAIN_CHANNEL,
        useClass: MainChannel,
      })
      .bind({
        provide: PLUGIN_WINDOW,
        useClass: PluginWindow,
      })
      .bind({
        provide: SOCKET_OPENER,
        useClass: BrowserSockets,
      })
      .bind({
        provide: BACKOFF,
        useClass: Backoff,
      })
      .bind({
        provide: STOP_REASONS,
        useClass: StopReasons,
      })
      .bind({
        provide: SOCKET_LINK,
        useClass: SocketLink,
      })
      .bind({
        provide: WINDOW_LINK,
        useClass: WindowLink,
      });
  }
}

import { Container } from "@needle-di/core";
import { WINDOW_HOST } from "@/plugin/adapters/host/window-host/window-host.tokens.ts";
import { HostProviders } from "@/plugin/main/host-providers/host-providers.ts";
import { PLUGIN_WINDOW } from "@/plugin/main/plugin.constants.ts";

/**
 * The plugin main thread's composition root (A§4.3, A§4b.3), the one owner of its container. The build's entry runs
 * `new PluginMain().start()`: the window opens with ui.html alone and no data (FX-001), then main answers it.
 */
export class PluginMain {
  #container: Container | undefined;

  /** The composed container, for the composition test alone: nothing else outside main/ sees it. */
  container(): Container {
    return this.#composed();
  }

  start(): void {
    figma.showUI(__html__, PLUGIN_WINDOW);
    this.#composed().get(WINDOW_HOST).start();
  }

  #composed(): Container {
    if (this.#container === undefined) {
      this.#container = new Container();
      new HostProviders().register(this.#container);
    }

    return this.#container;
  }
}

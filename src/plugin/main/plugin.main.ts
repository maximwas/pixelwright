import { Container } from "@needle-di/core";
import { DOCUMENT_EVENTS } from "@/core/ports/document-events.port.ts";
import { SERVER_EVENTS } from "@/core/ports/server-events.port.ts";
import { SERVER_RPC } from "@/plugin/adapters/host/channels/server-rpc.ts";
import { WINDOW_HOST } from "@/plugin/adapters/host/channels/window-host.ts";
import { OPERATION_RUNNER } from "@/plugin/app/operation-runner.ts";
import { HostProviders } from "@/plugin/main/host-providers.ts";
import { OperationProviders } from "@/plugin/main/operation-providers.ts";
import { PLUGIN_WINDOW } from "@/plugin/main/plugin.constants.ts";
import { RuntimeProviders } from "@/plugin/main/runtime-providers.ts";

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
    const container = this.#composed();
    const runner = container.get(OPERATION_RUNNER);

    figma.showUI(__html__, PLUGIN_WINDOW);
    // An arrow, not the runner itself: birpc calls a served function with its own `this`.
    container.get(SERVER_RPC).start({ run: (op, input) => runner.run(op, input) });
    this.#publishInfo(container);
    container.get(WINDOW_HOST).start();
  }

  /**
   * Plugin info events (S-012): each change of the file's page, Allow edits or tab goes to the server, and so
   * does the info as every new socket's session starts, since that socket's hello may carry a page from before.
   */
  #publishInfo(container: Container): void {
    const events = container.get(DOCUMENT_EVENTS);
    const server = container.get(SERVER_EVENTS);

    events.start((info) => server.pluginInfo(info));
    server.onOpen(() => void events.info().then((info) => server.pluginInfo(info)));
  }

  #composed(): Container {
    if (this.#container === undefined) {
      this.#container = new Container();
      new HostProviders().register(this.#container);
      new RuntimeProviders().register(this.#container);
      new OperationProviders().register(this.#container);
    }

    return this.#container;
  }
}

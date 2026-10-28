import { Container } from "@needle-di/core";
import { SERVER_RPC } from "@/plugin/adapters/host/server-rpc/server-rpc.tokens.ts";
import { WINDOW_HOST } from "@/plugin/adapters/host/window-host/window-host.tokens.ts";
import { OPERATION_RUNNER } from "@/plugin/app/operation-runner/operation-runner.tokens.ts";
import { HostProviders } from "@/plugin/main/host-providers/host-providers.ts";
import { OperationProviders } from "@/plugin/main/operation-providers/operation-providers.ts";
import { PLUGIN_WINDOW } from "@/plugin/main/plugin.constants.ts";
import { RuntimeProviders } from "@/plugin/main/runtime-providers/runtime-providers.ts";

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
    container.get(SERVER_RPC).start({
      run: (
        op,
        input,
      ) => runner.run(op, input),
    });
    container.get(WINDOW_HOST).start();
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

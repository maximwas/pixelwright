import { Container } from "@needle-di/core";
import { WINDOW_LINK } from "@/plugin-ui/link/window-link/window-link.tokens.ts";
import { UiProviders } from "@/plugin-ui/main/ui-providers/ui-providers.ts";

/**
 * The plugin window's composition root (A§4.4, A§4b.3), the one owner of its container. The build's entry runs
 * `new UiMain().start()`; the window fills in ui.html, says ready, and connects once main answers.
 */
export class UiMain {
  #container: Container | undefined;

  /** The composed container, for the composition test alone: nothing else outside main/ sees it. */
  container(): Container {
    return this.#composed();
  }

  start(): void {
    this.#composed().get(WINDOW_LINK).start();
  }

  #composed(): Container {
    if (this.#container === undefined) {
      this.#container = new Container();
      new UiProviders().register(this.#container);
    }

    return this.#container;
  }
}

import { InjectionToken, inject, injectable } from "@needle-di/core";
import { DOCUMENT_EVENTS } from "@/core/ports/document-events/document-events.port.ts";
import { SERVER_EVENTS } from "@/core/ports/server-events/server-events.port.ts";

/**
 * Plugin info events (Observer, S-012): each change of the file's page, Allow edits or tab goes to the server, and so
 * does the info as every new socket's session starts, since that socket's hello may carry a page from before.
 */
@injectable()
export class PluginInfoPublisher {
  readonly #events;
  readonly #server;

  constructor(
    events = inject(DOCUMENT_EVENTS),
    server = inject(SERVER_EVENTS),
  ) {
    this.#events = events;
    this.#server = server;
  }

  start(): void {
    this.#events.onInfo((info) => this.#server.pluginInfo(info));
    this.#server.onOpen(() => void this.#events.info().then((info) => this.#server.pluginInfo(info)));
  }
}

export const PLUGIN_INFO_PUBLISHER = new InjectionToken<PluginInfoPublisher>("PluginInfoPublisher");

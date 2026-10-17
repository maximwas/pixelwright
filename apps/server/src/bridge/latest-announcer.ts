import { UPDATE_EVENT } from "@pixelwright/core";
import type { BridgeLog, PluginSession } from "../types/bridge.ts";
import { sendMessage } from "./plugin-connection.ts";

/** npm's newest Pixelwright once known: told to every plugin window now, and to each that says hello later. */
export class LatestAnnouncer {
  readonly #log: BridgeLog;
  #version: string | null = null;

  constructor(log: BridgeLog) {
    this.#log = log;
  }

  announce(version: string, sessions: Iterable<PluginSession>): void {
    this.#version = version;

    for (const session of sessions) {
      this.tell(session);
    }
  }

  tell(session: PluginSession): void {
    if (this.#version !== null) {
      sendMessage(
        session.socket,
        {
          type: "event",
          name: UPDATE_EVENT,
          data: { version: this.#version },
        },
        this.#log,
      );
    }
  }
}

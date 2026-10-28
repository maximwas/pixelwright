import { randomUUID } from "node:crypto";
import type { ConnectedFile } from "@/core/ports/plugin-link/plugin-link.port.ts";
import type { PluginInfo } from "@/shared/protocol/plugin-info.schema.ts";
import type { SessionSocket } from "./bridge-session.types.ts";

/**
 * One plugin window past the handshake, one open Figma file (S-011): a random session id, what the window said in its
 * hello, and when it connected and last came to the front, as positions on the registry's sequence, so two sessions
 * never tie.
 */
export class BridgeSession {
  readonly id = randomUUID();
  readonly info: PluginInfo;
  readonly #socket: SessionSocket;
  readonly #connected: number;
  readonly #lastVisible: number;

  constructor(
    socket: SessionSocket,
    info: PluginInfo,
    connected: number,
  ) {
    this.#socket = socket;
    this.info = info;
    this.#connected = connected;
    this.#lastVisible = info.visible ? connected : 0;
  }

  /** Ends it from the server's side; the registry has let it go already. */
  close(
    code: number,
    reason: string,
  ): void {
    this.#socket.close(code, reason);
  }

  /** Whether a tool that names no file takes this one before `other`: in front last, else connected last. */
  outranks(other: BridgeSession): boolean {
    return this.#lastVisible === other.#lastVisible
      ? this.#connected > other.#connected
      : this.#lastVisible > other.#lastVisible;
  }

  /** The file as status lists it. */
  file(active: boolean): ConnectedFile {
    return {
      session: this.id,
      name: this.info.file.name,
      key: this.info.file.key,
      page: this.info.page.name,
      editorType: this.info.editorType,
      allowEdits: this.info.allowEdits,
      active,
      pluginVersion: this.info.pluginVersion,
    };
  }
}

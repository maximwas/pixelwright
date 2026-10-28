import { randomUUID } from "node:crypto";
import * as zod from "zod/mini";
import type { ConnectedFile } from "@/core/ports/plugin-link.port.ts";
import { PluginRpc } from "@/server/adapters/bridge/plugin/plugin-rpc.ts";
import { type PluginInfo, PluginInfoUpdateSchema } from "@/shared/protocol/plugin-info.schema.ts";

/**
 * One plugin window past the handshake, one open Figma file (S-011): a random session id, what the window said in its
 * hello and in every plugin info event since (S-012), and when it connected and last came to the front, as positions
 * on the registry's sequence, so two sessions never tie.
 */
export class BridgeSession {
  readonly id = randomUUID();
  /** The plugin's ops, over this session's socket (A§5.4). */
  readonly rpc: PluginRpc;
  readonly #socket: SessionSocket;
  readonly #sequence: SessionSequence;
  readonly #connected: number;
  #info: PluginInfo;
  #lastVisible: number;

  constructor(
    socket: SessionSocket,
    info: PluginInfo,
    sequence: SessionSequence,
  ) {
    this.#socket = socket;
    this.#info = info;
    this.#sequence = sequence;
    this.rpc = new PluginRpc(socket, { pluginInfo: (update: unknown) => this.#update(update) });
    this.#connected = sequence.next();
    this.#lastVisible = info.visible ? this.#connected : 0;
  }

  get info(): PluginInfo {
    return this.#info;
  }

  /** Ends it from the server's side; the registry has let it go already. */
  close(code: number, reason: string): void {
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
      name: this.#info.file.name,
      key: this.#info.file.key,
      page: this.#info.page.name,
      editorType: this.#info.editorType,
      allowEdits: this.#info.allowEdits,
      visible: this.#info.visible,
      active,
      pluginVersion: this.#info.pluginVersion,
    };
  }

  /** A plugin info event, checked again each time (S-012): one that does not parse is ignored; a tab in front is active. */
  #update(raw: unknown): void {
    const update = zod.safeParse(PluginInfoUpdateSchema, raw);

    if (!update.success) {
      return;
    }

    if (update.data.visible && !this.#info.visible) {
      this.#lastVisible = this.#sequence.next();
    }

    this.#info = { ...update.data, instanceId: this.#info.instanceId };
    this.#sequence.changed();
  }
}

/** The connection behind a session: the registry closes it when the same window says hello again. */
export interface SessionSocket {
  /** One frame to the plugin: the session's RPC. */
  send(text: string): void;
  close(code: number, reason: string): void;
}

/** The registry's sequence: connecting and coming to the front take the next position, so sessions never tie. */
export interface SessionSequence {
  next(): number;
  /** A session's info changed (S-012): the owner's peers hear it (S-033). */
  changed(): void;
}

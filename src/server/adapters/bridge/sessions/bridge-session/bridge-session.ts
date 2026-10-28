import { randomUUID } from "node:crypto";
import type { ConnectedFile, ProbeResult } from "@/core/ports/plugin-link/plugin-link.port.ts";
import { PluginRpc } from "@/server/adapters/bridge/plugin-rpc/plugin-rpc.ts";
import type { SessionSocket } from "@/server/adapters/bridge/sessions/bridge-session/bridge-session.types.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error/pixelwright-error.ts";
import { pingOp } from "@/shared/ops/ping/ping.manifest.ts";
import type { PluginInfo } from "@/shared/protocol/plugin-info.schema.ts";

/**
 * One plugin window past the handshake, one open Figma file (S-011): a random session id, what the window said in its
 * hello, and when it connected and last came to the front, as positions on the registry's sequence, so two sessions
 * never tie.
 */
export class BridgeSession {
  readonly id = randomUUID();
  readonly info: PluginInfo;
  /** The plugin's ops, over this session's socket (A§5.4). */
  readonly rpc: PluginRpc;
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
    this.rpc = new PluginRpc(socket);
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

  /** status probe (T-021): one ping's round trip, rounded to the ms, or why it failed. */
  async probe(): Promise<ProbeResult> {
    const started = performance.now();

    try {
      await this.rpc.run(pingOp, {});

      return {
        ok: true,
        ms: Math.round(performance.now() - started),
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        ms: null,
        error: error instanceof PixelwrightError ? error.text() : String(error),
      };
    }
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

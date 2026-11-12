import { InjectionToken, inject, injectable } from "@needle-di/core";
import pTimeout from "p-timeout";
import type { WebSocket } from "ws";
import { LINK_TEXT, PLUGIN_LINK_ROLE } from "@/core/ports/plugin-link.constants.ts";
import type {
  ConnectedFile,
  OpRequest,
  PairingStatus,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { BRIDGE_SETTINGS } from "@/server/adapters/bridge/bridge.tokens.ts";
import { STATUS_HINTS } from "@/server/adapters/bridge/hints/status-hints.ts";
import { BRIDGE_CONFIG } from "@/server/adapters/bridge/listener/bridge-config.ts";
import type { PeerStatus } from "@/server/adapters/bridge/owner-contract.schema.ts";
import { OwnerClient } from "@/server/adapters/bridge/peer/owner-client.ts";
import {
  PEER_BRIDGE_TEXT,
  PEER_PAIRING_TIMEOUT_MS,
  PEER_SOCKET_EVENT,
  PEER_TIMEOUT_MARGIN_MS,
} from "@/server/adapters/bridge/peer/peer.constants.ts";
import { PeerJoin } from "@/server/adapters/bridge/peer/peer-join.ts";
import { SERVER_GRACE_MS } from "@/server/adapters/bridge/plugin/plugin.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { PEER_JOIN_TIMEOUT_MS } from "@/shared/protocol/peer-handshake.constants.ts";
import { CLOSE_CODE } from "@/shared/protocol/protocol.constants.ts";

const NO_STATUS: PeerStatus = { files: [] };

/**
 * A server whose port another Pixelwright owns (S-030): it joins that owner, shows the owner's files as they change
 * (S-033) and the owner's pairing as each status asks for it (S-020), and relays every op to it, waiting the owner's
 * timer plus 5 s (S-032). Until it has joined, or once the owner is gone, it is unavailable with the close code that
 * says why.
 */
@injectable()
export class PeerBridge implements PluginLink {
  readonly #settings;
  readonly #config;
  readonly #hints;
  #owner: JoinedOwner | null = null;
  #status: PeerStatus = NO_STATUS;
  #closeCode: number | null = null;
  #onLost: (closeCode: number | null) => void = () => undefined;

  constructor(
    settings = inject(BRIDGE_SETTINGS),
    config = inject(BRIDGE_CONFIG),
    hints = inject(STATUS_HINTS),
  ) {
    this.#settings = settings;
    this.#config = config;
    this.#hints = hints;
  }

  /** Joins the owner: true once its first status came, within 3 s (S-031). */
  async start(): Promise<void> {
    const joined = await new PeerJoin(this.#settings.port, this.#config.token()).join();

    if (joined.socket === null) {
      this.#closeCode = joined.closeCode;

      return;
    }

    const socket = joined.socket;
    const owner = { client: new OwnerClient(socket), socket };

    socket.on(PEER_SOCKET_EVENT.error, () => socket.terminate());
    socket.once(PEER_SOCKET_EVENT.close, (code: number) => this.#lost(owner, code));

    try {
      const statuses = await owner.client.status();
      const first = await pTimeout(statuses.next(), { milliseconds: PEER_JOIN_TIMEOUT_MS });

      if (first.done !== true) {
        this.#status = first.value;
        this.#owner = owner;
        this.#closeCode = null;
        void this.#follow(owner, statuses);
      }
    } catch {
      socket.terminate();
    }
  }

  /** Called when the owner goes after the join, with its close code: the bridge then retries. */
  onLost(listener: (closeCode: number | null) => void): void {
    this.#onLost = listener;
  }

  joined(): boolean {
    return this.#owner !== null;
  }

  closeCode(): number | null {
    return this.#closeCode;
  }

  async close(): Promise<void> {
    const owner = this.#owner;

    this.#owner = null;
    owner?.socket.close(CLOSE_CODE.goingAway);
  }

  role(): PluginLinkRole {
    return this.#owner === null ? PLUGIN_LINK_ROLE.unavailable : PLUGIN_LINK_ROLE.peer;
  }

  async state(): Promise<PluginLinkState> {
    const pairing = await this.#pairing();
    const role = this.role();
    const { files } = this.#status;

    return {
      role,
      port: this.#settings.port,
      files,
      pairing,
      hint: this.#hints.hint({
        role,
        port: this.#settings.port,
        failure: null,
        closeCode: this.#closeCode,
        pairing,
        files: files.length,
        rejection: null,
        refusal: null,
      }),
    };
  }

  files(): readonly ConnectedFile[] {
    return this.#status.files;
  }

  request(request: OpRequest): Promise<unknown> {
    const owner = this.#owner;

    if (owner === null) {
      return Promise.reject(new PixelwrightError(ERROR_CODE.pluginNotConnected, LINK_TEXT.notConnected));
    }

    return pTimeout(owner.client.request(request), {
      milliseconds: request.timeoutMs + SERVER_GRACE_MS + PEER_TIMEOUT_MARGIN_MS,
      message: new PixelwrightError(ERROR_CODE.timeout, PEER_BRIDGE_TEXT.timeout(request.op)),
    });
  }

  /** The owner's pairing, asked now: the ask mints its code while a window waits (S-020); none if it does not answer. */
  async #pairing(): Promise<PairingStatus | null> {
    const owner = this.#owner;

    if (owner === null) {
      return null;
    }

    try {
      return await pTimeout(owner.client.pairing(), { milliseconds: PEER_PAIRING_TIMEOUT_MS });
    } catch {
      // The owner went, or a half-open socket keeps quiet: status still answers, without a code.
      return null;
    }
  }

  async #follow(owner: JoinedOwner, statuses: AsyncIterator<PeerStatus>): Promise<void> {
    try {
      for (let next = await statuses.next(); next.done !== true; next = await statuses.next()) {
        this.#status = next.value;
      }
    } catch {
      // The socket's close says why; #lost handles it.
    }

    owner.socket.terminate();
  }

  #lost(owner: JoinedOwner, code: number): void {
    this.#closeCode = code;

    if (this.#owner !== owner) {
      return;
    }

    this.#owner = null;
    this.#status = NO_STATUS;
    this.#onLost(code);
  }
}

export const PEER_BRIDGE = new InjectionToken<PeerBridge>("PeerBridge");

/** The owner a peer joined: its client and its socket; closing the socket ends its status stream. */
export interface JoinedOwner {
  readonly client: OwnerClient;
  readonly socket: WebSocket;
}

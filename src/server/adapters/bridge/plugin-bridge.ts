import { inject, injectable } from "@needle-di/core";
import { PLUGIN_LINK_ROLE } from "@/core/ports/plugin-link.constants.ts";
import type { ConnectedFile, OpRequest, PluginLink, PluginLinkState } from "@/core/ports/plugin-link.port.ts";
import { PEER_RETRY_MS, RETRY_JITTER } from "@/server/adapters/bridge/bridge.constants.ts";
import { BRIDGE_ROLE_HINT } from "@/server/adapters/bridge/hints/hints.constants.ts";
import { OWNER_BRIDGE } from "@/server/adapters/bridge/owner/owner-bridge.ts";
import { OWNER_PEERS } from "@/server/adapters/bridge/owner/owner-peers.ts";
import { PEER_BRIDGE } from "@/server/adapters/bridge/peer/peer-bridge.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { CLOSE_CODE } from "@/shared/protocol/protocol.constants.ts";

type Role =
  | typeof PLUGIN_LINK_ROLE.owner
  | typeof PLUGIN_LINK_ROLE.peer
  | typeof PLUGIN_LINK_ROLE.unavailable
  | typeof PLUGIN_LINK_ROLE.handedOver;

/**
 * The bridge as a State over PluginLink (A§4.1 step 5, S-014, S-030): the port free → the owner; taken → a peer of its
 * owner; neither → unavailable, retrying with jitter until one works; a newer server took the bridge over → handed
 * over, for good, every tool asking for a restart (S-034, X-010). PIXELWRIGHT_PLUGIN_BRIDGE=off binds NoBridge instead.
 */
@injectable()
export class PluginBridge implements PluginLink {
  readonly #owner;
  readonly #peer;
  readonly #peers;
  #role: Role = PLUGIN_LINK_ROLE.unavailable;
  #retry: ReturnType<typeof setTimeout> | undefined;
  #closed = false;
  /** The one retry at once a 4410 earns (memory d9640dee): an owner that keeps saying 4410 cannot spin this. */
  #retriedAtOnce = false;

  constructor(
    owner = inject(OWNER_BRIDGE),
    peer = inject(PEER_BRIDGE),
    peers = inject(OWNER_PEERS),
  ) {
    this.#owner = owner;
    this.#peer = peer;
    this.#peers = peers;
  }

  async start(): Promise<void> {
    this.#peers.onHandover(() => void this.#handOver());
    this.#peer.onLost((closeCode) => {
      this.#role = PLUGIN_LINK_ROLE.unavailable;
      this.#schedule(closeCode);
    });
    await this.#connect();
  }

  async close(): Promise<void> {
    this.#closed = true;
    clearTimeout(this.#retry);
    await this.#peer.close();
    await this.#owner.close();
  }

  state(): PluginLinkState {
    if (this.#role === PLUGIN_LINK_ROLE.owner) {
      return this.#owner.state();
    }

    if (this.#role === PLUGIN_LINK_ROLE.handedOver) {
      return {
        role: PLUGIN_LINK_ROLE.handedOver,
        port: this.#owner.state().port,
        files: [],
        pairing: null,
        hint: BRIDGE_ROLE_HINT.handedOver,
      };
    }

    return this.#peer.state();
  }

  /** A handed-over server's tools say to restart it, not that no file is open (S-034). */
  files(): readonly ConnectedFile[] {
    if (this.#role === PLUGIN_LINK_ROLE.handedOver) {
      throw this.#handedOver();
    }

    return this.#role === PLUGIN_LINK_ROLE.owner ? this.#owner.files() : this.#peer.files();
  }

  request(request: OpRequest): Promise<unknown> {
    if (this.#role === PLUGIN_LINK_ROLE.handedOver) {
      return Promise.reject(this.#handedOver());
    }

    return this.#role === PLUGIN_LINK_ROLE.owner ? this.#owner.request(request) : this.#peer.request(request);
  }

  #handedOver(): PixelwrightError {
    return new PixelwrightError(ERROR_CODE.pluginNotConnected, BRIDGE_ROLE_HINT.handedOver);
  }

  /** The port if it is free, else the owner that holds it; else unavailable, and again later. */
  async #connect(): Promise<void> {
    if (this.#closed) {
      return;
    }

    if (await this.#owner.take()) {
      this.#peers.start();
      this.#role = PLUGIN_LINK_ROLE.owner;

      return;
    }

    await this.#peer.start();

    if (this.#peer.joined()) {
      this.#role = PLUGIN_LINK_ROLE.peer;
    } else {
      this.#role = PLUGIN_LINK_ROLE.unavailable;
      this.#schedule(this.#peer.closeCode());
    }
  }

  /** Once at once after a 4410: the old owner freed the port for this newer server; otherwise after a jittered second. */
  #schedule(closeCode: number | null): void {
    if (this.#closed || this.#role === PLUGIN_LINK_ROLE.handedOver) {
      return;
    }

    const atOnce = closeCode === CLOSE_CODE.handedOver && !this.#retriedAtOnce;
    const delay = atOnce ? 0 : PEER_RETRY_MS * (RETRY_JITTER.low + Math.random() * RETRY_JITTER.span);

    this.#retriedAtOnce = atOnce;

    clearTimeout(this.#retry);
    this.#retry = setTimeout(() => void this.#connect(), delay);
    this.#retry.unref();
  }

  /** A newer server proved the token: free the port for it, close everyone 1001, and stay off (S-034). */
  async #handOver(): Promise<void> {
    this.#role = PLUGIN_LINK_ROLE.handedOver;
    clearTimeout(this.#retry);
    await this.#owner.close();
  }
}

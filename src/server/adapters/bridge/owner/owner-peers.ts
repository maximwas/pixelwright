import { InjectionToken, inject, injectable } from "@needle-di/core";
import { RPCHandler } from "@orpc/server/ws";
import { BRIDGE_CONFIG } from "@/server/adapters/bridge/listener/bridge-config.ts";
import { BRIDGE_LISTENER } from "@/server/adapters/bridge/listener/bridge-listener.ts";
import { OWNER_ROUTER } from "@/server/adapters/bridge/owner/owner-router.ts";
import { PeerConnection } from "@/server/adapters/bridge/owner/peer-connection.ts";

/**
 * The owner's peers (S-030): each socket on the peer path runs the peer handshake, then is served the owner's contract.
 * A newer peer that proved the token makes the owner hand the bridge over (S-034).
 */
@injectable()
export class OwnerPeers {
  readonly #listener;
  readonly #config;
  readonly #router;
  #onHandover: () => void = () => undefined;
  #started = false;

  constructor(
    listener = inject(BRIDGE_LISTENER),
    config = inject(BRIDGE_CONFIG),
    router = inject(OWNER_ROUTER),
  ) {
    this.#listener = listener;
    this.#config = config;
    this.#router = router;
  }

  /** Once, the first time this server owns the port. */
  start(): void {
    if (this.#started) {
      return;
    }

    this.#started = true;
    this.#router.start();

    const handler = new RPCHandler(this.#router.router());

    this.#listener.onPeer((socket) =>
      new PeerConnection(socket, {
        token: () => this.#config.token(),
        serve: (served) => void handler.upgrade(served),
        handOver: () => this.#onHandover(),
      }).start(),
    );
  }

  onHandover(listener: () => void): void {
    this.#onHandover = listener;
  }
}

export const OWNER_PEERS = new InjectionToken<OwnerPeers>("OwnerPeers");

import { InjectionToken, inject, injectable } from "@needle-di/core";
import { EventPublisher, implement, ORPCError } from "@orpc/server";
import type { OpRequest } from "@/core/ports/plugin-link.port.ts";
import { OWNER_ROUTER_EVENT } from "@/server/adapters/bridge/owner/owner.constants.ts";
import { OWNER_BRIDGE } from "@/server/adapters/bridge/owner/owner-bridge.ts";
import { OWNER_CONTRACT, type PeerStatus } from "@/server/adapters/bridge/owner-contract.schema.ts";
import { SESSION_REGISTRY } from "@/server/adapters/bridge/sessions/session-registry.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/**
 * The owner's side of OWNER_CONTRACT (A§5.3): a peer's request runs on that session's plugin like the owner's own,
 * its PixelwrightError crossing as an ORPCError with the same code; status pushes the owner's files at once and on
 * every change of the session registry (S-033); pairing is the registry's, minted by a peer's status asking (S-020).
 */
@injectable()
export class OwnerRouter {
  readonly #owner;
  readonly #sessions;
  readonly #changes = new EventPublisher<{ [OWNER_ROUTER_EVENT.status]: PeerStatus }>();

  constructor(owner = inject(OWNER_BRIDGE), sessions = inject(SESSION_REGISTRY)) {
    this.#owner = owner;
    this.#sessions = sessions;
  }

  start(): void {
    this.#sessions.onChange(() => this.#changes.publish(OWNER_ROUTER_EVENT.status, this.#snapshot()));
  }

  router() {
    const procedures = implement(OWNER_CONTRACT);

    return {
      request: procedures.request.handler(({ input }) => this.#request(input)),
      status: procedures.status.handler(({ signal }) => this.statuses(signal)),
      pairing: procedures.pairing.handler(() => this.#sessions.pairing()),
    };
  }

  /** The status now, then one on every change until the peer goes. */
  async *statuses(signal?: AbortSignal): AsyncGenerator<PeerStatus> {
    // Subscribed before the first snapshot, so a change in between is not lost.
    const changes = this.#changes.subscribe(OWNER_ROUTER_EVENT.status, { signal });

    yield this.#snapshot();
    yield* changes;
  }

  async #request(request: OpRequest): Promise<unknown> {
    try {
      return await this.#owner.request(request);
    } catch (error) {
      throw error instanceof PixelwrightError ? new ORPCError(error.code, { message: error.message }) : error;
    }
  }

  #snapshot(): PeerStatus {
    return { files: [...this.#sessions.files()] };
  }
}

export const OWNER_ROUTER = new InjectionToken<OwnerRouter>("OwnerRouter");

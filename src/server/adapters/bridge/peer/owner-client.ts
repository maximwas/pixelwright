import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/websocket";
import type { ContractRouterClient } from "@orpc/contract";
import type { WebSocket } from "ws";
import * as zod from "zod/mini";
import type { OpRequest } from "@/core/ports/plugin-link.port.ts";
import type { OWNER_CONTRACT, PeerStatus } from "@/server/adapters/bridge/owner-contract.schema.ts";
import { OWNER_CLIENT_TEXT } from "@/server/adapters/bridge/peer/peer.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/**
 * The peer's client of OWNER_CONTRACT over the joined socket (A§5.3): a request comes back as the owner's envelope, an
 * error as a PixelwrightError with the owner's code (S-032); a socket lost mid-call leaves the outcome unknown.
 */
export class OwnerClient {
  readonly #client: ContractRouterClient<typeof OWNER_CONTRACT>;

  constructor(socket: WebSocket) {
    // ws gives the browser's addEventListener, removeEventListener, send and readyState: all RPCLink uses.
    this.#client = createORPCClient(new RPCLink({ websocket: socket as BrowserSocket }));
  }

  async request(request: OpRequest): Promise<unknown> {
    try {
      return await this.#client.request(request);
    } catch (error) {
      throw this.#failure(error);
    }
  }

  /** The owner's status now, then on every change; ends with the socket (an abort would be sent on it). */
  status(): Promise<AsyncIterator<PeerStatus>> {
    return this.#client.status(undefined);
  }

  #failure(error: unknown): PixelwrightError {
    if (!(error instanceof ORPCError)) {
      return new PixelwrightError(ERROR_CODE.pluginDisconnected, OWNER_CLIENT_TEXT.ownerGone);
    }

    const code = zod.safeParse(zod.enum(ERROR_CODE), error.code);

    return new PixelwrightError(code.success ? code.data : ERROR_CODE.opFailed, error.message);
  }
}

/** The part of a browser WebSocket oRPC's RPCLink uses. */
type BrowserSocket = Pick<globalThis.WebSocket, "addEventListener" | "removeEventListener" | "send" | "readyState">;

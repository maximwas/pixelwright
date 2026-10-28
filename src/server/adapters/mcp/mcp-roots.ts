import type { Server } from "@modelcontextprotocol/server";
import { InjectionToken, injectable } from "@needle-di/core";
import type { ClientRoots } from "@/core/ports/client-roots.port.ts";
import { MCP_ROOTS_ASK } from "@/server/adapters/mcp/mcp.constants.ts";

/**
 * Adapter: the MCP client's roots (T-008), asked of the client the endpoint connected, once (5 s at most) and again
 * after notifications/roots/list_changed. A client without the roots capability, or one that fails or does not answer
 * in time, lists none, and the project folder falls back.
 */
@injectable()
export class McpRoots implements ClientRoots {
  #server: Server | undefined;
  #uris: Promise<readonly string[]> | undefined;

  /** The endpoint hands over its SDK server when it connects; roots are asked of that client from then on. */
  attach(server: Server): void {
    this.#server = server;
    this.#uris = undefined;
    server.setNotificationHandler(MCP_ROOTS_ASK.changed, () => {
      this.#uris = undefined;
    });
  }

  uris(): Promise<readonly string[]> {
    this.#uris ??= this.#asked();

    return this.#uris;
  }

  async #asked(): Promise<readonly string[]> {
    const server = this.#server;

    if (server?.getClientCapabilities()?.roots === undefined) {
      return [];
    }

    try {
      const { roots } = await server.listRoots(undefined, { timeout: MCP_ROOTS_ASK.timeoutMs });

      return roots.map(({ uri }) => uri);
    } catch {
      // shortcut: a client on the 2026-07-28 protocol refuses roots/list (SEP-2577) and gets the fallback; ask through
      // input_required when such clients are common.
      return [];
    }
  }
}

export const MCP_ROOTS = new InjectionToken<McpRoots>("McpRoots");

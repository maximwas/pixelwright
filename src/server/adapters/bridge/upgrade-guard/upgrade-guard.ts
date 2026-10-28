import type { IncomingHttpHeaders } from "node:http";
import { inject, injectable } from "@needle-di/core";
import { BRIDGE_SETTINGS } from "../bridge.tokens.ts";
import { LOOPBACK_HOSTS, PLUGIN_ORIGINS, UPGRADE_PATHS } from "./upgrade-guard.constants.ts";
import type { UpgradeRejection, UpgradeRequest, UpgradeRole, UpgradeVerdict } from "./upgrade-guard.types.ts";

/**
 * Decides a WebSocket upgrade (S-002). Every upgrade must name this server's own Host, the DNS-rebinding guard. The
 * plugin's window comes with an allowed Origin, the cross-site hijacking guard; another Pixelwright server joins on the
 * peer path with no Origin at all, which no browser page can send, and proves the token afterwards. Another path is 404.
 */
@injectable()
export class UpgradeGuard {
  readonly #settings;

  constructor(settings = inject(BRIDGE_SETTINGS)) {
    this.#settings = settings;
  }

  /** The verdict for a request to the bridge listening on port. */
  check(
    request: UpgradeRequest,
    port: number,
  ): UpgradeVerdict {
    const path = (request.url ?? "").split("?")[0];
    const role = UPGRADE_PATHS.find((entry) => entry.path === path)?.role;

    if (role === undefined) {
      return { status: 404 };
    }

    const reason = this.#refusal(request.headers, role, port);

    return reason === null
      ? {
        status: 101,
        role,
      }
      : {
        status: 403,
        role,
        rejection: {
          reason,
          origin: request.headers.origin ?? null,
        },
      };
  }

  #refusal(
    { host, origin }: IncomingHttpHeaders,
    role: UpgradeRole,
    port: number,
  ): UpgradeRejection["reason"] | null {
    if (!LOOPBACK_HOSTS.some((name) => host?.toLowerCase() === `${name}:${port}`)) {
      return "host";
    }

    if (role === "peer") {
      return origin === undefined ? null : "origin";
    }

    return origin !== undefined && [...PLUGIN_ORIGINS, ...this.#settings.pluginOrigins].includes(origin)
      ? null
      : "origin";
  }
}

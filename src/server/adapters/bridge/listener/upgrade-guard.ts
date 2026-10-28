import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import { BRIDGE_SETTINGS } from "@/server/adapters/bridge/bridge.tokens.ts";
import {
  LOOPBACK_HOSTS,
  PLUGIN_ORIGINS,
  UPGRADE_PATHS,
  UPGRADE_REFUSAL,
  UPGRADE_ROLE,
  UPGRADE_URL,
} from "@/server/adapters/bridge/listener/listener.constants.ts";

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
  check(request: UpgradeRequest, port: number): UpgradeVerdict {
    const path = (request.url ?? "").split(UPGRADE_URL.queryStart)[0];
    const role = UPGRADE_PATHS.find((entry) => entry.path === path)?.role;

    if (role === undefined) {
      return { status: 404 };
    }

    const reason = this.#refusal(request.headers, role, port);

    return reason === null
      ? { status: 101, role }
      : { status: 403, role, rejection: { reason, origin: request.headers.origin ?? null } };
  }

  #refusal(
    { host, origin }: IncomingHttpHeaders,
    role: UpgradeRole,
    port: number,
  ): UpgradeRefusal | null {
    if (!LOOPBACK_HOSTS.some((name) => host?.toLowerCase() === UPGRADE_URL.host(name, port))) {
      return UPGRADE_REFUSAL.host;
    }

    if (role === UPGRADE_ROLE.peer) {
      return origin === undefined ? null : UPGRADE_REFUSAL.origin;
    }

    return origin !== undefined && [...PLUGIN_ORIGINS, ...this.#settings.pluginOrigins].includes(origin)
      ? null
      : UPGRADE_REFUSAL.origin;
  }
}

export const UPGRADE_GUARD = new InjectionToken<UpgradeGuard>("UpgradeGuard");

/** Who upgrades: the plugin's window, or another Pixelwright server joining the owner. */
export type UpgradeRole = (typeof UPGRADE_ROLE)[keyof typeof UPGRADE_ROLE];

/** Which check refused an upgrade. */
export type UpgradeRefusal = (typeof UPGRADE_REFUSAL)[keyof typeof UPGRADE_REFUSAL];

export type UpgradeRequest = Pick<IncomingMessage, "url" | "headers">;

/** A refused upgrade, kept for the status hint: which check failed and the Origin it came with. */
export interface UpgradeRejection {
  readonly reason: UpgradeRefusal;
  readonly origin: string | null;
}

export type UpgradeVerdict =
  | { readonly status: 404 }
  | { readonly status: 101; readonly role: UpgradeRole }
  | { readonly status: 403; readonly role: UpgradeRole; readonly rejection: UpgradeRejection };

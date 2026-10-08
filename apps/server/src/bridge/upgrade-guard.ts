import { type IncomingHttpHeaders, type IncomingMessage, STATUS_CODES } from "node:http";
import type { Duplex } from "node:stream";
import { BRIDGE_TOKEN_HEADER, UPGRADE_ROLES } from "../constants/bridge.ts";
import type { UpgradePolicy, UpgradeRejection, UpgradeRole, UpgradeVerdict } from "../types/bridge.ts";
import { tokenEquals } from "../utils/crypto.ts";

/**
 * Decides a WebSocket upgrade. The plugin's UI iframe comes with one of the plugin origins; another pixelwright process
 * joins on PEER_PATH with no Origin at all, which no browser page can send, and with bridge.json's token. Every upgrade
 * needs this server's own Host. Another path is 404; anything else 403.
 */
export function checkUpgrade(request: Pick<IncomingMessage, "url" | "headers">, policy: UpgradePolicy): UpgradeVerdict {
  const role = UPGRADE_ROLES[(request.url ?? "").split("?")[0] ?? ""];

  if (role === undefined) {
    return { status: 404 };
  }

  const reason = rejectionReason(request.headers, policy, role);

  if (reason === null) {
    return {
      status: 101,
      role,
    };
  }

  return {
    status: 403,
    role,
    rejection: {
      reason,
      origin: request.headers.origin ?? null,
    },
  };
}

function rejectionReason(
  headers: IncomingHttpHeaders,
  policy: UpgradePolicy,
  role: UpgradeRole,
): UpgradeRejection["reason"] | null {
  const host = headers.host?.toLowerCase();

  if (host === undefined || !policy.allowedHosts.has(host)) {
    return "host"; // DNS-rebinding guard
  }

  if (role === "peer") {
    if (headers.origin !== undefined) {
      return "origin"; // a browser always sends Origin, so a page can never pass for a peer
    }

    const token = headers[BRIDGE_TOKEN_HEADER];

    return typeof token === "string" && tokenEquals(token, policy.token) ? null : "token";
  }

  // Cross-site WebSocket hijacking guard: only the plugin's iframe origins.
  return headers.origin !== undefined && policy.pluginOrigins.has(headers.origin) ? null : "origin";
}

/** Answers a refused upgrade with a plain HTTP error and closes the socket. */
export function rejectUpgrade(socket: Duplex, status: number): void {
  const body = STATUS_CODES[status] ?? "Error";

  socket.once("finish", () => socket.destroy());
  socket.end(
    `HTTP/1.1 ${status} ${body}\r\nConnection: close\r\nContent-Type: text/plain\r\n` +
      `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
  );
}

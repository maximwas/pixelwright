import { BRIDGE_PROTOCOL_VERSION } from "@pixelwright/core";
import { describeError } from "../mcp/describe-error.ts";
import type { BridgeView, StatusOutput } from "../types/mcp.ts";

export async function readStatus(bridge: BridgeView, version: string, probe: boolean): Promise<StatusOutput> {
  const { role, port, hint } = bridge.status();
  const files = bridge.plugins().map(({ session, info, active }) => ({
    session,
    name: info.file.name,
    key: info.file.key,
    page: info.page.name,
    editorType: info.editorType,
    allowEdits: info.allowEdits,
    active,
    pluginVersion: info.pluginVersion,
  }));

  const pairing = bridge.pairing();

  return {
    server: {
      version,
      role,
      protocol: BRIDGE_PROTOCOL_VERSION,
      port,
    },
    files,
    probe: probe ? await ping(bridge) : null,
    pairing:
      pairing === null
        ? null
        : {
            code: pairing.code,
            expiresInSeconds: secondsUntil(pairing.expiresAt),
            lockedForSeconds: secondsUntil(pairing.lockedUntil),
            waiting: pairing.waiting,
          },
    hint,
  };
}

async function ping(bridge: BridgeView): Promise<StatusOutput["probe"]> {
  const started = performance.now();

  try {
    await bridge.request("ping", null);

    return {
      ok: true,
      ms: Math.round(performance.now() - started),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      ms: null,
      error: describeError(error),
    };
  }
}

/** Whole seconds until a moment, or null for none. */
function secondsUntil(at: number | null): number | null {
  return at === null ? null : Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

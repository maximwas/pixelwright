import { BRIDGE_PROTOCOL_VERSION } from "@pixelwright/core";
import { describeError } from "../../plugin/describe-error.ts";
import type { BridgeView, StatusOutput } from "../../types/mcp.ts";

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
  const keyless = files.filter(({ key }) => key === null).map(({ name }) => name);

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
    ...(keyless.length === 0 ? {} : { note: keylessNote(keyless) }),
  };
}

/** Why the files have no key (figma.fileKey is for private plugins only), and where an agent takes it from. */
function keylessNote(names: readonly string[]): string {
  return `Figma gives the file key only to private organization plugins, so ${names.join(", ")} has key null: to make a figma.com link to the file or a layer, ask the user for the file's link (Share, Copy link) and take the key from it (figma.com/design/<key>/…).`;
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

import type { Logger } from "@/core/ports/logger.port.ts";
import type { BridgeConfig, PluginKey } from "@/server/adapters/bridge/listener/bridge-config.ts";
import type { PairingCodes } from "@/server/adapters/bridge/plugin/pairing-codes.ts";
import type { CONNECTION_STATE } from "@/server/adapters/bridge/plugin/plugin.constants.ts";
import type { BridgeSession } from "@/server/adapters/bridge/sessions/bridge-session.ts";
import type { SessionRegistry } from "@/server/adapters/bridge/sessions/session-registry.ts";
import type { PluginInfo } from "@/shared/protocol/plugin-info.schema.ts";

/** The owner's services one connection works with; PluginConnections hands the same ones to each. */
export interface HandshakeServices {
  /** bridge.json's paired keys. */
  readonly keys: BridgeConfig;
  readonly pairing: PairingCodes;
  readonly sessions: SessionRegistry;
  readonly logger: Logger;
}

/** Where a connection stands: its one state field. */
export type ConnectionState =
  | { readonly name: typeof CONNECTION_STATE.hello }
  | {
    readonly name: typeof CONNECTION_STATE.challenged;
    readonly info: PluginInfo;
    readonly key: PluginKey;
    readonly pluginNonce: string;
    readonly serverNonce: string;
  }
  | { readonly name: typeof CONNECTION_STATE.pairing; readonly info: PluginInfo }
  | { readonly name: typeof CONNECTION_STATE.session; readonly session: BridgeSession }
  | { readonly name: typeof CONNECTION_STATE.closed };

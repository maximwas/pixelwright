import type { Logger } from "../../../../core/ports/logger/logger.port.ts";
import type { PluginInfo } from "../../../../shared/protocol/plugin-info.schema.ts";
import type { BridgeConfig } from "../bridge-config/bridge-config.ts";
import type { PluginKey } from "../bridge-config/bridge-config.types.ts";
import type { PairingCodes } from "../pairing-codes/pairing-codes.ts";
import type { BridgeSession } from "../sessions/bridge-session/bridge-session.ts";
import type { SessionRegistry } from "../sessions/session-registry/session-registry.ts";
import type { CONNECTION_STATE } from "./plugin-connection.constants.ts";

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
  | {
    readonly name: typeof CONNECTION_STATE.pairing;
    readonly info: PluginInfo;
  }
  | {
    readonly name: typeof CONNECTION_STATE.session;
    readonly session: BridgeSession;
  }
  | { readonly name: typeof CONNECTION_STATE.closed };

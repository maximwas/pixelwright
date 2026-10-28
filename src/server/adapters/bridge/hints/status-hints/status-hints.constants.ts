import { BridgeRoleHint } from "@/server/adapters/bridge/hints/bridge-role-hint/bridge-role-hint.ts";
import { ConnectedHint } from "@/server/adapters/bridge/hints/connected-hint/connected-hint.ts";
import { NoFileHint } from "@/server/adapters/bridge/hints/no-file-hint/no-file-hint.ts";
import { PairingCodeHint } from "@/server/adapters/bridge/hints/pairing-code-hint/pairing-code-hint.ts";
import { PairingLockHint } from "@/server/adapters/bridge/hints/pairing-lock-hint/pairing-lock-hint.ts";
import { ProtocolRefusalHint } from "@/server/adapters/bridge/hints/protocol-refusal-hint/protocol-refusal-hint.ts";
import { RejectionHint } from "@/server/adapters/bridge/hints/rejection-hint/rejection-hint.ts";
import type { StatusHint } from "@/server/adapters/bridge/hints/status-hints/status-hints.types.ts";

/**
 * The hint table's rows in priority order (S-035): bridge state > pairing code > pairing pause > connected (no hint) >
 * plugin of another protocol > refused connection > no file. A code beats a connected file, so a second file's window
 * still gets paired; a plugin turned away for its protocol is surely ours, a refused connection maybe a stranger.
 */
export const STATUS_HINT_ORDER: readonly (new () => StatusHint)[] = [
  BridgeRoleHint,
  PairingCodeHint,
  PairingLockHint,
  ConnectedHint,
  ProtocolRefusalHint,
  RejectionHint,
  NoFileHint,
];

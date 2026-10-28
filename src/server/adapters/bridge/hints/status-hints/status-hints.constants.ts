import { BridgeRoleHint } from "../bridge-role-hint/bridge-role-hint.ts";
import { ConnectedHint } from "../connected-hint/connected-hint.ts";
import { NoFileHint } from "../no-file-hint/no-file-hint.ts";
import { PairingCodeHint } from "../pairing-code-hint/pairing-code-hint.ts";
import { PairingLockHint } from "../pairing-lock-hint/pairing-lock-hint.ts";
import { ProtocolRefusalHint } from "../protocol-refusal-hint/protocol-refusal-hint.ts";
import { RejectionHint } from "../rejection-hint/rejection-hint.ts";
import type { StatusHint } from "./status-hints.types.ts";

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

import { InjectionToken } from "@needle-di/core";
import type { PLUGIN_LINK_ROLES } from "@/core/ports/plugin-link.constants.ts";
import type { OpName } from "@/shared/ops/op-meta.types.ts";

export type PluginLinkRole = (typeof PLUGIN_LINK_ROLES)[number];

/** While an unpaired plugin waits: the code the user types into its window, or how long pairing is paused. */
export interface PairingStatus {
  /** null while pairing is paused after too many wrong codes. */
  readonly code: string | null;
  readonly expiresInSeconds: number | null;
  readonly lockedForSeconds: number | null;
  /** Unpaired plugin windows waiting for the code. */
  readonly waiting: number;
}

/** A Figma file whose plugin finished the handshake, as status lists it. */
export interface ConnectedFile {
  readonly session: string;
  readonly name: string;
  readonly key: string | null;
  readonly page: string;
  readonly editorType: string;
  readonly allowEdits: boolean;
  /** Its tab is Figma's visible one: a background tab's plugin is slowed (FX-010). */
  readonly visible: boolean;
  /** The file a tool uses when it names none: its window came to the front last, else it connected last (S-011). */
  readonly active: boolean;
  readonly pluginVersion: string;
}

/** status probe's answer (T-021): the active file's plugin answered a ping in `ms`, or why it did not. */
export interface ProbeResult {
  readonly ok: boolean;
  readonly ms: number | null;
  readonly error: string | null;
}

/** Where this server stands with the Figma plugins, as status shows it. */
export interface PluginLinkState {
  readonly role: PluginLinkRole;
  readonly port: number;
  readonly files: readonly ConnectedFile[];
  /** Asking for the state is what mints a pairing code while a plugin waits (S-020): only status asks. */
  readonly pairing: PairingStatus | null;
  /** What the user should do; null when a file is connected and nothing is wrong. */
  readonly hint: string | null;
}

/** One op for one session's plugin (S-009): its resolved timeout is the deadline the link keeps. */
export interface OpRequest {
  readonly session: string;
  readonly op: OpName;
  readonly input: unknown;
  readonly timeoutMs: number;
}

/** This server's way to the Figma plugins: status reads its state, a plugin session sends its ops through it. */
export interface PluginLink {
  /** Takes the bridge up; a bridge that cannot start says why in its state instead of throwing. */
  start(): Promise<void>;
  /** Frees the port first, so another server can take it at once (S-013). */
  close(): Promise<void>;
  state(): PluginLinkState;
  /** The connected files, without minting a pairing code: what target resolution reads (T-001). */
  files(): readonly ConnectedFile[];
  /** The plugin's raw answer (an envelope, unparsed); a session that is gone fails FILE_NOT_FOUND (S-042). */
  request(request: OpRequest): Promise<unknown>;
}

export const PLUGIN_LINK = new InjectionToken<PluginLink>("PluginLink");

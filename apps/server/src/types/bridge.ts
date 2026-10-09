import type { BridgeError, PluginInfo, PluginKey, PluginToServer } from "@pixelwright/core";
import type { WebSocket } from "ws";
import type * as z from "zod";
import type { PendingRequests } from "../bridge/pending-requests.ts";
import type { BridgeConfigSchema } from "../schemas/bridge.ts";
import type { OwnerToPeerSchema, PeerToOwnerSchema } from "../schemas/peer.ts";

export type BridgeConfig = z.infer<typeof BridgeConfigSchema>;

export interface BridgeConfigOptions {
  /** Where PIXELWRIGHT_HOME and PIXELWRIGHT_BRIDGE_PORT come from; default process.env. */
  readonly env?: Record<string, string | undefined>;
  /** Receives problems that do not stop the bridge; default console.warn. */
  readonly warn?: (message: string) => void;
}

export type BridgeLog = (message: string, data?: Record<string, unknown>) => void;

export type ResponseMessage = Extract<PluginToServer, { type: "response" }>;

export interface PendingRequest {
  readonly op: string;
  readonly resolve: (result: unknown) => void;
  readonly reject: (error: BridgeError) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/** A plugin that said hello: one per open Figma file (per plugin window). */
export interface PluginSession {
  readonly id: string;
  readonly socket: WebSocket;
  readonly pending: PendingRequests;
  /** When it connected, on the server's own sequence. */
  readonly connected: number;
  info: PluginInfo;
  /** When its window last came to the front, on the same sequence; 0: never. */
  lastVisible: number;
}

/** A connected plugin as tools and peers see it. */
export interface ConnectedPlugin {
  readonly session: string;
  readonly info: PluginInfo;
  readonly active: boolean;
}

export interface RequestOptions {
  /** The plugin session to ask; without it, the active one. */
  readonly session?: string;
}

/** How this process reaches the plugins: as the bridge's owner (BridgeServer) or through the owner (OwnerClient). */
export interface PluginLink {
  request(op: string, input: unknown, options?: RequestOptions): Promise<unknown>;
  plugins(): readonly ConnectedPlugin[];
  /** The pairing code to show while an unpaired plugin waits; null while none waits. */
  pairing(): PairingStatus | null;
}

export interface BridgeServerOptions {
  readonly port: number; // 0 = ephemeral (tests)
  readonly token: string; // from bridge.json; peers prove it by challenge-response
  readonly pluginOrigins: readonly string[];
  readonly serverVersion: string;
  readonly requestTimeoutMs?: number; // tests
  readonly log?: BridgeLog;
  /** Paired plugins' keys (bridge.json in production). */
  readonly keys: PluginKeys;
  /** The pairing code in force; tests pass predictable codes. */
  readonly pairing?: PairingCodesLike;
  /** How long an unpaired plugin may wait for the code (default: a code's lifetime); tests pass less. */
  readonly pendingTimeoutMs?: number;
}

/** What the bridge needs from PairingCodes. */
export interface PairingCodesLike {
  now(): number;
  active(): ActiveCode | null;
  /** The code in force, made if there is none; null while pairing is locked. */
  ensure(): ActiveCode | null;
  lockedUntil(): number | null;
  check(code: string): CodeCheck;
}

/** For status: the code to show while an unpaired plugin waits, never anything about that plugin but the count. */
export interface PairingStatus {
  /** The code to type, or null while pairing is locked after too many wrong codes. */
  readonly code: string | null;
  readonly expiresAt: number | null;
  readonly lockedUntil: number | null;
  readonly waiting: number;
}

export interface PluginConnectionOptions {
  readonly serverVersion: string;
  readonly log: BridgeLog;
  /** The server's sequence: orders connections and windows coming to the front. */
  readonly next: () => number;
  /** Whether a plugin that proved its key or typed the code may become a session (the cap on sessions). */
  readonly admit: (info: PluginInfo) => boolean;
  readonly keys: PluginKeys;
  /** The pairing code in force, never made here (only status makes codes), and the end of a lock. */
  readonly activeCode: () => ActiveCode | null;
  readonly lockedUntil: () => number | null;
  readonly checkCode: (code: string) => CodeCheck;
  readonly now: () => number;
  readonly pendingTimeoutMs: number;
  /** An unpaired plugin starts waiting for the code; false: too many wait already. */
  readonly onPending: (connection: unknown) => boolean;
  /** It stopped waiting: paired, or gone. */
  readonly onPendingEnded: (connection: unknown) => void;
  /** The plugin said hello: the connection is a session now. */
  readonly onSession: (session: PluginSession) => void;
  /** The plugin sent new info: file, page, visibility or Allow edits. */
  readonly onInfo: (session: PluginSession) => void;
  /** A session's socket closed; its pending requests have failed already. */
  readonly onSessionClosed: (session: PluginSession, code: number) => void;
}

/** Why an upgrade was refused. The origin is safe to surface; the token never is. */
export interface UpgradeRejection {
  readonly reason: "host" | "origin";
  readonly origin: string | null;
}

export interface UpgradePolicy {
  readonly allowedHosts: ReadonlySet<string>;
  readonly pluginOrigins: ReadonlySet<string>;
}

/** Who is upgrading: a plugin's UI iframe, or another pixelwright process. */
export type UpgradeRole = "plugin" | "peer";

export type UpgradeVerdict =
  | { readonly status: 101; readonly role: UpgradeRole }
  | { readonly status: 404 }
  | { readonly status: 403; readonly role: UpgradeRole; readonly rejection: UpgradeRejection };

export type PeerToOwner = z.infer<typeof PeerToOwnerSchema>;

export type OwnerToPeer = z.infer<typeof OwnerToPeerSchema>;

export interface OwnerClientOptions {
  readonly port: number;
  readonly token: string;
  readonly log: BridgeLog;
}

export interface PeerConnectionOptions {
  readonly log: BridgeLog;
  /** Hands a peer's operation to a plugin. */
  readonly relay: (op: string, input: unknown, options: RequestOptions) => Promise<unknown>;
  readonly plugins: () => readonly ConnectedPlugin[];
  readonly onClose: () => void;
  /** bridge.json's token, which owner and peer prove to each other. */
  readonly token: string;
  readonly pairing: () => PairingStatus | null;
}

/** Where this process stands with the bridge port. */
export type BridgeState =
  | { readonly kind: "owner" }
  | { readonly kind: "peer" }
  | { readonly kind: "unavailable"; readonly closeCode: number | null }
  | { readonly kind: "failed"; readonly reason: string }
  | { readonly kind: "disabled" };

export type BridgeRole = BridgeState["kind"];

export interface BridgeStatus {
  readonly role: BridgeRole;
  readonly port: number;
  /** What the user should do; null when a file is connected and nothing is wrong. */
  readonly hint: string | null;
}

/** The keys of paired plugins (FilePluginKeys keeps them in bridge.json). */
export interface PluginKeys {
  find(id: string): PluginKey | null;
  add(): PluginKey;
}

/** The pairing code in force: what the user types, until when, and how many wrong tries are left. */
export interface ActiveCode {
  readonly code: string;
  readonly expiresAt: number;
  readonly attemptsLeft: number;
}

export type CodeCheck =
  | { readonly outcome: "ok" }
  | { readonly outcome: "wrong"; readonly attemptsLeft: number }
  | { readonly outcome: "expired" }
  | { readonly outcome: "locked"; readonly until: number };

export interface PairingCodesOptions {
  readonly now?: () => number;
  readonly randomDigits?: () => string;
  readonly ttlMs?: number;
  readonly attempts?: number;
  readonly cooldownMs?: number;
  readonly maxCooldownMs?: number;
}

/** What bridgeHint weighs, most urgent first. */
export interface HintInput {
  readonly state: BridgeState;
  readonly connectedFiles: number;
  readonly pairing: PairingStatus | null;
  readonly rejection: UpgradeRejection | null;
  readonly port: number;
  readonly now: number;
}

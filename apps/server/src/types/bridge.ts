import type { BridgeError, PluginInfo, PluginToServer } from "@pixelwright/core";
import type { WebSocket } from "ws";
import type * as z from "zod";
import type { PendingRequests } from "../bridge/pending-requests.ts";
import type { BridgeConfigSchema } from "../schemas/bridge.ts";

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
}

export interface BridgeServerOptions {
  readonly port: number; // 0 = ephemeral (tests)
  readonly token: string; // from bridge.json; peers send it in the x-pixelwright-token upgrade header
  readonly pluginOrigins: readonly string[];
  readonly serverVersion: string;
  readonly requestTimeoutMs?: number; // tests
  readonly log?: BridgeLog;
}

export interface PluginConnectionOptions {
  readonly serverVersion: string;
  readonly log: BridgeLog;
  /** The server's sequence: orders connections and windows coming to the front. */
  readonly next: () => number;
  /** The plugin said hello: the connection is a session now. */
  readonly onSession: (session: PluginSession) => void;
  /** The plugin sent new info: file, page, visibility or Allow edits. */
  readonly onInfo: (session: PluginSession) => void;
  /** A session's socket closed; its pending requests have failed already. */
  readonly onSessionClosed: (session: PluginSession, code: number) => void;
}

/** Why an upgrade was refused. The origin is safe to surface; the token never is. */
export interface UpgradeRejection {
  readonly reason: "host" | "origin" | "token";
  readonly origin: string | null;
}

export interface UpgradePolicy {
  readonly allowedHosts: ReadonlySet<string>;
  readonly pluginOrigins: ReadonlySet<string>;
  readonly token: string;
}

/** Who is upgrading: a plugin's UI iframe, or another pixelwright process. */
export type UpgradeRole = "plugin" | "peer";

export type UpgradeVerdict =
  | { readonly status: 101; readonly role: UpgradeRole }
  | { readonly status: 404 }
  | { readonly status: 403; readonly role: UpgradeRole; readonly rejection: UpgradeRejection };

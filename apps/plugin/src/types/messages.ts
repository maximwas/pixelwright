import type { EventHandler } from "@create-figma-plugin/utilities";
import type { PluginKey } from "@pixelwright/core";
import type { RequestOutcome } from "./link.ts";

/**
 * What only the main code knows: sent when the window is ready and on every change. A type alias, so it stays a plain
 * serializable record.
 */
export type PluginContext = {
  readonly pluginVersion: string;
  readonly editorType: string;
  readonly file: { readonly name: string; readonly key: string | null };
  readonly page: { readonly id: string; readonly name: string };
  readonly allowEdits: boolean;
};

/** The window loaded and listens: the main code answers with the context. */
export interface ReadyHandler extends EventHandler {
  name: "READY";
  handler: () => void;
}

export interface ContextHandler extends EventHandler {
  name: "CONTEXT";
  handler: (context: PluginContext) => void;
}

export interface RequestHandler extends EventHandler {
  name: "REQUEST";
  handler: (id: string, op: string, input: unknown) => void;
}

export interface ResponseHandler extends EventHandler {
  name: "RESPONSE";
  handler: (id: string, outcome: RequestOutcome) => void;
}

export interface AllowEditsHandler extends EventHandler {
  name: "ALLOW_EDITS";
  handler: (allowEdits: boolean) => void;
}

/** main → window: the key stored by an earlier pairing, or null; sent on READY before the context. */
export interface PairingHandler extends EventHandler {
  name: "PAIRING";
  handler: (key: PluginKey | null) => void;
}

/** window → main: the window's content is this tall now. */
export interface ResizeHandler extends EventHandler {
  name: "RESIZE";
  handler: (height: number) => void;
}

/** window → main: keep this key, issued after the user typed the pairing code. */
export interface SavePairingHandler extends EventHandler {
  name: "SAVE_PAIRING";
  handler: (key: PluginKey) => void;
}

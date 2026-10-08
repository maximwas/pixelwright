import type { EventHandler } from "@create-figma-plugin/utilities";
import type { RequestOutcome } from "./link.ts";

/**
 * What only the main code knows: sent at start (as the UI's data) and on every change. A type, not an interface:
 * create-figma-plugin's showUI takes its data as Record<string, unknown>, which an interface does not satisfy.
 */
export type PluginContext = {
  readonly pluginVersion: string;
  readonly editorType: string;
  readonly file: { readonly name: string; readonly key: string | null };
  readonly page: { readonly id: string; readonly name: string };
  readonly allowEdits: boolean;
};

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

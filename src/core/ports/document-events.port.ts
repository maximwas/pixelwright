import { InjectionToken } from "@needle-di/core";
import type { PluginInfoUpdate } from "@/shared/protocol/plugin-info.schema.ts";
import type { PluginContext } from "@/shared/window/ui-message.schema.ts";

/** What the plugin knows of its file and tells about it (S-012): page, Allow edits, whether its tab is in front. */
export interface DocumentEvents {
  /** Starts listening to Figma, nothing is read before; `onInfo` gets the file's info each time it changes. */
  start(onInfo: (info: PluginInfoUpdate) => void): void;
  /** The file's info now. */
  info(): Promise<PluginInfoUpdate>;
  /** The file and page, as the window's hello carries them. */
  context(): Promise<PluginContext>;
  /** The window said its tab came to the front or went behind. */
  visible(on: boolean): void;
  /** Something the info holds changed outside Figma's events (the Allow edits switch). */
  changed(): void;
}

export const DOCUMENT_EVENTS = new InjectionToken<DocumentEvents>("DocumentEvents");

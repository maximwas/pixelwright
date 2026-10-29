import { InjectionToken } from "@needle-di/core";
import type { Change } from "@/shared/ops/changes/changes.manifest.ts";
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
  /** Starts listening to the current page's layer changes, following the user to every page (T-035). */
  onNodeChanges(listener: (changes: readonly NodeChangeRecord[]) => void): void;
}

/** One layer's change as Figma reported it: name null once the layer is gone, `remote` when another user made it. */
export interface NodeChangeRecord {
  readonly id: string;
  readonly name: string | null;
  readonly type: string;
  readonly change: Change["change"];
  readonly properties: readonly string[];
  readonly remote: boolean;
  readonly page: string;
}

export const DOCUMENT_EVENTS = new InjectionToken<DocumentEvents>("DocumentEvents");

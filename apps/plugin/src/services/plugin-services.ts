import { FontCatalog } from "../figma/fonts.ts";
import { ChangeJournal } from "./change-journal.ts";
import { ChunkStreams } from "./chunk-streams.ts";
import { EditsGuard } from "./edits-guard.ts";
import { ModeTurns } from "./mode-turns.ts";
import { UploadStore } from "./upload-store.ts";

/** What the plugin keeps while it runs, made once by its composition root and handed to the operations that use it. */
export interface PluginServices {
  readonly edits: EditsGuard;
  readonly uploads: UploadStore;
  readonly journal: ChangeJournal;
  readonly fonts: FontCatalog;
  /** Layer exports the server reads chunk by chunk. */
  readonly exports: ChunkStreams<{ bytes: Uint8Array; scale: number }>;
  /** Original images the server reads chunk by chunk. */
  readonly images: ChunkStreams<{ bytes: Uint8Array }>;
  readonly modeTurns: ModeTurns;
}

export function createServices(): PluginServices {
  return {
    edits: new EditsGuard(),
    uploads: new UploadStore(),
    journal: new ChangeJournal(),
    fonts: new FontCatalog(),
    exports: new ChunkStreams(),
    images: new ChunkStreams(),
    modeTurns: new ModeTurns(),
  };
}

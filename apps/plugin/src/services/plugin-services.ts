import { FontCatalog } from "../figma/fonts.ts";
import { ChangeJournal } from "./change-journal.ts";
import { EditsGuard } from "./edits-guard.ts";
import { UploadStore } from "./upload-store.ts";

/** What the plugin keeps while it runs, made once by its composition root and handed to the operations that use it. */
export interface PluginServices {
  readonly edits: EditsGuard;
  readonly uploads: UploadStore;
  readonly journal: ChangeJournal;
  readonly fonts: FontCatalog;
}

export function createServices(): PluginServices {
  return {
    edits: new EditsGuard(),
    uploads: new UploadStore(),
    journal: new ChangeJournal(),
    fonts: new FontCatalog(),
  };
}

import { inject, injectable } from "@needle-di/core";
import { createNanoEvents } from "nanoevents";
import type { DocumentEvents } from "@/core/ports/document-events.port.ts";
import { EDITS_SWITCH } from "@/core/ports/edits-switch.port.ts";
import { DOCUMENT_EVENT, FIGMA_EVENT } from "@/plugin/adapters/host/channels/channels.constants.ts";
import type { PluginInfoUpdate } from "@/shared/protocol/plugin-info.schema.ts";
import { VERSION } from "@/shared/version/version.constants.ts";
import type { PluginContext } from "@/shared/window/ui-message.schema.ts";

interface DocumentEventMap {
  [DOCUMENT_EVENT.info]: (info: PluginInfoUpdate) => void;
}

/**
 * The file's events (Adapter + Observer on nanoevents, S-012): Figma's page change, the Allow edits switch and the
 * window's tab coming to the front or going behind each give the observers the file's info anew. Only the window's
 * document knows whether its tab is in front, so the window says (FX-010).
 */
@injectable()
export class FigmaDocumentEvents implements DocumentEvents {
  readonly #edits;
  readonly #emitter = createNanoEvents<DocumentEventMap>();
  #visible = false;

  constructor(edits = inject(EDITS_SWITCH)) {
    this.#edits = edits;
  }

  start(): void {
    figma.on(FIGMA_EVENT.currentPageChange, () => this.changed());
  }

  onInfo(listener: (info: PluginInfoUpdate) => void): () => void {
    return this.#emitter.on(DOCUMENT_EVENT.info, listener);
  }

  async info(): Promise<PluginInfoUpdate> {
    return { ...(await this.context()), visible: this.#visible };
  }

  /** The file and page this window runs in; figma.fileKey is given to private plugins only (P-003). */
  async context(): Promise<PluginContext> {
    return {
      pluginVersion: VERSION,
      editorType: figma.editorType,
      file: { name: figma.root.name, key: figma.fileKey ?? null },
      page: { id: figma.currentPage.id, name: figma.currentPage.name },
      allowEdits: await this.#edits.isOn(),
    };
  }

  visible(on: boolean): void {
    this.#visible = on;
    this.changed();
  }

  changed(): void {
    void this.info().then((info) => this.#emitter.emit(DOCUMENT_EVENT.info, info));
  }
}

import { inject, injectable } from "@needle-di/core";
import type { DocumentEvents } from "@/core/ports/document-events.port.ts";
import { EDITS_SWITCH } from "@/core/ports/edits-switch.port.ts";
import { FIGMA_EVENT } from "@/plugin/adapters/host/channels/channels.constants.ts";
import type { PluginInfoUpdate } from "@/shared/protocol/plugin-info.schema.ts";
import { VERSION } from "@/shared/version/version.constants.ts";
import type { PluginContext } from "@/shared/window/ui-message.schema.ts";

/**
 * The file's events (Adapter, S-012): Figma's page change, the Allow edits switch and the window's tab coming to the
 * front or going behind each give its one listener the file's info anew. Only the window's
 * document knows whether its tab is in front, so the window says (FX-010).
 */
@injectable()
export class FigmaDocumentEvents implements DocumentEvents {
  readonly #edits;
  #onInfo: ((info: PluginInfoUpdate) => void) | null = null;
  #visible = false;

  constructor(edits = inject(EDITS_SWITCH)) {
    this.#edits = edits;
  }

  start(onInfo: (info: PluginInfoUpdate) => void): void {
    this.#onInfo = onInfo;
    figma.on(FIGMA_EVENT.currentPageChange, () => this.changed());
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
    void this.info().then((info) => this.#onInfo?.(info));
  }
}

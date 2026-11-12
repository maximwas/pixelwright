import { inject, injectable } from "@needle-di/core";
import type { DocumentEvents, NodeChangeRecord } from "@/core/ports/document-events.port.ts";
import { EDITS_SWITCH } from "@/core/ports/edits-switch.port.ts";
import { FIGMA_CHANGE, FIGMA_EVENT } from "@/plugin/adapters/host/channels/channels.constants.ts";
import type { PluginInfoUpdate } from "@/shared/protocol/plugin-info.schema.ts";
import { VERSION } from "@/shared/version/version.constants.ts";
import type { PluginContext } from "@/shared/window/ui-message.schema.ts";

/**
 * The file's events (Adapter, S-012): Figma's page change, the Allow edits switch and the window's tab coming to the
 * front or going behind each give its one listener the file's info anew. Only the window's
 * document knows whether its tab is in front, so the window says (FX-010). The current page's layer changes go to the
 * journal: nodechange per page, since documentchange needs every page loaded under dynamic-page.
 */
@injectable()
export class FigmaDocumentEvents implements DocumentEvents {
  readonly #edits;
  #onInfo: ((info: PluginInfoUpdate) => void) | null = null;
  #onNodes: ((changes: readonly NodeChangeRecord[]) => void) | null = null;
  #watched: PageNode | null = null;
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

  onNodeChanges(listener: (changes: readonly NodeChangeRecord[]) => void): void {
    this.#onNodes = listener;
    this.#watch();
    figma.on(FIGMA_EVENT.currentPageChange, () => this.#watch());
  }

  #watch(): void {
    const page = figma.currentPage;

    if (this.#watched === page) {
      return;
    }

    this.#watched?.off(FIGMA_EVENT.nodeChange, this.#nodeChanged);
    this.#watched = page;
    page.on(FIGMA_EVENT.nodeChange, this.#nodeChanged);
  }

  readonly #nodeChanged = (event: NodeChangeEvent): void => {
    const page = this.#watched?.name ?? "";

    this.#onNodes?.(event.nodeChanges.map((change) => this.#record(change, page)));
  };

  #record(change: NodeChange, page: string): NodeChangeRecord {
    return {
      id: change.id,
      name: this.#name(change.node),
      type: change.node.type,
      change: FIGMA_CHANGE.kind[change.type],
      properties: change.type === FIGMA_CHANGE.property ? [...change.properties] : [],
      remote: change.origin === FIGMA_CHANGE.remote,
      page,
    };
  }

  /** A layer gone since the change has no name; one hidden in an instance may drop out of the API at once (FX-021). */
  #name(node: SceneNode | RemovedNode): string | null {
    try {
      return "name" in node ? node.name : null;
    } catch {
      return null;
    }
  }
}

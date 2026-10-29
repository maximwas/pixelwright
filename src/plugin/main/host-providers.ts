import type { Container } from "@needle-di/core";
import { DOCUMENT_EVENTS } from "@/core/ports/document-events.port.ts";
import { EDITS_SWITCH } from "@/core/ports/edits-switch.port.ts";
import { KEY_VALUE_STORE } from "@/core/ports/key-value-store.port.ts";
import { SERVER_EVENTS } from "@/core/ports/server-events.port.ts";
import { WINDOW_EVENTS } from "@/core/ports/window-events.port.ts";
import { CODE_FIGMA, CodeFigma } from "@/plugin/adapters/figma/code-figma.ts";
import { CURRENT_SELECTION, CurrentSelection } from "@/plugin/adapters/figma/current-selection.ts";
import { NODE_LOOKUP, NodeLookup } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { FigmaDocumentEvents } from "@/plugin/adapters/host/channels/figma-document-events.ts";
import { SERVER_RPC, ServerRpc } from "@/plugin/adapters/host/channels/server-rpc.ts";
import { UI_CHANNEL, UiChannel } from "@/plugin/adapters/host/channels/ui-channel.ts";
import { WINDOW_HOST, WindowHost } from "@/plugin/adapters/host/channels/window-host.ts";
import { ClientStorageStore } from "@/plugin/adapters/host/storage/client-storage-store.ts";
import { EditsStore } from "@/plugin/adapters/host/storage/edits-store.ts";
import { FILE_ID, FileId } from "@/plugin/adapters/host/storage/file-id.ts";
import { PAIRING_STORE, PairingStore } from "@/plugin/adapters/host/storage/pairing-store.ts";

/**
 * The host's bindings (A§4b.3): figma.ui's channel, clientStorage, the pairing key, the file id and Allow edits, the
 * server's RPC peer and its events, the file's events, the selection, lookups by id, execute's figma, and main's side
 * of the window with the window's events.
 */
export class HostProviders {
  register(container: Container): void {
    container
      .bind({ provide: UI_CHANNEL, useClass: UiChannel })
      .bind({ provide: KEY_VALUE_STORE, useClass: ClientStorageStore })
      .bind({ provide: PAIRING_STORE, useClass: PairingStore })
      .bind({ provide: FILE_ID, useClass: FileId })
      .bind({ provide: EDITS_SWITCH, useClass: EditsStore })
      .bind({ provide: SERVER_RPC, useClass: ServerRpc })
      .bind({ provide: SERVER_EVENTS, useExisting: SERVER_RPC })
      .bind({ provide: DOCUMENT_EVENTS, useClass: FigmaDocumentEvents })
      .bind({ provide: CURRENT_SELECTION, useClass: CurrentSelection })
      .bind({ provide: NODE_LOOKUP, useClass: NodeLookup })
      .bind({ provide: CODE_FIGMA, useClass: CodeFigma })
      .bind({ provide: WINDOW_HOST, useClass: WindowHost })
      .bind({ provide: WINDOW_EVENTS, useExisting: WINDOW_HOST });
  }
}

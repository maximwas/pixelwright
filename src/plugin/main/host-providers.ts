import type { Container } from "@needle-di/core";
import { NUMBER_FORMAT, NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { DOCUMENT_EVENTS } from "@/core/ports/document-events.port.ts";
import { EDITS_SWITCH } from "@/core/ports/edits-switch.port.ts";
import { KEY_VALUE_STORE } from "@/core/ports/key-value-store.port.ts";
import { SERVER_EVENTS } from "@/core/ports/server-events.port.ts";
import { WINDOW_EVENTS } from "@/core/ports/window-events.port.ts";
import { STYLE_NUMBERS_READER, StyleNumbers } from "@/core/tokens/names/style-numbers.ts";
import { CANVAS_VIEW, CanvasView } from "@/plugin/adapters/figma/canvas-view.ts";
import { CODE_FIGMA, CodeFigma } from "@/plugin/adapters/figma/code-figma.ts";
import { CURRENT_SELECTION, CurrentSelection } from "@/plugin/adapters/figma/current-selection.ts";
import { DEV_RESOURCES, DevResources } from "@/plugin/adapters/figma/dev-resources/dev-resources.ts";
import { FIGMA_BASE64, FigmaBase64 } from "@/plugin/adapters/figma/figma-base64.ts";
import { ComponentFieldReader } from "@/plugin/adapters/figma/layer-meta/component-field-reader.ts";
import { FactFieldReader } from "@/plugin/adapters/figma/layer-meta/fact-field-reader.ts";
import { ModeFieldReader } from "@/plugin/adapters/figma/layer-meta/mode-field-reader.ts";
import { NoteFieldReader } from "@/plugin/adapters/figma/layer-meta/note-field-reader.ts";
import { ReactionFieldReader } from "@/plugin/adapters/figma/layer-meta/reaction-field-reader.ts";
import { AppearanceFieldReader } from "@/plugin/adapters/figma/layer-read/appearance-field-reader.ts";
import { BoxFieldReader } from "@/plugin/adapters/figma/layer-read/box-field-reader.ts";
import { EffectFieldReader } from "@/plugin/adapters/figma/layer-read/effect-field-reader.ts";
import { FIELD_READERS, LAYER_READER, LayerReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import { LayoutFieldReader } from "@/plugin/adapters/figma/layer-read/layout-field-reader.ts";
import { PaintFieldReader } from "@/plugin/adapters/figma/layer-read/paint-field-reader.ts";
import { REFERENCES, References } from "@/plugin/adapters/figma/layer-read/references.ts";
import { StrokeFieldReader } from "@/plugin/adapters/figma/layer-read/stroke-field-reader.ts";
import { TextFieldReader } from "@/plugin/adapters/figma/layer-read/text-field-reader.ts";
import { VariableFieldReader } from "@/plugin/adapters/figma/layer-read/variable-field-reader.ts";
import { LAYER_REFS, LayerRefs } from "@/plugin/adapters/figma/layer-refs.ts";
import { LAYER_WALK, LayerWalk } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { NODE_LOOKUP, NodeLookup } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { PAGE_LOADER, PageLoader } from "@/plugin/adapters/figma/lookup/page-loader.ts";
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
 * server's RPC peer and its events, the file's events, the selection, layer refs, the page and the view, lookups by
 * id, the pages' loading and the deadline walk with the clock (Date is the system clock: its now() is the port's),
 * the read's layer reader with its field readers in 0.7.0's order (m:f53dbe49; layer-meta's after the CSS fields) and
 * the rounding, Dev Mode links from Figma's servers, execute's figma, and
 * main's side of the window with the window's events.
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
      .bind({ provide: LAYER_REFS, useClass: LayerRefs })
      .bind({ provide: CANVAS_VIEW, useClass: CanvasView })
      .bind({ provide: FIGMA_BASE64, useClass: FigmaBase64 })
      .bind({ provide: NODE_LOOKUP, useClass: NodeLookup })
      .bind({ provide: NUMBER_FORMAT, useClass: NumberFormat })
      .bind({ provide: FIELD_READERS, multi: true, useClass: BoxFieldReader })
      .bind({ provide: FIELD_READERS, multi: true, useClass: LayoutFieldReader })
      .bind({ provide: FIELD_READERS, multi: true, useClass: AppearanceFieldReader })
      .bind({ provide: FIELD_READERS, multi: true, useClass: PaintFieldReader })
      .bind({ provide: FIELD_READERS, multi: true, useClass: StrokeFieldReader })
      .bind({ provide: FIELD_READERS, multi: true, useClass: EffectFieldReader })
      .bind({ provide: FIELD_READERS, multi: true, useClass: TextFieldReader })
      .bind({ provide: FIELD_READERS, multi: true, useClass: VariableFieldReader })
      .bind({ provide: FIELD_READERS, multi: true, useClass: ComponentFieldReader })
      .bind({ provide: FIELD_READERS, multi: true, useClass: NoteFieldReader })
      .bind({ provide: FIELD_READERS, multi: true, useClass: ModeFieldReader })
      .bind({ provide: FIELD_READERS, multi: true, useClass: ReactionFieldReader })
      .bind({ provide: FIELD_READERS, multi: true, useClass: FactFieldReader })
      .bind({ provide: STYLE_NUMBERS_READER, useClass: StyleNumbers })
      .bind({ provide: REFERENCES, useClass: References })
      .bind({ provide: LAYER_READER, useClass: LayerReader })
      .bind({ provide: CLOCK, useValue: Date })
      .bind({ provide: PAGE_LOADER, useClass: PageLoader })
      .bind({ provide: LAYER_WALK, useClass: LayerWalk })
      .bind({ provide: DEV_RESOURCES, useClass: DevResources })
      .bind({ provide: CODE_FIGMA, useClass: CodeFigma })
      .bind({ provide: WINDOW_HOST, useClass: WindowHost })
      .bind({ provide: WINDOW_EVENTS, useExisting: WINDOW_HOST });
  }
}

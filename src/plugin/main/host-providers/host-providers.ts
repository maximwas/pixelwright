import type { Container } from "@needle-di/core";
import { EDITS_SWITCH } from "@/core/ports/edits-switch/edits-switch.port.ts";
import { KEY_VALUE_STORE } from "@/core/ports/key-value-store/key-value-store.port.ts";
import { ClientStorageStore } from "@/plugin/adapters/host/client-storage-store/client-storage-store.ts";
import { EditsStore } from "@/plugin/adapters/host/edits-store/edits-store.ts";
import { FILE_ID } from "@/plugin/adapters/host/file-id/file-id.tokens.ts";
import { FileId } from "@/plugin/adapters/host/file-id/file-id.ts";
import { PAIRING_STORE } from "@/plugin/adapters/host/pairing-store/pairing-store.tokens.ts";
import { PairingStore } from "@/plugin/adapters/host/pairing-store/pairing-store.ts";
import { SERVER_RPC } from "@/plugin/adapters/host/server-rpc/server-rpc.tokens.ts";
import { ServerRpc } from "@/plugin/adapters/host/server-rpc/server-rpc.ts";
import { UI_CHANNEL } from "@/plugin/adapters/host/ui-channel/ui-channel.tokens.ts";
import { UiChannel } from "@/plugin/adapters/host/ui-channel/ui-channel.ts";
import { WINDOW_HOST } from "@/plugin/adapters/host/window-host/window-host.tokens.ts";
import { WindowHost } from "@/plugin/adapters/host/window-host/window-host.ts";

/** The host's bindings (A§4b.3): figma.ui's channel, clientStorage, the pairing key, the file id and Allow edits, the server's RPC peer, and main's side of the window. */
export class HostProviders {
  register(container: Container): void {
    container
      .bind({
        provide: UI_CHANNEL,
        useClass: UiChannel,
      })
      .bind({
        provide: KEY_VALUE_STORE,
        useClass: ClientStorageStore,
      })
      .bind({
        provide: PAIRING_STORE,
        useClass: PairingStore,
      })
      .bind({
        provide: FILE_ID,
        useClass: FileId,
      })
      .bind({
        provide: EDITS_SWITCH,
        useClass: EditsStore,
      })
      .bind({
        provide: SERVER_RPC,
        useClass: ServerRpc,
      })
      .bind({
        provide: WINDOW_HOST,
        useClass: WindowHost,
      });
  }
}

import type { Container } from "@needle-di/core";
import { KEY_VALUE_STORE } from "@/core/ports/key-value-store/key-value-store.port.ts";
import { ClientStorageStore } from "@/plugin/adapters/host/client-storage-store/client-storage-store.ts";
import { PAIRING_STORE } from "@/plugin/adapters/host/pairing-store/pairing-store.tokens.ts";
import { PairingStore } from "@/plugin/adapters/host/pairing-store/pairing-store.ts";
import { UI_CHANNEL } from "@/plugin/adapters/host/ui-channel/ui-channel.tokens.ts";
import { UiChannel } from "@/plugin/adapters/host/ui-channel/ui-channel.ts";
import { WINDOW_HOST } from "@/plugin/adapters/host/window-host/window-host.tokens.ts";
import { WindowHost } from "@/plugin/adapters/host/window-host/window-host.ts";

/** The host's bindings (A§4b.3): figma.ui's channel, clientStorage, the pairing key, and main's side of the window. */
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
        provide: WINDOW_HOST,
        useClass: WindowHost,
      });
  }
}

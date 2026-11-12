import { injectable } from "@needle-di/core";
import { BrowserSocket } from "@/plugin-ui/adapters/browser-socket.ts";
import type { SocketOpener } from "@/plugin-ui/link/socket-link.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import type { MessageSocket } from "@/shared/protocol/message-socket.types.ts";
import { BRIDGE_URL_TEXT } from "@/shared/protocol/protocol.constants.ts";

/** Opens the window's sockets to the channel's bridge (Factory); only the window may use the network (FX-004). */
@injectable()
export class BrowserSockets implements SocketOpener {
  open(): MessageSocket {
    const socket = new BrowserSocket(new WebSocket(BRIDGE_URL_TEXT.url(CHANNEL.port)));

    socket.watch();

    return socket;
  }
}

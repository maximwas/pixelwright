import type { HANDSHAKE_STATE, LINK_STATE } from "@/plugin-ui/link/socket-link/socket-link.constants.ts";
import type { PairingReason, PluginKey } from "@/shared/protocol/handshake.schema.ts";
import type { MessageSocket } from "@/shared/protocol/message-socket.types.ts";
import type { PluginInfo } from "@/shared/protocol/plugin-info.schema.ts";

/** Opens a socket to the bridge; what is sent before it is open goes out once it is. */
export interface SocketOpener {
  open(): MessageSocket;
}

/** What the window shows of the link. */
export type LinkState =
  | { readonly kind: typeof LINK_STATE.connecting }
  | {
    readonly kind: typeof LINK_STATE.pairing;
    readonly reason: PairingReason;
    readonly attemptsLeft: number;
  }
  | { readonly kind: typeof LINK_STATE.connected }
  | {
    readonly kind: typeof LINK_STATE.waiting;
    readonly retryInMs: number;
    readonly reason: string | null;
  }
  | {
    readonly kind: typeof LINK_STATE.stopped;
    readonly reason: string | null;
  };

/** What the link asks of the window and tells it (Observer). */
export interface LinkObserver {
  /** Who the plugin is now, for each hello. */
  info(): PluginInfo;
  state(state: LinkState): void;
  /** A key the server issued after the user's code: main stores it in place of the old one. */
  paired(key: PluginKey): void;
  /** A frame of the session on the socket of `epoch`, unread: main's RPC takes it. */
  frame(epoch: number, text: string): void;
}

/** Where one socket's handshake stands: the link's one state field. */
export type Handshake =
  | {
    readonly name: typeof HANDSHAKE_STATE.hello;
    /** This socket's half of the challenge. */
    readonly nonce: string;
  }
  | { readonly name: Exclude<(typeof HANDSHAKE_STATE)[keyof typeof HANDSHAKE_STATE], typeof HANDSHAKE_STATE.hello> };

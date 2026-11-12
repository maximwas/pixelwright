import { randomBytes } from "node:crypto";
import { bytesToHex } from "@noble/hashes/utils.js";
import { type RawData, WebSocket } from "ws";
import * as zod from "zod/mini";
import { LISTEN_HOST } from "@/server/adapters/bridge/listener/listener.constants.ts";
import { PEER_SOCKET_EVENT, PEER_URL } from "@/server/adapters/bridge/peer/peer.constants.ts";
import {
  PEER_HANDSHAKE_TYPE,
  PEER_JOIN_TIMEOUT_MS,
  PEER_PROTOCOL,
} from "@/shared/protocol/peer-handshake.constants.ts";
import { PeerChallengeSchema } from "@/shared/protocol/peer-handshake.schema.ts";
import { Proof } from "@/shared/protocol/proof.ts";
import { CLOSE_CODE, NONCE_BYTES, PROOF_ROLE, PROTOCOL } from "@/shared/protocol/protocol.constants.ts";

/**
 * The peer's side of the handshake (S-031): it connects without an Origin, says hello, believes the owner only once it
 * proved the token over this nonce, and proves it back. What does not answer as a Pixelwright owner within 3 s ends
 * the try with the close code it gave, or none.
 */
export class PeerJoin {
  readonly #port: number;
  readonly #token: string;
  readonly #nonce = bytesToHex(randomBytes(NONCE_BYTES));

  constructor(port: number, token: string) {
    this.#port = port;
    this.#token = token;
  }

  join(): Promise<PeerJoinResult> {
    return new Promise((resolve) => {
      const socket = new WebSocket(PEER_URL.at(LISTEN_HOST, this.#port));
      const failed = (closeCode: number | null) => {
        clearTimeout(deadline);
        socket.terminate();
        resolve({ socket: null, closeCode });
      };
      const deadline = setTimeout(() => failed(null), PEER_JOIN_TIMEOUT_MS);
      const closed = (code: number) => failed(code);

      socket.on(PEER_SOCKET_EVENT.error, () => failed(null));
      socket.once(PEER_SOCKET_EVENT.close, closed);
      socket.once(PEER_SOCKET_EVENT.open, () => socket.send(this.#hello()));
      socket.once(PEER_SOCKET_EVENT.message, (data: RawData) => {
        const auth = this.#auth(data);

        if (auth === null) {
          failed(CLOSE_CODE.unauthorized);

          return;
        }

        clearTimeout(deadline);
        socket.off(PEER_SOCKET_EVENT.close, closed);
        socket.send(auth);
        resolve({ socket, closeCode: null });
      });
    });
  }

  #hello(): string {
    return JSON.stringify({
      type: PEER_HANDSHAKE_TYPE.peerHello,
      protocol: PEER_PROTOCOL,
      pluginProtocol: PROTOCOL,
      nonce: this.#nonce,
    });
  }

  /** The peer_auth frame, or null when the challenge is not the owner's proof of the token. */
  #auth(data: RawData): string | null {
    let json: unknown = null;

    try {
      json = JSON.parse(String(data));
    } catch {
      return null;
    }

    const challenge = zod.safeParse(PeerChallengeSchema, json);

    if (
      !challenge.success ||
      !Proof.of(challenge.data.proof).equals(
        Proof.sign(this.#token, PROOF_ROLE.owner, this.#nonce, challenge.data.nonce),
      )
    ) {
      return null;
    }

    return JSON.stringify({
      type: PEER_HANDSHAKE_TYPE.peerAuth,
      proof: Proof.sign(this.#token, PROOF_ROLE.peer, challenge.data.nonce, this.#nonce).hex(),
    });
  }
}

/** The owner's socket once both sides proved the token, or why the try ended: its close code, or null for none. */
export type PeerJoinResult =
  | { readonly socket: WebSocket; readonly closeCode: null }
  | { readonly socket: null; readonly closeCode: number | null };

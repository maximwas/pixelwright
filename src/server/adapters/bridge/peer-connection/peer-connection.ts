import { randomBytes } from "node:crypto";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { RawData, WebSocket } from "ws";
import * as zod from "zod/mini";
import type { PeerServices } from "@/server/adapters/bridge/peer-connection/peer-connection.types.ts";
import { WS_EVENT } from "@/server/adapters/bridge/ws-socket/ws-socket.constants.ts";
import {
  PEER_HANDSHAKE_TYPE,
  PEER_JOIN_TIMEOUT_MS,
  PEER_PROTOCOL,
  PEER_REASON,
} from "@/shared/protocol/peer-handshake.constants.ts";
import { PeerAuthSchema, type PeerHello, PeerHelloSchema } from "@/shared/protocol/peer-handshake.schema.ts";
import { PROOF_ROLE } from "@/shared/protocol/proof/proof.constants.ts";
import { Proof } from "@/shared/protocol/proof/proof.ts";
import { CLOSE_CODE, NONCE_BYTES, PROTOCOL } from "@/shared/protocol/protocol.constants.ts";

/**
 * The owner's side of one peer socket (A§5.3, S-031): hello, the owner's proof over the peer's nonce, the peer's proof
 * back, all within 3 s. An older peer is closed 4426; a newer one, once it proved the token, takes the bridge over
 * (S-034); the same protocol is served the owner's contract. oRPC's handler takes the socket only after the handshake,
 * since it throws on a frame that is not its own (KL §7).
 */
export class PeerConnection {
  readonly #socket: WebSocket;
  readonly #services: PeerServices;
  readonly #nonce = bytesToHex(randomBytes(NONCE_BYTES));
  #hello: PeerHello | null = null;
  #deadline: ReturnType<typeof setTimeout> | undefined;

  constructor(
    socket: WebSocket,
    services: PeerServices,
  ) {
    this.#socket = socket;
    this.#services = services;
  }

  start(): void {
    this.#socket.on(WS_EVENT.error, () => this.#socket.terminate());
    this.#socket.on(WS_EVENT.message, this.#receive);
    this.#socket.once(WS_EVENT.close, () => clearTimeout(this.#deadline));
    this.#deadline = setTimeout(
      () => this.#end(CLOSE_CODE.helloTimeout, PEER_REASON.joinTimeout),
      PEER_JOIN_TIMEOUT_MS,
    );
  }

  readonly #receive = (data: RawData): void => {
    const json = this.#json(data);

    if (this.#hello === null) {
      this.#greet(json);
    } else {
      this.#auth(this.#hello, json);
    }
  };

  #greet(json: unknown): void {
    const hello = zod.safeParse(PeerHelloSchema, json);

    if (!hello.success) {
      this.#end(CLOSE_CODE.badMessage, PEER_REASON.badMessage);
    } else if (hello.data.protocol < PEER_PROTOCOL) {
      this.#end(CLOSE_CODE.versionMismatch, PEER_REASON.protocolRequired(PEER_PROTOCOL));
    } else {
      this.#hello = hello.data;
      this.#socket.send(
        JSON.stringify({
          type: PEER_HANDSHAKE_TYPE.peerChallenge,
          nonce: this.#nonce,
          proof: Proof.sign(this.#services.token(), PROOF_ROLE.owner, hello.data.nonce, this.#nonce).hex(),
        }),
      );
    }
  }

  #auth(
    hello: PeerHello,
    json: unknown,
  ): void {
    const auth = zod.safeParse(PeerAuthSchema, json);
    const expected = Proof.sign(this.#services.token(), PROOF_ROLE.peer, this.#nonce, hello.nonce);

    if (!auth.success || !Proof.of(auth.data.proof).equals(expected)) {
      this.#end(CLOSE_CODE.unauthorized, PEER_REASON.badProof);

      return;
    }

    clearTimeout(this.#deadline);
    this.#socket.off(WS_EVENT.message, this.#receive);

    if (hello.protocol > PEER_PROTOCOL || (hello.pluginProtocol ?? PROTOCOL) > PROTOCOL) {
      this.#socket.close(CLOSE_CODE.handedOver, PEER_REASON.handedOver);
      this.#services.handOver();
    } else {
      this.#services.serve(this.#socket);
    }
  }

  #end(
    code: number,
    reason: string,
  ): void {
    clearTimeout(this.#deadline);
    this.#socket.off(WS_EVENT.message, this.#receive);
    this.#socket.close(code, reason);
  }

  #json(data: RawData): unknown {
    try {
      return JSON.parse(String(data));
    } catch {
      return null;
    }
  }
}

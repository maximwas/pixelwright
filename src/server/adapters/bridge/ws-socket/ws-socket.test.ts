import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { PinoLogger } from "../../logging/pino-logger/pino-logger.ts";
import { WsSocket } from "./ws-socket.ts";

/** Short, so the test sees several heartbeats; production beats every 15 s. */
const BEAT_MS = 25;

/** A ws server whose accepted sockets are WsSockets with a fast heartbeat, and a client of it. */
class SocketPair {
  readonly server = new WebSocketServer({
    host: "127.0.0.1",
    port: 0,
  });

  readonly frames: (string | null)[] = [];

  async client(autoPong: boolean): Promise<WebSocket> {
    await once(this.server, "listening");

    const address = this.server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const logger = new PinoLogger(
      {
        level: "silent",
        file: "unused",
      },
      [],
    );

    this.server.on("connection", (socket) => {
      const wrapped = new WsSocket(socket, logger);

      wrapped.watch(BEAT_MS);
      wrapped.onMessage((text) => this.frames.push(text));
    });

    const client = new WebSocket(`ws://127.0.0.1:${port}`, { autoPong });

    await once(client, "open");

    return client;
  }
}

const pairs: SocketPair[] = [];

const pair = (): SocketPair => {
  const socketPair = new SocketPair();

  pairs.push(socketPair);

  return socketPair;
};

afterEach(async () => {
  for (const socketPair of pairs.splice(0)) {
    for (const client of socketPair.server.clients) {
      client.terminate();
    }

    await new Promise((resolve) => socketPair.server.close(resolve));
  }
});

describe("WsSocket", () => {
  it("cuts off a socket that answers no ping, without waiting for a close handshake", async () => {
    const client = await pair().client(false);
    const [code] = await once(client, "close");

    expect(code).toBe(1006);
  });

  it("keeps a socket that answers its pings", async () => {
    const client = await pair().client(true);

    await sleep(BEAT_MS * 6);

    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it("hands on text frames as text and a binary frame as null", async () => {
    const socketPair = pair();
    const client = await socketPair.client(true);

    client.send("hello");
    client.send(Buffer.from("binary"));
    await sleep(BEAT_MS);

    expect(socketPair.frames).toEqual(["hello", null]);
  });
});

import type { Server } from "node:http";
import { CloseCode } from "@pixelwright/core";
import type { WebSocket, WebSocketServer } from "ws";

/**
 * Listens on 127.0.0.1. Resolves with the port, or null while another process (another pixelwright) holds it.
 * Both one-time listeners are removed whichever event fires, so background retries do not pile them up.
 */
export async function listenOnLoopback(server: Server, port: number): Promise<number | null> {
  try {
    await new Promise<void>((resolve, reject) => {
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      const onError = (error: Error) => {
        server.off("listening", onListening);
        reject(error);
      };

      server.once("listening", onListening);
      server.once("error", onError);
      server.listen(port, "127.0.0.1");
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      return null;
    }

    throw error;
  }

  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("The plugin bridge has no TCP address.");
  }

  return address.port;
}

/**
 * Frees the port first, so a new server process can take it at once, then says goodbye to the plugin; `handedTo`, the
 * newer server's socket, hears that the port is its own now.
 */
export async function closeGracefully(
  server: Server,
  webSocketServer: WebSocketServer,
  graceMs: number,
  handedTo: WebSocket | null = null,
): Promise<void> {
  const httpClosed = new Promise<void>((resolve) => server.close(() => resolve()));

  server.closeAllConnections();

  const clients = [...webSocketServer.clients];

  for (const socket of clients) {
    if (socket === handedTo) {
      socket.close(CloseCode.HandedOver, "a newer Pixelwright server takes the bridge");
    } else {
      socket.close(CloseCode.GoingAway, "server shutting down");
    }
  }

  // A frozen tab never answers the close handshake; cut it off instead of waiting for ws's 30 s timeout.
  const cutOff = setTimeout(() => {
    for (const socket of clients) {
      socket.terminate();
    }
  }, graceMs);

  await new Promise<void>((resolve) => webSocketServer.close(() => resolve()));
  clearTimeout(cutOff);
  await httpClosed;
}

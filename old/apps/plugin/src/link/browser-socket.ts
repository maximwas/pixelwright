import type { SocketLike } from "../types/link.ts";

/** The iframe's WebSocket behind the small SocketLike surface SocketLink uses. */
export function browserSocket(url: string): SocketLike {
  const socket = new WebSocket(url);
  const like: SocketLike = {
    get readyState() {
      return socket.readyState;
    },
    send: (data) => socket.send(data),
    close: (code, reason) => socket.close(code, reason),
    onopen: null,
    onmessage: null,
    onclose: null,
  };

  socket.onopen = () => like.onopen?.();
  socket.onmessage = (event) => like.onmessage?.({ data: event.data });
  socket.onclose = (event) =>
    like.onclose?.({
      code: event.code,
      reason: event.reason,
    });

  return like;
}

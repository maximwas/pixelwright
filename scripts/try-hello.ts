// `pnpm try:hello <old|unknown-key> [--hold <s>]`: knocks on the dev bridge (ws://127.0.0.1:18721/pixelwright/v1) as a
// plugin window does, with the hello recorded from 0.7.0 (test/golden/fixtures/handshake-0.7.0.json). `old` sends it
// as recorded (protocol 5); `unknown-key` as protocol 6 with a key no bridge.json holds, then waits like a window
// waiting for its code. Prints each frame the server sends and how it closes. Run it beside `pnpm try --hold`.
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import { WebSocket } from "ws";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { BRIDGE_PATH, PROTOCOL } from "@/shared/protocol/protocol.constants.ts";

/** A key id no bridge.json holds. */
const UNKNOWN_KEY = "feedfacefeedface";

class HelloKnock {
  readonly #hello: string = JSON.parse(
    readFileSync(new URL("../test/golden/fixtures/handshake-0.7.0.json", import.meta.url), "utf8"),
  ).pluginToServer.helloNoKey;

  async run(argv: readonly string[]): Promise<number> {
    const { positionals, values } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { hold: { type: "string" } },
    });
    const frame = this.#frame(positionals[0]);
    const holdSeconds = Number(values.hold ?? 30);

    if (frame === null || !(holdSeconds >= 0)) {
      throw new Error("Usage: pnpm try:hello <old|unknown-key> [--hold <seconds>]");
    }

    const socket = new WebSocket(`ws://127.0.0.1:${CHANNEL.port}${BRIDGE_PATH}`, { origin: "null" });
    const closed = once(socket, "close");

    socket.on("message", (data) => process.stdout.write(`server → ${String(data)}\n`));
    await once(socket, "open");
    process.stdout.write(`plugin → ${frame}\n`);
    socket.send(frame);
    await Promise.race([closed, sleep(holdSeconds * 1000)]);
    socket.close();

    const [code, reason] = await closed;

    process.stdout.write(`closed ${code} ${JSON.stringify(String(reason))}\n`);

    return 0;
  }

  #frame(kind: string | undefined): string | null {
    if (kind === "old") {
      return this.#hello;
    }

    return kind === "unknown-key"
      ? JSON.stringify({
        ...JSON.parse(this.#hello),
        protocol: PROTOCOL,
        keyId: UNKNOWN_KEY,
      })
      : null;
  }
}

process.exitCode = await new HelloKnock().run(process.argv.slice(2));

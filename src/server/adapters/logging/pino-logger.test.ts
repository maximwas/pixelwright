import { describe, expect, it } from "vitest";
import { PixelwrightError } from "../../../shared/errors/pixelwright-error.ts";
import { CHANNEL } from "../../../shared/protocol/channel.constants.ts";
import { VERSION } from "../../../shared/version/version.constants.ts";
import { PinoLogger } from "./pino-logger.ts";

/** The logger's destination in a test: every line it writes, parsed. */
class LineSink {
  readonly lines: Record<string, unknown>[] = [];

  write(line: string): void {
    this.lines.push(JSON.parse(line));
  }
}

class LoggerProbe {
  readonly sink = new LineSink();
  readonly logger = new PinoLogger(
    {
      level: "info",
      file: "unused",
    },
    [this.sink],
  );

  last(): Record<string, unknown> {
    return this.sink.lines.at(-1) ?? {};
  }
}

describe("PinoLogger", () => {
  it("writes JSON lines with time, level, pid, version, channel, message and fields", () => {
    const probe = new LoggerProbe();

    probe.logger.child({ component: "tool-runner" }).info("tool status", {
      callId: "c1",
      ms: 3,
    });

    expect(probe.last()).toMatchObject({
      level: 30,
      pid: process.pid,
      version: VERSION,
      channel: CHANNEL.name,
      component: "tool-runner",
      msg: "tool status",
      callId: "c1",
      ms: 3,
    });
    expect(probe.last().time).toEqual(expect.any(Number));
  });

  it("drops lines below its level", () => {
    const probe = new LoggerProbe();

    probe.logger.debug("op frame", { bytes: 10 });

    expect(probe.sink.lines).toEqual([]);
  });

  it("writes an error with its type, code, message, stack and cause", () => {
    const probe = new LoggerProbe();
    const cause = new Error("socket closed");

    probe.logger.warn("tool status failed", {
      err: new PixelwrightError("PLUGIN_DISCONNECTED", "The plugin went away.", { cause }),
    });

    expect(probe.last().err).toMatchObject({
      type: "PixelwrightError",
      code: "PLUGIN_DISCONNECTED",
      message: "The plugin went away.",
      stack: expect.stringContaining("PixelwrightError"),
      cause: {
        type: "Error",
        message: "socket closed",
      },
    });
  });

  it.each([
    ["a pairing code", "pairingCode"],
    ["a key", "key"],
    ["a proof", "proof"],
    ["a nonce", "nonce"],
    ["a token", "token"],
  ])("never writes %s, at the top or one level down", (_kind, field) => {
    const probe = new LoggerProbe();
    const secret = `secret-${field}-4711`;

    probe.logger.info("handshake", {
      [field]: secret,
      peer: { [field]: secret },
    });

    expect(JSON.stringify(probe.last())).not.toContain(secret);
    expect(probe.last()[field]).toBe("[redacted]");
  });
});

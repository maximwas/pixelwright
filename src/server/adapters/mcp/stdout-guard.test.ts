import { Console } from "node:console";
import { PassThrough } from "node:stream";
import { text } from "node:stream/consumers";
import { describe, expect, it } from "vitest";
import { StdoutGuard } from "@/server/adapters/mcp/stdout-guard.ts";

/** A real Console over two streams, so the test sees which one each call reaches. */
class ConsoleProbe {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly console = new Console({ stdout: this.stdout, stderr: this.stderr });

  /** All the stream got: since Node 26 a bare read() returns one chunk, not the whole buffer. */
  async printed(stream: PassThrough): Promise<string> {
    stream.end();

    return text(stream);
  }
}

describe("StdoutGuard", () => {
  it("sends console.log, info, debug and dir to stderr, so stdout carries MCP only", async () => {
    const probe = new ConsoleProbe();

    new StdoutGuard(probe.console, probe.stderr).install();
    probe.console.log("log");
    probe.console.info("info");
    probe.console.debug("debug");
    probe.console.dir({ dir: 1 });

    expect(await probe.printed(probe.stdout)).toBe("");
    expect(await probe.printed(probe.stderr)).toBe("log\ninfo\ndebug\n{ dir: 1 }\n");
  });
});

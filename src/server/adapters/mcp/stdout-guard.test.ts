import { Console } from "node:console";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { StdoutGuard } from "./stdout-guard.ts";

/** A real Console over two streams, so the test sees which one each call reaches. */
class ConsoleProbe {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly console = new Console({
    stdout: this.stdout,
    stderr: this.stderr,
  });

  printed(stream: PassThrough): string {
    return String(stream.read() ?? "");
  }
}

describe("StdoutGuard", () => {
  it("sends console.log, info, debug and dir to stderr, so stdout carries MCP only", () => {
    const probe = new ConsoleProbe();

    new StdoutGuard(probe.console, probe.stderr).install();
    probe.console.log("log");
    probe.console.info("info");
    probe.console.debug("debug");
    probe.console.dir({ dir: 1 });

    expect(probe.printed(probe.stdout)).toBe("");
    expect(probe.printed(probe.stderr)).toBe("log\ninfo\ndebug\n{ dir: 1 }\n");
  });
});

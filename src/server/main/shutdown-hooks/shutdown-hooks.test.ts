import { afterEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "@/core/ports/logger/logger.port.ts";
import { ShutdownHooks } from "@/server/main/shutdown-hooks/shutdown-hooks.ts";

const lines: string[] = [];
const logger: Logger = {
  trace: () => undefined,
  debug: () => undefined,
  info: (message) => lines.push(message),
  warn: () => undefined,
  error: () => undefined,
  child: () => logger,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ShutdownHooks (S-013)", () => {
  it("closes once when the MCP client's stdin ends and then closes", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const close = vi.fn(async () => undefined);

    new ShutdownHooks(logger).install(close);
    process.stdin.emit("end");
    process.stdin.emit("close");
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());

    expect(close).toHaveBeenCalledTimes(1);
    expect(lines).toEqual(["shutting down"]);
  });
});

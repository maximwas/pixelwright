import { describe, expect, it } from "vitest";
import type { ConnectedFile } from "@/core/ports/plugin-link/plugin-link.port.ts";
import { TargetResolver } from "@/server/app/sessions/target-resolver/target-resolver.ts";

const connected = (
  session: string,
  name: string,
  active = false,
): ConnectedFile => ({
  session,
  name,
  key: null,
  page: "Start here",
  editorType: "figma",
  allowEdits: true,
  visible: true,
  active,
  pluginVersion: "0.8.0",
});

describe("TargetResolver (T-001)", () => {
  it("refuses a name two open files share in any case, naming their sessions", () => {
    const files = [connected("a", "Test MCP"), connected("b", "test mcp", true)];

    expect(() => new TargetResolver().resolve(files, "Test MCP")).toThrow(
      expect.objectContaining({
        code: "AMBIGUOUS_FILE",
        message: expect.stringContaining("sessions a, b"),
      }),
    );
  });

  it("takes a session id, a name in any case, else the active file", () => {
    const files = [connected("a", "Orbit"), connected("b", "Test MCP", true)];
    const resolver = new TargetResolver();

    expect(resolver.resolve(files, "a")).toBe("a");
    expect(resolver.resolve(files, "test mcp")).toBe("b");
    expect(resolver.resolve(files, undefined)).toBe("b");
    expect(() => resolver.resolve(files, "Another file")).toThrow(expect.objectContaining({ code: "FILE_NOT_FOUND" }));
    expect(() => resolver.resolve([], undefined)).toThrow(expect.objectContaining({ code: "PLUGIN_NOT_CONNECTED" }));
  });
});

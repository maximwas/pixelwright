import { describe, expect, it } from "vitest";
import type { ConnectedFile, PluginLink } from "@/core/ports/plugin-link.port.ts";
import { PluginSessions } from "@/server/app/sessions/plugin-sessions.ts";
import { TargetResolver } from "@/server/app/sessions/target-resolver.ts";
import { BaselineTarget } from "@/server/tools/baseline-diff/baseline-target.ts";

function file(
  session: string,
  name: string,
  extra: Partial<ConnectedFile> = {},
): ConnectedFile {
  return {
    session,
    name,
    key: null,
    page: "Start here",
    editorType: "figma",
    allowEdits: false,
    visible: true,
    active: false,
    pluginVersion: "0.8.0",
    ...extra,
  };
}

/** The file rule over the files connected now: only files() is read. */
function target(files: ConnectedFile[]): BaselineTarget {
  const link = { files: () => files } as Pick<PluginLink, "files"> as PluginLink;

  return new BaselineTarget(link, new PluginSessions(link, new TargetResolver(), []));
}

const TEST_MCP = { name: "Test MCP", key: null };

// T-207: node ids repeat across files, so a baseline is never compared in the active file by default.
describe("BaselineTarget", () => {
  it("takes the file the baseline came from by name, while another file is active", () => {
    const found = target([file("a", "Other", { active: true }), file("b", "Test MCP")]).target(TEST_MCP, undefined);

    expect([found.session.id, found.notes]).toEqual(["b", []]);
  });

  it("takes it by key first, and says a copy shares the name, not the key, when that key is not connected", () => {
    const keyed = { name: "Test MCP", key: "K1" };

    expect(target([file("a", "Test MCP"), file("b", "Copy", { key: "K1" })]).target(keyed, undefined).session.id).toBe(
      "b",
    );
    expect(() => target([file("a", "Test MCP", { key: "K2" })]).target(keyed, undefined)).toThrow(
      "Test MCP (key K1) is not connected: open it in Figma Desktop with the Pixelwright plugin; a copy shares the name, not the key.",
    );
  });

  it("refuses a name no connected file has, or two files share", () => {
    expect(() => target([file("a", "Other", { active: true })]).target(TEST_MCP, undefined)).toThrow(
      "Test MCP is not connected: open Test MCP in Figma Desktop with the Pixelwright plugin, or pass file if it was renamed.",
    );
    expect(() => target([file("a", "Test MCP"), file("b", "Test MCP")]).target(TEST_MCP, undefined)).toThrow(
      "Several connected files are named Test MCP: sessions a, b. Pass file (a session from status).",
    );
  });

  it("compares in the file given, with a note when the baseline came from another", () => {
    const files = [file("a", "Other"), file("b", "Test MCP")];

    expect(target(files).target(TEST_MCP, "other")).toMatchObject({
      session: { id: "a" },
      notes: ["Compared in Other, not Test MCP, which the baseline came from."],
    });
    expect(target(files).target(TEST_MCP, "b").notes).toEqual([]);
  });
});

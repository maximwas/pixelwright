import { describe, expect, it } from "vitest";
import { resolveTarget } from "../src/bridge/target.ts";
import type { ConnectedPlugin } from "../src/types/bridge.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const plugin = (session: string, name: string, active = false): ConnectedPlugin => ({
  session,
  info: pluginInfo({
    instanceId: session,
    file: {
      name,
      key: null,
    },
  }),
  active,
});

const files = [plugin("s1", "Positivus", true), plugin("s2", "Kit"), plugin("s3", "Kit")];

describe("resolveTarget", () => {
  it("takes the active file when none is named", () => {
    expect(resolveTarget(files)).toEqual({ session: "s1" });
  });

  it("finds a file by session id, or by name whatever the case", () => {
    expect(resolveTarget(files, "s3")).toEqual({ session: "s3" });
    expect(resolveTarget(files, "positivus")).toEqual({ session: "s1" });
  });

  it("refuses a name two files share, naming their sessions", () => {
    expect(() => resolveTarget(files, "Kit")).toThrow(expect.objectContaining({ code: "AMBIGUOUS_FILE" }));
    expect(() => resolveTarget(files, "Kit")).toThrow(/s2.*s3/);
  });

  it("says which files are connected when none matches", () => {
    expect(() => resolveTarget(files, "Brand")).toThrow(expect.objectContaining({ code: "FILE_NOT_FOUND" }));
    expect(() => resolveTarget(files, "Brand")).toThrow(/Positivus.*Kit/);
  });

  it("says no file is connected when there are none", () => {
    expect(() => resolveTarget([])).toThrow(expect.objectContaining({ code: "PLUGIN_NOT_CONNECTED" }));
  });
});

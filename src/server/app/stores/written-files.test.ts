import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import type { JsonFile } from "@/core/ports/json-file.port.ts";
import { WRITTEN_STORE } from "@/server/app/stores/stores.constants.ts";
import { WrittenFiles } from "@/server/app/stores/written-files.ts";

const PATH = "/home/written-files.json";

/** The home's JSON files in memory, each read back through its schema. */
function home(): JsonFile {
  const stored = new Map<string, unknown>();

  return {
    read: (
      path,
      schema,
      fallback,
    ) => zod.parse(schema, stored.get(path) ?? fallback),
    write: (path, value) => void stored.set(path, JSON.parse(JSON.stringify(value))),
    ensure: () => undefined,
  };
}

describe("written files", () => {
  it("shares what one instance wrote with another, a file's layers merged, the oldest forgotten past the limit (S-101)", () => {
    const json = home();

    new WrittenFiles(json, PATH).add([{ sha1: "a", node: "1:1" }]);
    new WrittenFiles(json, PATH).add([
      { sha1: "a", node: "1:2" },
      ...Array.from({ length: WRITTEN_STORE.limit - 1 }, (_slot, index) => ({ sha1: `b${index}`, node: "2:1" })),
    ]);

    const known = new WrittenFiles(json, PATH).read();

    expect(known.get("a")).toEqual(["1:1", "1:2"]);
    expect(known.size).toBe(WRITTEN_STORE.limit);

    new WrittenFiles(json, PATH).add([{ sha1: "c", node: "3:1" }]);

    const later = new WrittenFiles(json, PATH).read();

    // "a" was last written before the b files: the oldest.
    expect(later.has("a")).toBe(false);
    expect(later.has("b0")).toBe(true);
    expect(later.get("c")).toEqual(["3:1"]);
  });
});

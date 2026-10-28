import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fileStore } from "../src/assets/written-files.ts";
import { WRITTEN_FILES_LIMIT } from "../src/constants/mcp.ts";

describe("written-files.json", () => {
  it("shares what one process wrote with another, the oldest forgotten past the limit", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "pixelwright-home-")), "written-files.json");

    await fileStore(path).add([
      {
        sha1: "a",
        node: "1:1",
      },
    ]);
    await fileStore(path).add([
      {
        sha1: "a",
        node: "1:2",
      },
      ...Array.from({ length: WRITTEN_FILES_LIMIT - 1 }, (_, index) => ({
        sha1: `b${index}`,
        node: "2:1",
      })),
    ]);

    const known = await fileStore(path).read();

    expect(known.get("a")).toEqual(["1:1", "1:2"]);
    expect(known.size).toBe(WRITTEN_FILES_LIMIT);

    await fileStore(path).add([
      {
        sha1: "c",
        node: "3:1",
      },
    ]);

    const later = await fileStore(path).read();

    // "a" was last written before the b files: the oldest.
    expect(later.has("a")).toBe(false);
    expect(later.has("b0")).toBe(true);
    expect(later.get("c")).toEqual(["3:1"]);
  });

  it("keeps both entries when two adds run at once", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "pixelwright-home-")), "written-files.json");
    const store = fileStore(path);

    await Promise.all([
      store.add([
        {
          sha1: "a",
          node: "1:1",
        },
      ]),
      store.add([
        {
          sha1: "b",
          node: "2:1",
        },
      ]),
    ]);

    const known = await fileStore(path).read();

    expect(known.get("a")).toEqual(["1:1"]);
    expect(known.get("b")).toEqual(["2:1"]);
  });

  it("starts empty when the file is missing or not its own", async () => {
    expect((await fileStore(join(tmpdir(), "pixelwright-none", "written-files.json")).read()).size).toBe(0);
  });
});

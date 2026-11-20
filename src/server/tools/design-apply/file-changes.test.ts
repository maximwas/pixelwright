import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { encode } from "fast-png";
import { describe, expect, it } from "vitest";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { FileChanges } from "@/server/tools/design-apply/file-changes.ts";
import { SourceFiles } from "@/server/tools/design-apply/source-files.ts";

const folder = mkdtempSync(join(tmpdir(), "pw-file-changes-"));

mkdirSync(join(folder, "assets"));

function png(value: number): Buffer {
  return Buffer.from(encode({ width: 2, height: 2, channels: 4, depth: 8, data: new Uint8Array(16).fill(value) }));
}

const render = png(10);
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>';

writeFileSync(join(folder, "assets/photo-copy.png"), render);
writeFileSync(join(folder, "assets/other.png"), png(200));
writeFileSync(join(folder, "assets/drawn.svg"), svg);

function sha1(bytes: Buffer | string): string {
  return createHash("sha1").update(bytes).digest("hex");
}

function changes(known: Record<string, string[]> = {}): FileChanges {
  const project = { resolve: async (path: string) => resolve(folder, path), root: async () => folder };
  // A PNG as image-size reads one: the files here are 2 x 2 PNGs.
  const sniffer = { sniff: () => ({ format: "png", width: 2, height: 2 }) };
  const sources = new SourceFiles(project as never, sniffer);
  const split = new CssSplit();

  return new FileChanges(sources, { read: () => new Map(Object.entries(known)) } as never, split, new CssUrl(split));
}

function layer(
  tag: string,
  attributes: Record<string, string>,
  current: Record<string, string>,
): never {
  return {
    element: { ref: "1:1", tag, attributes },
    entry: { layer: { id: "1:1", fills: [] } },
    now: { current },
  } as never;
}

// T-132, S-101: a file design_read wrote for the layer is the layer's own render, wherever it went.
describe("FileChanges", () => {
  it("keeps an Image whose src is a known render of the layer, and changes one that holds another picture", async () => {
    const known = { [sha1(render)]: ["1:1"] };
    const same = await changes(known).of([
      layer("Image", { src: "assets/photo-copy.png" }, { src: "assets/photo.png" }),
    ]);
    const other = await changes(known).of([layer("Image", { src: "assets/other.png" }, { src: "assets/photo.png" })]);
    const background = await changes(known).of([
      layer("Frame", { background: "url(assets/other.png) center / cover no-repeat" }, {}),
    ]);

    expect(same.get("1:1")).toEqual({ changed: [], problems: [] });
    expect(other.get("1:1")).toEqual({ changed: ["src"], problems: [] });
    expect(background.get("1:1")).toEqual({ changed: ["background"], problems: [] });
  });

  // m:28fe3c6d: only the given path loses its -N; "Vector 3" and "Vector 7" never meet as vector.svg.
  it("takes a planned path with the number a read adds, and never strips a trailing -N from both sides", async () => {
    const numbered = await changes().of([
      layer("Icon", { src: "assets/vector-3-2.svg" }, { src: "assets/vector-3.svg" }),
    ]);
    const another = await changes().of([layer("Icon", { src: "assets/vector-7.svg" }, { src: "assets/vector-3.svg" })]);

    expect(numbered.get("1:1")).toEqual({ changed: [], problems: [] });
    expect(another.get("1:1")?.problems).toEqual([
      { attribute: "src", message: expect.stringContaining("assets/vector-7.svg is not a file the server can read") },
    ]);
  });

  // T-133: an existing Icon is never redrawn.
  it("refuses an Icon's src that is not a render of it", async () => {
    const drawn = await changes().of([layer("Icon", { src: "assets/drawn.svg" }, { src: "assets/icon.svg" })]);

    expect(drawn.get("1:1")?.problems).toEqual([
      { attribute: "src", message: expect.stringContaining("delete the icon and create it again from the file") },
    ]);
  });
});

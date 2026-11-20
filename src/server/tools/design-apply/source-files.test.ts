import { createHash } from "node:crypto";
import { mkdtempSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SourceFiles } from "@/server/tools/design-apply/source-files.ts";
import { UPLOAD } from "@/shared/ops/upload/upload.constants.ts";

const folder = mkdtempSync(join(tmpdir(), "pw-source-files-"));
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>';

writeFileSync(join(folder, "photo.png"), "bytes");
writeFileSync(join(folder, "drawn.svg"), svg);
writeFileSync(join(folder, "notes.txt"), "just text");
writeFileSync(join(folder, "big.png"), "");
writeFileSync(join(folder, "big.svg"), "");
// Sparse files: only their size is read, as the limit is checked before the bytes are.
truncateSync(join(folder, "big.png"), UPLOAD.maxBytes + 1);
truncateSync(join(folder, "big.svg"), 2 * 1024 * 1024 + 1);

function files(format: string | null = "png") {
  const sniff = vi.fn(() => (format === null ? null : { format, width: 2, height: 2 }));
  const project = { resolve: async (path: string) => resolve(folder, path), root: async () => folder };

  return { files: new SourceFiles(project as never, { sniff }), sniff };
}

describe("SourceFiles.read", () => {
  it("reads an image with its SHA-1, format and size, and an SVG, each file once per call", async () => {
    const { files: sources, sniff } = files();
    const reads = new Map();
    const first = await sources.read("photo.png", "image", reads);

    await sources.read("photo.png", "image", reads);
    expect(first.file?.sha1).toBe(createHash("sha1").update("bytes").digest("hex"));
    expect(first.file?.image).toEqual({ format: "png", width: 2, height: 2 });
    expect(sniff).toHaveBeenCalledTimes(1);
    expect((await sources.read("drawn.svg", "icon", reads)).file?.bytes.toString()).toBe(svg);
  });

  it("refuses an image over 32 MB and an SVG over 2 MB without reading them", async () => {
    const { files: sources } = files();
    const image = await sources.read("big.png", "image", new Map());
    const icon = await sources.read("big.svg", "icon", new Map());

    expect(image).toMatchObject({ problem: "unusable", message: expect.stringContaining("32 MB at most") });
    expect(icon).toMatchObject({ problem: "unusable", message: expect.stringContaining("2 MB at most") });
  });

  it("refuses bytes no image format knows and a file that is no SVG", async () => {
    const none = await files(null).files.read("notes.txt", "image", new Map());
    const text = await files().files.read("notes.txt", "icon", new Map());

    expect(none).toMatchObject({
      problem: "unusable",
      message: expect.stringContaining("not a PNG, JPG, GIF or WebP"),
    });
    expect(text).toMatchObject({ problem: "unusable", message: expect.stringContaining("not an SVG") });
  });

  it("says a missing file is missing, and names the project folder only for a relative path", async () => {
    const { files: sources } = files();
    const relative = await sources.read("nope.png", "image", new Map());
    const absolute = await sources.read(join(folder, "nope.png"), "image", new Map());

    expect(relative).toMatchObject({ problem: "missing", message: expect.stringContaining(folder) });
    expect(absolute).toMatchObject({ problem: "missing", message: expect.not.stringContaining("project folder") });
  });
});

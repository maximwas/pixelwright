import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DecodedPng, decode } from "fast-png";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { install } = TEST_MCP.ids;

/** A JPEG's first bytes: what a photo saved as photo.png holds. */
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

const CLIP = { x: 0, y: 0, width: 100, height: 60 };

/** One row of a PNG's pixels, from its left edge, `width` pixels long. */
const row = (
  png: DecodedPng,
  y: number,
  width: number,
) => [
  ...png.data.subarray(y * png.width * png.channels, (y * png.width + width) * png.channels),
];

// Reads only; save writes under the system's temp folder, never in the project.
describe("read/screenshot", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(() => client.close());

  const image = async (args: Record<string, unknown>): Promise<DecodedPng> => {
    const { content } = await client.blocks("screenshot", { file, node: install, ...args });
    const block = content.find(({ type }) => type === "image");

    return decode(Buffer.from(block?.data ?? "", "base64"));
  };

  it("renders the Install card at scale 2 twice its size at scale 1 (T-070)", async () => {
    const one = await image({ scale: 1, effects: false });
    const two = await image({ scale: 2, effects: false });

    expect(Math.abs(two.width - 2 * one.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(two.height - 2 * one.height)).toBeLessThanOrEqual(1);
  });

  it("clips the same pixels a crop of the whole render holds (T-073)", async () => {
    const whole = await image({ effects: false });
    const clip = await image({ effects: false, clip: CLIP });

    expect([clip.width, clip.height, clip.channels]).toEqual([CLIP.width, CLIP.height, whole.channels]);

    for (let y = 0; y < CLIP.height; y++) {
      expect(row(clip, y, CLIP.width)).toEqual(row(whole, y, CLIP.width));
    }
  });

  it("saves the PNG to a .png path and never writes over one holding JPEG bytes (T-072)", async () => {
    const folder = await mkdtemp(join(tmpdir(), "pixelwright-live-shot-"));
    const shot = join(folder, "install.png");
    const photo = join(folder, "photo.png");
    const [saved] = await client.texts("screenshot", { file, node: install, save: shot });

    expect(JSON.parse(saved ?? "")).toMatchObject({ node: install, path: shot });
    expect((await readFile(shot)).subarray(1, 4).toString()).toBe("PNG");

    await writeFile(photo, JPEG);

    const refused = await client.blocks("screenshot", { file, node: install, save: photo });

    expect(refused.isError).toBe(true);
    expect(JSON.stringify(refused.content)).toContain("exists and is not a PNG");
    expect(new Uint8Array(await readFile(photo))).toEqual(JPEG);
  });

  it("appends the layer's image to design_read when screenshot is true (T-056)", async () => {
    const { content } = await client.blocks("design_read", { file, node: install, screenshot: true });

    expect(content.map(({ type }) => type)).toEqual(["text", "text", "image", "text"]);
    expect(content[2]).toMatchObject({ mimeType: "image/png" });
  });
});

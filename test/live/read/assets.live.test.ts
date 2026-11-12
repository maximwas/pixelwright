import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode } from "fast-png";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient, type ToolResult } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { hero } = TEST_MCP.ids;

const NAME = {
  framed: "live:assets:framed",
  inner: "live:assets:inner",
  stacked: "live:assets:stacked",
  video: "live:assets:video",
} as const;

/** A 4 x 4 PNG of one red: each red is an image of its own, which Figma keeps by its hash. */
const png = (red: number) =>
  Buffer.from(
    encode({
      width: 4,
      height: 4,
      channels: 4,
      data: Uint8Array.from({ length: 64 }, (_slot, index) => (index % 4 === 0 ? red : 255)),
    }),
  );

const IMAGES = { framed: png(10), inner: png(60), bottom: png(110), top: png(160) } as const;

/** A one-frame 16 x 16 MP4 (ffmpeg, x264, no metadata): enough for Figma to make a video of. */
const MP4 =
  "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAALwbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAGQAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAj90cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAGQAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAABkAAAAAAABAAAAAAG3bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAABABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABYm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAASJzdGJsAAAAvnN0c2QAAAAAAAAAAQAAAK5hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABDExhdmMgbGlieDI2NAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAANGF2Y0MBZAAK/+EAF2dkAAqs2V7ARAAAAwAEAAADAFA8SJZYAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAAfQAAAAAAAAABhzdHRzAAAAAAAAAAEAAAABAAAEAAAAABxzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAUc3RzegAAAAAAAAAZAAAAAQAAABRzdGNvAAAAAAAAAAEAAAMgAAAAPXVkdGEAAAA1bWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAIaWxzdAAAAAhmcmVlAAAAIW1kYXQAAAAVZYiEADf//uED+BTPe/mMat1RZaZB";

type Exported = {
  files: { node: string; kind: string; format: string; path: string; planned?: string; bytes: number }[];
  notes: string[];
  errors: { node: string; kind?: string; message: string }[];
};

// Writes layers in the Live tests Section (removed after) and files under the system's temp folder only.
describe("read/assets", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;
  const made: string[] = [];

  const run = (code: string): Promise<ToolResult> => client.call("execute", { file, code });
  const exported = async (args: Record<string, unknown>): Promise<Exported> =>
    (await client.call("assets_export", { file, ...args })) as Exported;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await run(`for (const id of ${JSON.stringify(made)}) (await figma.getNodeByIdAsync(id))?.remove();`);
    await client.close();
  });

  /** Layers made by execute in the scratch Section, their ids by name. */
  const layers = async (code: string): Promise<Record<string, string>> => {
    const answer = await run(`const section = await pw.node(${JSON.stringify(scratch)});
const imageOf = (base64) => figma.createImage(figma.base64Decode(base64)).hash;
const fill = (base64) => ({ type: "IMAGE", imageHash: imageOf(base64), scaleMode: "FILL" });
${code}`);
    const ids = answer.result as Record<string, string>;

    made.push(...Object.values(ids));

    return ids;
  };

  it("lists a frame with an image fill and the image inside it once each, as placed (B-003, T-194)", async () => {
    const ids = await layers(`const framed = figma.createFrame();
framed.name = ${JSON.stringify(NAME.framed)};
framed.resize(120, 120);
framed.fills = [fill(${JSON.stringify(IMAGES.framed.toString("base64"))})];
const inner = figma.createRectangle();
inner.name = ${JSON.stringify(NAME.inner)};
inner.fills = [fill(${JSON.stringify(IMAGES.inner.toString("base64"))})];
framed.appendChild(inner);
section.appendChild(framed);
return { framed: framed.id, inner: inner.id };`);
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-live-assets-"));
    const answer = await exported({ nodes: [ids.framed, ids.inner, ids.inner], original: true, dir });

    expect(answer.errors).toEqual([]);
    expect(answer.files.map(({ node, kind, format }) => [node, kind, format])).toEqual([
      [ids.framed, "image", "PNG"],
      [ids.inner, "image", "PNG"],
    ]);
    expect(await readFile(answer.files[0]?.path ?? "")).toEqual(IMAGES.framed);
    expect(await readFile(answer.files[1]?.path ?? "")).toEqual(IMAGES.inner);
  });

  it("takes the topmost visible of two image fills and notes the other (B-004)", async () => {
    const ids = await layers(`const stacked = figma.createRectangle();
stacked.name = ${JSON.stringify(NAME.stacked)};
stacked.fills = [fill(${JSON.stringify(IMAGES.bottom.toString("base64"))}), fill(${JSON.stringify(IMAGES.top.toString("base64"))})];
section.appendChild(stacked);
return { stacked: stacked.id };`);
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-live-assets-"));
    const answer = await exported({ nodes: [ids.stacked], original: true, dir });

    expect(answer.files).toHaveLength(1);
    expect(await readFile(answer.files[0]?.path ?? "")).toEqual(IMAGES.top);
    expect(answer.notes).toEqual([expect.stringContaining(`${ids.stacked} has 1 other image fill`)]);
  });

  it("marks a video fill as a video and says to ask the designer for the file (B-001)", async () => {
    const answer = await run(`const section = await pw.node(${JSON.stringify(scratch)});
const video = await figma.createVideoAsync(figma.base64Decode(${JSON.stringify(MP4)}));
const clip = figma.createRectangle();
clip.name = ${JSON.stringify(NAME.video)};
clip.fills = [{ type: "VIDEO", videoHash: video.hash, scaleMode: "FILL" }];
section.appendChild(clip);
return clip.id;`);

    if (typeof answer.result !== "string") {
      // Q3: Figma makes videos on paid plans only; Test MCP's plan refusing one is the answer this case can pin.
      expect(answer.error).toMatch(/video|plan|upgrade/i);

      return;
    }

    made.push(answer.result);

    const dir = await mkdtemp(join(tmpdir(), "pixelwright-live-assets-"));
    const exportedVideo = await exported({ nodes: [answer.result], original: true, dir });

    expect(exportedVideo.files).toEqual([]);
    expect(exportedVideo.errors).toEqual([
      {
        node: answer.result,
        kind: "video",
        message: expect.stringContaining(
          "video fills cannot be exported through the Plugin API: ask the designer for the file",
        ),
      },
    ]);
  });

  // An agent asked from with scale 2 and got the same bytes as nodes + original: from writes image fills as placed.
  it("writes the image fills under from as placed, whatever scale says, as nodes with original does", async () => {
    const ids = await layers(`const holder = figma.createFrame();
holder.name = "live:assets:from-holder";
const photo = figma.createRectangle();
photo.name = "live:assets:from-photo";
photo.fills = [fill(${JSON.stringify(IMAGES.inner.toString("base64"))})];
holder.appendChild(photo);
section.appendChild(holder);
return { holder: holder.id, photo: photo.id };`);
    const scaled = await exported({
      from: ids.holder,
      scale: 2,
      dir: await mkdtemp(join(tmpdir(), "pixelwright-live-assets-")),
    });
    const placed = await exported({
      nodes: [ids.photo],
      original: true,
      dir: await mkdtemp(join(tmpdir(), "pixelwright-live-assets-")),
    });
    const photo = scaled.files.find(({ node }) => node === ids.photo);

    expect(photo?.kind).toBe("image");
    expect(await readFile(photo?.path ?? "")).toEqual(IMAGES.inner);
    expect(await readFile(placed.files[0]?.path ?? "")).toEqual(IMAGES.inner);
  });

  it("writes the hero's assets with assetsDir and points src at them; a second read writes nothing new (T-055)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-live-assets-"));
    const read = async () => {
      const [xml = "", json = "{}"] = await client.texts("design_read", { file, node: hero, assetsDir: dir });

      return { xml, json: JSON.parse(json) as { assets: { src?: string }[]; written?: boolean } };
    };
    const first = await read();
    const sources = first.json.assets.flatMap(({ src }) => (src === undefined ? [] : [src]));
    const files = (await readdir(dir)).sort();

    expect(sources.length).toBeGreaterThan(0);
    expect(first.json.written).toBeUndefined();

    for (const src of sources) {
      expect(src.startsWith(`${dir}/`)).toBe(true);
      expect(first.xml).toContain(`src="${src}"`);
      expect(files).toContain(src.slice(dir.length + 1));
    }

    const second = await read();

    expect(second.json.assets).toEqual(first.json.assets);
    expect((await readdir(dir)).sort()).toEqual(files);
  });

  it("says the asset names are plans when design_read writes no files (T-055)", async () => {
    const [, json = "{}"] = await client.texts("design_read", { file, node: hero });
    const parsed = JSON.parse(json) as { written?: boolean; hints: string[] };

    expect(parsed.written).toBe(false);
    expect(parsed.hints).toContainEqual(expect.stringContaining("pass assetsDir to write them"));
  });
});

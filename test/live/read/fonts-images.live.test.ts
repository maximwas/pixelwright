import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decode } from "fast-png";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient, type ToolResult } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { install, orbitPricing } = TEST_MCP.ids;

interface FontsChecked extends ToolResult {
  readonly summary: string;
  readonly fonts: { readonly family: string; readonly weights: string[]; google: boolean | null; css?: string }[];
}

interface Compared extends ToolResult {
  readonly size: { readonly node: string; readonly reference: string };
  readonly rmse: number;
  readonly different: number;
  readonly box: object | null;
  readonly diff?: string;
  readonly note?: string;
}

// Reads only; the screenshot and the difference go under the system's temp folder, never in the project.
describe("read/fonts-images", () => {
  const { file } = inject("live");
  let client: LiveClient;
  /** The Install card at scale 1, saved by screenshot. */
  let shot: string;
  let folder: string;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
    folder = await mkdtemp(join(tmpdir(), "pixelwright-compare-"));
    shot = join(folder, "install.png");
    await client.blocks("screenshot", { file, node: install, save: shot });
  });

  afterAll(() => client.close());

  const compare = async (args: Record<string, unknown>): Promise<Compared> =>
    (await client.call("image_compare", { file, node: install, ...args })) as Compared;

  // Online Google serves Inter with a css2 link; offline the fonts are still listed, google null.
  it("lists Inter with its weights on Orbit's pricing page, and whether Google Fonts serves it (T-101)", async () => {
    const result = (await client.call("fonts_check", { file, node: orbitPricing })) as FontsChecked;
    const inter = result.fonts.find(({ family }) => family === "Inter");
    const online = inter?.google === true;

    expect(inter?.weights.length).toBeGreaterThan(0);
    expect([true, null]).toContain(inter?.google);
    expect(online ? inter.css : result.summary).toMatch(
      online ? /^https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:/ : /could not be reached/,
    );
  });

  it("finds no difference between the Install card and its own screenshot (T-089)", async () => {
    expect(await compare({ reference: shot })).toMatchObject({ rmse: 0, different: 0, box: null });
  });

  it("says the sizes differ when the card renders at another scale, and compares the part both cover", async () => {
    const result = await compare({ reference: shot, scale: 0.5 });

    expect(result.size.node).not.toBe(result.size.reference);
    expect(result.note).toMatch(/^The sizes differ \(render \d+×\d+, reference \d+×\d+\)/);
  });

  it("compares the card against itself as a layer and writes the difference as a PNG of its size", async () => {
    const diff = join(folder, "diff.png");
    const result = await compare({ against: install, diff });
    const image = decode(await readFile(diff));

    expect(result).toMatchObject({ rmse: 0, different: 0, diff });
    expect(`${image.width}×${image.height}`).toBe(result.size.node);
  });

  it("asks for a PNG or another layer, one of them", async () => {
    await expect(compare({})).rejects.toThrow(/Give reference, a PNG of your build, or against/);
    await expect(compare({ reference: shot, against: install })).rejects.toThrow(/one of them/);
  });
});

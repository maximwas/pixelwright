import { expect, it } from "vitest";
import { Crop } from "@/core/images/crop.ts";
import type { ImageCodec } from "@/core/ports/image-codec.port.ts";
import type { ImageSniffer } from "@/core/ports/image-sniffer.port.ts";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { ExportPull } from "@/server/app/renders/export-pull.ts";
import { PngRender } from "@/server/app/renders/png-render.ts";
import { RenderToFit } from "@/server/app/renders/render-to-fit.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";

/** The layer's longest side in Figma px: 5000 x 5000. */
const SIDE = 5000;

/**
 * A photo-heavy 5000 x 5000 layer: the plugin fits the asked scale into maxSide as Figma's export does, and its PNG
 * takes 4 bytes a pixel plus a 3 MB part that does not shrink with the scale, so every estimate falls short.
 */
class HeavyPlugin implements PluginLink {
  readonly scales: number[] = [];

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  async state(): Promise<PluginLinkState> {
    throw new Error("only status reads the state");
  }

  role(): PluginLinkRole {
    return "owner";
  }

  files(): readonly ConnectedFile[] {
    return [];
  }

  async request({ op, input }: OpRequest): Promise<unknown> {
    const { scale, maxSide } = input as { scale: number; maxSide: number };

    if (op !== "export") {
      throw new Error("a render too heavy to return inline is never pulled");
    }

    const used = SIDE * scale <= maxSide ? scale : Math.floor((maxSide / (SIDE * scale)) * scale * 10_000) / 10_000;

    this.scales.push(scale);

    return { scale: used, totalBytes: 3_000_000 + Math.round((SIDE * used) ** 2) * 4 };
  }
}

/** Never reached: a render too heavy to return inline is never read. */
const UNREAD: ImageCodec & ImageSniffer = {
  decode: () => {
    throw new Error("never decoded");
  },
  encode: () => {
    throw new Error("never encoded");
  },
  sniff: () => {
    throw new Error("never sniffed");
  },
};

// T-071: up to three renders, each at scale x sqrt(limit / size) x 0.9 floored to 2 decimals, then RESULT_TOO_LARGE.
it("renders a 5000 x 5000 layer again at 0.9 of the estimated scale, three times at most, then says it is too large", async () => {
  const plugin = new HeavyPlugin();
  const pull = new ExportPull();
  const fit = new RenderToFit(pull, new PngRender(pull, UNREAD, UNREAD, new Crop()));

  await expect(
    fit.inline(new PluginSession("s1", plugin, []), { node: "1:1", scale: 1, effects: true }),
  ).rejects.toThrow(/1:1 renders to 4 MB even at scale 0\.11, too much to return inline/);
  expect(plugin.scales).toEqual([1, 0.15, 0.11]);
});

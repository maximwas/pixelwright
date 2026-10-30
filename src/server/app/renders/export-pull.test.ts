import { describe, expect, it } from "vitest";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { ExportPull } from "@/server/app/renders/export-pull.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";

type Chunk = (bytes: Uint8Array, offset: number, length: number) => { totalBytes: number; bytes: string };

const slice: Chunk = (
  bytes,
  offset,
  length,
) => ({
  totalBytes: bytes.length,
  bytes: Buffer.from(bytes.subarray(offset, offset + length)).toString("base64"),
});

/** A plugin that renders `image` for an export and hands it out in chunks, each answered by `chunk`. */
class ExportingPlugin implements PluginLink {
  readonly asked: { op: string; input: Record<string, unknown> }[] = [];
  readonly #image: Uint8Array;
  readonly #chunk: Chunk;

  constructor(image: Uint8Array, chunk: Chunk = slice) {
    this.#image = image;
    this.#chunk = chunk;
  }

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
    const asked = input as { offset: number; length: number };

    this.asked.push({ op, input: input as Record<string, unknown> });

    return op === "export"
      ? { scale: 1, totalBytes: this.#image.length }
      : this.#chunk(this.#image, asked.offset, asked.length);
  }
}

const REQUEST = { node: "2:4868", format: "PNG", scale: 1, effects: true } as const;

const pulled = (plugin: ExportingPlugin) => new ExportPull().render(new PluginSession("s1", plugin, []), REQUEST);

describe("export bytes (T-075, S-006)", () => {
  it("puts an export bigger than one chunk back together, every part asked under the export's own stream", async () => {
    const image = Uint8Array.from({ length: LIMITS.exportChunkBytes * 2 + 5 }, (_value, index) => index % 251);
    const plugin = new ExportingPlugin(image);
    const { bytes } = await pulled(plugin);
    const streams = new Set(plugin.asked.map(({ input }) => input.stream));

    expect(plugin.asked.map(({ op, input }) => [op, input.offset])).toEqual([
      ["export", undefined],
      ["chunk", 0],
      ["chunk", LIMITS.exportChunkBytes],
      ["chunk", LIMITS.exportChunkBytes * 2],
    ]);
    expect(streams.size).toBe(1);
    expect(Buffer.from(bytes).equals(Buffer.from(image))).toBe(true);
  });

  it("fails when the total changes between chunks, or a chunk comes empty", async () => {
    const image = new Uint8Array(LIMITS.exportChunkBytes + 1);
    const changed: Chunk = (
      bytes,
      offset,
      length,
    ) => ({
      ...slice(bytes, offset, length),
      totalBytes: bytes.length + offset,
    });
    const empty: Chunk = (
      bytes,
      offset,
      length,
    ) =>
      offset === 0 ? slice(bytes, offset, length) : { totalBytes: bytes.length, bytes: "" };

    await expect(pulled(new ExportingPlugin(image, changed))).rejects.toThrow(
      /2:4868 changed while it was being exported/,
    );
    await expect(pulled(new ExportingPlugin(image, empty))).rejects.toThrow(/empty part of 2:4868's export/);
  });
});

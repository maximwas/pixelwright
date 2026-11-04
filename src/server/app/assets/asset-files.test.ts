import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { expect, it } from "vitest";
import * as zod from "zod/mini";
import type { PlannedFile } from "@/core/design/assets/assets.types.ts";
import type { JsonFile } from "@/core/ports/json-file.port.ts";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { AssetFiles } from "@/server/app/assets/asset-files.ts";
import { AssetWriter } from "@/server/app/assets/asset-writer.ts";
import { ProjectFolder } from "@/server/app/project/project-folder.ts";
import { ExportPull } from "@/server/app/renders/export-pull.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { WrittenFiles } from "@/server/app/stores/written-files.ts";

/** The home's JSON files in memory. */
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

/** A plugin that renders each layer as one byte of its own, and counts the files in `folder` at every export asked. */
class RenderingPlugin implements PluginLink {
  readonly filesAtExport: number[] = [];
  readonly #folder: string;
  #bytes = new Uint8Array();

  constructor(folder: string) {
    this.#folder = folder;
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
    if (op === "export") {
      const { node } = input as { node: string };

      this.filesAtExport.push((await readdir(this.#folder).catch(() => [])).length);
      this.#bytes = Uint8Array.from([0x89, node.length, node.charCodeAt(node.length - 1)]);

      return { scale: 1, totalBytes: this.#bytes.length };
    }

    return { totalBytes: this.#bytes.length, bytes: Buffer.from(this.#bytes).toString("base64") };
  }
}

const asset = (node: string, name: string): PlannedFile => ({
  node,
  kind: "image",
  format: "PNG",
  src: `assets/${name}`,
});

// O-014: assets_export holds one asset's bytes at a time, not every asset's before the first is written.
it("writes each asset before it fetches the next", async () => {
  const folder = await mkdtemp(join(tmpdir(), "pixelwright-asset-files-"));
  const plugin = new RenderingPlugin(folder);
  const writer = new AssetWriter({ sniff: () => null }, new WrittenFiles(home(), "/home/written-files.json"));
  const files = new AssetFiles(
    new ProjectFolder({ uris: async () => [] }, folder),
    new ExportPull(),
    { encode: async (png) => png },
    writer,
  );
  const session = new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", plugin, []);
  const { written, errors } = await files.write(
    session,
    [asset("1:1", "a.png"), asset("1:2", "b.png"), asset("1:3", "c.png")],
    folder,
  );

  expect(errors).toEqual([]);
  expect(written.map(({ path }) => basename(path))).toEqual(["a.png", "b.png", "c.png"]);
  expect(plugin.filesAtExport).toEqual([0, 1, 2]);
});

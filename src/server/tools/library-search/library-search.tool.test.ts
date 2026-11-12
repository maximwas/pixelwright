import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { Slug } from "@/core/kernel/names/slug.ts";
import type { JsonFile } from "@/core/ports/json-file.port.ts";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { LibraryStore } from "@/server/app/stores/library-store.ts";
import { LibrarySearchTool } from "@/server/tools/library-search/library-search.tool.ts";

const SESSION = "6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13";

/** The home's JSON files on disk, each read back through its schema: the store lists its folder. */
class DiskJson implements JsonFile {
  read<Schema extends zod.ZodMiniType>(
    path: string,
    schema: Schema,
    fallback: zod.output<Schema>,
  ): zod.output<Schema> {
    try {
      const parsed = zod.safeParse(schema, JSON.parse(readFileSync(path, "utf8")));

      return parsed.success ? parsed.data : fallback;
    } catch {
      return fallback;
    }
  }

  write(path: string, value: unknown): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value));
  }

  ensure(): void {}
}

/** A plugin in a file of this name whose components op answers with these components, the requests it got kept. */
class LibraryPlugin implements PluginLink {
  readonly requests: unknown[] = [];
  readonly #name: string;
  readonly #components: unknown[];
  readonly #extra: Record<string, unknown>;

  constructor(
    name: string,
    components: unknown[],
    extra: Record<string, unknown> = {},
  ) {
    this.#name = name;
    this.#components = components;
    this.#extra = extra;
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
    return [
      {
        session: SESSION,
        name: this.#name,
        key: null,
        page: "Components",
        editorType: "figma",
        allowEdits: false,
        visible: true,
        active: true,
        pluginVersion: "0.8.0",
      },
    ];
  }

  async request({ input }: OpRequest): Promise<unknown> {
    this.requests.push(input);

    return { components: this.#components, more: false, ...this.#extra };
  }
}

/** A component as the plugin lists a file's own. */
const entry = (
  name: string,
  key: string,
  extra: Record<string, unknown> = {},
) => ({
  id: `1:${key}`,
  key,
  type: "COMPONENT",
  name,
  page: "Components",
  remote: false,
  properties: {},
  ...extra,
});

const BUTTON = entry("Button", "k-button", {
  type: "COMPONENT_SET",
  description: "Primary actions",
  variants: [{ id: "1:10", name: "State=Default" }],
  properties: { State: { type: "VARIANT", default: "Default", options: ["Default", "Hover"] } },
});

/** library_search in a file of this name, its catalogues in this folder. */
function search(
  folder: string,
  name: string,
  components: unknown[] = [],
) {
  const plugin = new LibraryPlugin(name, components);
  const store = new LibraryStore(new DiskJson(), folder, new Slug());
  const clock = { now: () => Date.parse("2026-11-04T10:00:00.000Z") };

  return { plugin, tool: new LibrarySearchTool(new PluginSession(SESSION, plugin, []), plugin, store, clock) };
}

const folder = () => mkdtemp(join(tmpdir(), "pixelwright-libraries-"));

// T-193: a library file saves its own components on this computer; a query from any file finds them.
describe("library_search", () => {
  it("saves a library file's own published components under its name, leaving out those Figma does not publish", async () => {
    const dir = await folder();
    const { plugin, tool } = search(dir, "Orbit DS", [
      BUTTON,
      entry(".Base", "k-base"),
      entry("_Helper", "k-helper"),
      entry("Badge", "k-badge"),
    ]);

    const answer = (await tool.execute({ save: true })).structuredContent;
    const stored = JSON.parse(await readFile(join(dir, "orbit-ds.json"), "utf8"));

    expect(plugin.requests).toEqual([{ scope: "local", limit: 500, links: false }]);
    expect(answer).toMatchObject({
      saved: { library: "Orbit DS", path: join(dir, "orbit-ds.json"), components: 2 },
      libraries: [{ name: "Orbit DS", components: 2, savedAt: "2026-11-04T10:00:00.000Z" }],
    });
    expect(stored).toEqual({
      pixelwrightLibrary: 1,
      name: "Orbit DS",
      key: null,
      savedAt: "2026-11-04T10:00:00.000Z",
      components: [
        {
          key: "k-button",
          type: "COMPONENT_SET",
          name: "Button",
          page: "Components",
          description: "Primary actions",
          properties: BUTTON.properties,
        },
        { key: "k-badge", type: "COMPONENT", name: "Badge", page: "Components", properties: {} },
      ],
    });
  });

  it("finds components across the saved libraries by words in any order, a typo too, with the key design_apply inserts", async () => {
    const dir = await folder();

    await search(dir, "Orbit DS", [BUTTON, entry("Badge", "k-badge")]).tool.execute({ save: true });
    await search(dir, "Icons", [entry("Arrow right", "k-arrow")]).tool.execute({ save: true });

    const { tool, plugin } = search(dir, "Product");
    const hover = (await tool.execute({ query: "hover button" })).structuredContent as Record<string, unknown>;
    const arrow = (await tool.execute({ query: "arow" })).structuredContent as { components: { component: string }[] };

    expect(plugin.requests).toEqual([]);
    expect(hover.components).toEqual([
      {
        library: "Orbit DS",
        component: "key:k-button",
        type: "COMPONENT_SET",
        name: "Button",
        page: "Components",
        description: "Primary actions",
        properties: BUTTON.properties,
      },
    ]);
    expect(hover.more).toBe(false);
    expect(arrow.components.map(({ component }) => component)).toEqual(["key:k-arrow"]);
    expect((hover.libraries as { name: string }[]).map(({ name }) => name)).toEqual(["Icons", "Orbit DS"]);
  });

  it("says how to save a library when none is saved, and names a catalogue it cannot read", async () => {
    const dir = await folder();
    const { tool } = search(dir, "Product");

    const empty = (await tool.execute({ query: "button" })).structuredContent as {
      components: unknown[];
      notes: string[];
    };

    await writeFile(join(dir, "broken.json"), "{");

    const broken = (await tool.execute({ query: "button" })).structuredContent as { notes: string[] };

    expect(empty.components).toEqual([]);
    expect(empty.notes.join(" ")).toMatch(/save: true/);
    expect(broken.notes.join(" ")).toContain(join(dir, "broken.json"));
  });
});

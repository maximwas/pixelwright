import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { ProjectFolder } from "@/server/app/project/project-folder.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { ComponentsReadOutputSchema } from "@/server/tools/components-read/components-read.schema.ts";
import { ComponentsReadTool } from "@/server/tools/components-read/components-read.tool.ts";
import { LinkPaths } from "@/server/tools/components-read/link-paths.ts";

/** A plugin whose components op answers this, the requests it got kept. */
class ComponentsPlugin implements PluginLink {
  readonly requests: { op: string; input: unknown }[] = [];
  readonly #answer: unknown;

  constructor(answer: unknown) {
    this.#answer = answer;
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
    this.requests.push({ op, input });

    return this.#answer;
  }
}

/** A component as the plugin lists it. */
const entry = (
  id: string,
  name: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  key: `k-${id}`,
  type: "COMPONENT_SET",
  name,
  page: "Components",
  remote: false,
  properties: {},
  ...extra,
});

async function tool(answer: unknown) {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-components-"));
  const plugin = new ComponentsPlugin(answer);
  const session = new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", plugin, []);
  const project = new ProjectFolder({ uris: async () => [] }, root);

  return { root, plugin, read: new ComponentsReadTool(session, project, new LinkPaths()) };
}

// T-190: the plugin lists, the server keeps the fields asked for and puts what was not read into notes.
describe("the components_read tool", () => {
  it("asks the components op, keeps only the fields asked for, and notes a page Figma could not load", async () => {
    const { plugin, read } = await tool({
      components: [
        entry("3:1", "icon/Bell", { description: "Bell", variants: [{ id: "3:2", name: "weight=Fill" }] }),
        entry("3:3", "icon/Plus"),
      ],
      more: false,
      pagesNotRead: [{ name: "Archive", error: "offline" }],
    });
    const answer = (await read.execute({ scope: "local", query: "icon/", fields: ["id", "name", "description"] }))
      .structuredContent;

    expect(plugin.requests).toEqual([
      { op: "components", input: { scope: "local", query: "icon/", limit: 100, links: false } },
    ]);
    expect(answer).toEqual({
      components: [
        { id: "3:1", name: "icon/Bell", description: "Bell" },
        { id: "3:3", name: "icon/Plus" },
      ],
      more: false,
      notes: ["The page Archive could not be read (offline): its components are not listed."],
    });
    expect(ComponentsReadOutputSchema.parse(answer)).toEqual(answer);
  });

  it("passes Dev Mode links on with the project file a code link points at, and Figma's note (T-192)", async () => {
    const note =
      "Dev Mode links were read for the first 25 components only: ask with query or a smaller limit for the rest.";
    const { root, read } = await tool({
      components: [
        entry("1:1", "Card", {
          links: [
            { name: "Code", url: "https://github.com/acme/site/blob/feature/new-card/src/ui/Card.tsx#L12" },
            { name: "Stories", url: "https://storybook.acme.dev/?path=/story/card" },
          ],
        }),
      ],
      more: false,
      linksNote: note,
    });

    await mkdir(join(root, "src/ui"), { recursive: true });
    await writeFile(join(root, "src/ui/Card.tsx"), "");

    const answer = (await read.execute({ links: true })).structuredContent as {
      components: { links?: unknown }[];
      notes?: string[];
    };

    expect(answer.components[0]?.links).toEqual([
      {
        name: "Code",
        url: "https://github.com/acme/site/blob/feature/new-card/src/ui/Card.tsx#L12",
        path: "src/ui/Card.tsx",
      },
      { name: "Stories", url: "https://storybook.acme.dev/?path=/story/card" },
    ]);
    expect(answer.notes).toEqual([note]);
  });
});

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { linkPath } from "../src/features/components-read/link-paths.ts";
import { readComponents } from "../src/features/components-read/read-components.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const BODY = "import figma from 'figma'\nexport default { example: figma.code`<X />` }\n";

/** A component as the plugin lists it. */
const entry = (id: string, name: string, key: string, extra: Record<string, unknown> = {}) => ({
  id,
  key,
  type: "COMPONENT",
  name,
  page: "Components",
  remote: false,
  properties: {},
  ...extra,
});

/** A plugin answering components with these entries, recording what it was asked. */
function plugin(answer: Record<string, unknown>) {
  const asked: Record<string, unknown>[] = [];
  const bridge: BridgeView = {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins: () => [
      {
        session: "s1",
        info: pluginInfo({}),
        active: true,
      },
    ],
    request: async (op, input) => {
      if (op !== "components") {
        throw new Error(`unexpected ${op}`);
      }

      asked.push(input as Record<string, unknown>);

      return answer;
    },
  };

  return {
    client: new PluginClient(bridge),
    asked,
  };
}

async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-components-"));

  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }

  return root;
}

describe("components_read with the project's code", () => {
  it("gives each component the connection that builds it, with its source, or null", async () => {
    const root = await project({
      "src/components/PlanCard.tsx": "export {}",
      "PlanCard.figma.ts": `// key=k-card\n// component=PlanCard\n// source=src/components/PlanCard.tsx\n${BODY}`,
      "Badge.figma.ts": `// key=k-badge\n// source=src/Badge.tsx\n${BODY}`,
    });
    const { client } = plugin({
      components: [
        entry("1:1", "Plan Card", "k-card"),
        entry("1:2", "Badge", "k-badge"),
        entry("1:3", "Button", "k-button"),
      ],
      more: false,
    });
    const answer = await readComponents(
      client,
      {
        scope: "local",
        limit: 100,
        links: false,
      },
      root,
    );

    expect(answer.components.map(({ name, code }) => [name, code])).toEqual([
      [
        "Plan Card",
        {
          component: "PlanCard",
          source: "src/components/PlanCard.tsx",
          template: "PlanCard.figma.ts",
          by: "key",
        },
      ],
      [
        "Badge",
        {
          component: "Badge",
          source: "src/Badge.tsx",
          missing: true,
          template: "Badge.figma.ts",
          by: "key",
        },
      ],
      ["Button", null],
    ]);
    // Key-only connections work here; Figma's CLI needs their url to publish them.
    expect(answer.notes).toEqual([
      expect.stringMatching(/^Code Connect: Badge\.figma\.ts: no url/),
      expect.stringMatching(/^Code Connect: PlanCard\.figma\.ts: no url/),
    ]);
  });

  it("lists only the components without code (or with it), asking the plugin for 500 and cutting to the limit", async () => {
    const root = await project({ "Card.figma.ts": `// key=k-0\n${BODY}` });
    const { client, asked } = plugin({
      components: Array.from({ length: 5 }, (_, at) => entry(`1:${at}`, `C${at}`, `k-${at}`)),
      more: false,
    });
    const answer = await readComponents(
      client,
      {
        scope: "used",
        limit: 2,
        links: false,
        mapped: false,
      },
      root,
    );

    expect(asked[0]).toMatchObject({ limit: 500 });
    expect(answer.components.map(({ name }) => name)).toEqual(["C1", "C2"]);
    expect(answer.more).toBe(true);
    expect(
      (
        await readComponents(
          client,
          {
            scope: "used",
            limit: 2,
            links: false,
            mapped: true,
          },
          root,
        )
      ).components,
    ).toHaveLength(1);
  });

  it("passes the links on with the project file a code link points at, and Figma's note", async () => {
    const root = await project({ "src/ui/Card.tsx": "export {}" });
    const { client } = plugin({
      components: [
        entry("1:1", "Card", "k", {
          links: [
            {
              name: "Code",
              url: "https://github.com/acme/site/blob/feature/new-card/src/ui/Card.tsx#L12",
            },
            {
              name: "Stories",
              url: "https://storybook.acme.dev/?path=/story/card",
            },
          ],
        }),
      ],
      more: false,
      linksRead: true,
      linksNote:
        "Dev Mode links were read for the first 25 components only: ask with query or a smaller limit for the rest.",
    });
    const answer = await readComponents(
      client,
      {
        scope: "local",
        limit: 100,
        links: true,
      },
      root,
    );

    expect(answer.components[0]?.links).toEqual([
      {
        name: "Code",
        url: "https://github.com/acme/site/blob/feature/new-card/src/ui/Card.tsx#L12",
        path: "src/ui/Card.tsx",
      },
      {
        name: "Stories",
        url: "https://storybook.acme.dev/?path=/story/card",
      },
    ]);
    expect(answer.notes).toEqual([
      "Dev Mode links were read for the first 25 components only: ask with query or a smaller limit for the rest.",
    ]);
  });

  it("says when the plugin is too old to read links, and carries the Code Connect problems", async () => {
    const root = await project({ "Broken.figma.ts": `// url=not a link\n${BODY}` });
    const { client } = plugin({
      components: [],
      more: false,
    });
    const answer = await readComponents(
      client,
      {
        scope: "local",
        limit: 100,
        links: true,
      },
      root,
    );

    expect(answer.notes).toEqual([
      expect.stringMatching(/^Code Connect: Broken\.figma\.ts: its url= is not a Figma link/),
      "The Pixelwright plugin in this file is older than the server and reads no Dev Mode links: update it (npx -y pixelwright@latest).",
    ]);
  });
});

describe("linkPath", () => {
  it("turns GitHub, GitLab and Bitbucket blob links and vscode links into project files", async () => {
    const root = await project({
      "src/Card.tsx": "",
      "packages/ui/Button.tsx": "",
    });

    expect(await linkPath("https://github.com/acme/site/blob/main/src/Card.tsx", root)).toBe("src/Card.tsx");
    expect(await linkPath("https://gitlab.com/acme/site/-/blob/release/2.0/src/Card.tsx#L4-8", root)).toBe(
      "src/Card.tsx",
    );
    expect(await linkPath("https://bitbucket.org/acme/site/src/main/packages/ui/Button.tsx?at=main", root)).toBe(
      "packages/ui/Button.tsx",
    );
    expect(await linkPath(`vscode://file${join(root, "src/Card.tsx")}:12:4`, root)).toBe("src/Card.tsx");
  });

  it("gives nothing for a link that escapes the project or does not decode, and never throws", async () => {
    const root = await project({ "src/Card.tsx": "" });
    const up = "..%2F".repeat(20);

    expect(await linkPath(`https://github.com/o/r/blob/main/${up}etc%2Fhosts`, root)).toBeUndefined();
    expect(await linkPath("https://github.com/acme/ui/blob/main/docs/50%off.md", root)).toBeUndefined();
    expect(await linkPath("vscode://file/Users/x/100%.tsx", root)).toBeUndefined();
  });

  it("gives nothing for a file outside the project, one that is not there, or a link to no repository file", async () => {
    const root = await project({ "src/Card.tsx": "" });

    expect(await linkPath("vscode://file/etc/hosts", root)).toBeUndefined();
    expect(await linkPath("https://github.com/acme/site/blob/main/src/Gone.tsx", root)).toBeUndefined();
    expect(await linkPath("https://storybook.acme.dev/?path=/story/card", root)).toBeUndefined();
    expect(await linkPath("not a url", root)).toBeUndefined();
  });
});

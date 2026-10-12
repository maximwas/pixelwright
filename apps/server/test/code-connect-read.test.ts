/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are template sources, their ${} the templates own. */
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readCodeConnect } from "../src/mcp/tools/code-connect.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const ROW = JSON.parse(
  await readFile(new URL("../../../packages/core/test/fixtures/positivus-services-row.json", import.meta.url), "utf8"),
) as unknown;

const HEADING =
  "// url=https://www.figma.com/design/KIT/Kit?node-id=9-9\n// component=Heading\nimport figma from 'figma'\nexport default { example: figma.code`<Heading tone=\"${figma.selectedInstance.getEnum('Property 1', { Green: 'green' })}\" />` }\n";

/** The Positivus Services row as the page, and which node each snapshot asked for. */
function positivus() {
  const asked: unknown[] = [];
  const bridge: BridgeView = {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins: () => [
      {
        session: "s1",
        info: pluginInfo({
          page: {
            id: "0:1",
            name: "Landing",
          },
        }),
        active: true,
      },
    ],
    request: async (op, input) => {
      if (op !== "snapshot") {
        throw new Error(`unexpected ${op}`);
      }

      asked.push(input);

      return ROW;
    },
  };

  return {
    bridge,
    asked,
  };
}

async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-cc-read-"));

  for (const [name, text] of Object.entries(files)) {
    await writeFile(join(root, name), text);
  }

  return root;
}

describe("code_connect_read", () => {
  it("lists the templates with what they match on the page, and the components that have none", async () => {
    const root = await project({
      "Heading.figma.ts": HEADING,
      "Ghost.figma.ts":
        "// url=https://www.figma.com/design/KIT/Kit?node-id=9-10\nimport figma from 'figma'\nexport default { example: figma.code`<Ghost />` }\n",
    });
    const { bridge, asked } = positivus();

    expect(await readCodeConnect(bridge, {}, root)).toEqual({
      root,
      templates: [
        {
          path: "Ghost.figma.ts",
          url: "https://www.figma.com/design/KIT/Kit?node-id=9-10",
          matches: [],
        },
        {
          path: "Heading.figma.ts",
          url: "https://www.figma.com/design/KIT/Kit?node-id=9-9",
          component: "Heading",
          matches: [
            {
              component: "Heading",
              instances: 2,
            },
          ],
        },
      ],
      unconnected: [
        {
          component: "Link",
          instances: 2,
        },
      ],
      problems: [],
    });
    // The current page, read without Figma's CSS.
    expect(asked).toEqual([
      {
        node: "0:1",
        css: "none",
      },
    ]);
  });

  it("gives a template's error from a trial run on the first instance it matches", async () => {
    const root = await project({ "Heading.figma.ts": HEADING.replace("'Property 1'", "'Tone'") });
    const { templates } = await readCodeConnect(positivus().bridge, { node: "2:4869" }, root);

    expect(templates[0]?.error).toMatch(/^PROPERTY_NOT_FOUND: Heading \(2:4872\) has no property Tone/);
  });

  it("says why when the project has no templates", async () => {
    const root = await project({ "README.md": "hi" });

    expect(await readCodeConnect(positivus().bridge, {}, root)).toMatchObject({
      templates: [],
      unconnected: [
        {
          component: "Heading",
          instances: 2,
        },
        {
          component: "Link",
          instances: 2,
        },
      ],
      problems: [expect.stringMatching(/^No Code Connect templates/)],
    });
  });
});

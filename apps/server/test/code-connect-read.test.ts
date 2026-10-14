/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are template sources, their ${} the templates own. */
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readCodeConnect } from "../src/features/code-connect-read/read-code-connect.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const ROW = JSON.parse(
  await readFile(new URL("../../../packages/core/test/fixtures/orbit-plans.json", import.meta.url), "utf8"),
) as unknown;

const PLAN_CARD =
  "// url=https://www.figma.com/design/KIT/Kit?node-id=9-9\n// component=Plan Card\nimport figma from 'figma'\nexport default { example: figma.code`<PlanCard name=\"${figma.selectedInstance.getString('Name')}\" />` }\n";

/** The Orbit Plans row as the page, and which node each snapshot asked for. */
function orbit() {
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
      "PlanCard.figma.ts": PLAN_CARD,
      "Ghost.figma.ts":
        "// url=https://www.figma.com/design/KIT/Kit?node-id=9-10\nimport figma from 'figma'\nexport default { example: figma.code`<Ghost />` }\n",
    });
    const { bridge, asked } = orbit();

    expect(await readCodeConnect(new PluginClient(bridge), {}, root)).toEqual({
      root,
      templates: [
        {
          path: "Ghost.figma.ts",
          url: "https://www.figma.com/design/KIT/Kit?node-id=9-10",
          matches: [],
        },
        {
          path: "PlanCard.figma.ts",
          url: "https://www.figma.com/design/KIT/Kit?node-id=9-9",
          component: "Plan Card",
          matches: [
            {
              component: "Plan Card",
              instances: 3,
            },
          ],
        },
      ],
      unconnected: [
        {
          component: "Button",
          instances: 3,
        },
        {
          component: "Icon/Check",
          instances: 9,
        },
        {
          component: "Badge",
          instances: 1,
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
    const root = await project({ "PlanCard.figma.ts": PLAN_CARD.replace("getString('Name')", "getString('Title')") });
    const { templates } = await readCodeConnect(new PluginClient(orbit().bridge), { node: "54:243" }, root);

    expect(templates[0]?.error).toMatch(/^PROPERTY_NOT_FOUND: Plan – Starter \(54:244\) has no property Title/);
  });

  it("says why when the project has no templates", async () => {
    const root = await project({ "README.md": "hi" });

    expect(await readCodeConnect(new PluginClient(orbit().bridge), {}, root)).toMatchObject({
      templates: [],
      unconnected: [
        {
          component: "Plan Card",
          instances: 3,
        },
        {
          component: "Button",
          instances: 3,
        },
        {
          component: "Icon/Check",
          instances: 9,
        },
        {
          component: "Badge",
          instances: 1,
        },
      ],
      problems: [expect.stringMatching(/^No Code Connect templates/)],
    });
  });
});

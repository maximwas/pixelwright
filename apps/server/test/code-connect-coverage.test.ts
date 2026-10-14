/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are template sources, their ${} the templates own. */
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { SnapshotNode } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { readCodeConnect } from "../src/features/code-connect-read/read-code-connect.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const PLANS = await readFile(new URL("../../../packages/core/test/fixtures/orbit-plans.json", import.meta.url), "utf8");
const PLAN_CARD_KEY = "2f31fdc95b9804804df14c93a7f9c8913d611c17";
const ICON_KEY = "778d139f52be557106d2db2a415cebc8ba2197b0";

/** The Orbit Plans row, changed by a test; the plugin answers the snapshot, and the components op when asked. */
function orbit(change: (find: (id: string) => SnapshotNode) => void = () => {}) {
  const row = JSON.parse(PLANS) as { root: SnapshotNode };
  const find = (id: string, node = row.root): SnapshotNode =>
    node.id === id
      ? node
      : ((node.children ?? []).map((child) => find(id, child)).find((found) => found !== undefined) as SnapshotNode);
  const asked: string[] = [];

  change(find);

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
      asked.push(op);

      if (op === "components") {
        return {
          components: [
            {
              id: "54:201",
              key: "k-button",
              type: "COMPONENT_SET",
              name: "Button",
              page: "Components",
              remote: false,
              properties: {
                State: {
                  type: "VARIANT",
                  default: "Default",
                  options: ["Default", "Hover", "Disabled"],
                },
              },
            },
          ],
          more: false,
        };
      }

      // The snapshot of the layer asked for, as the plugin reads it.
      const node = (input as { node?: string }).node;

      return {
        ...row,
        root: node === undefined ? row.root : (find(node) ?? row.root),
      };
    },
  };

  return {
    plugin: new PluginClient(bridge),
    asked,
  };
}

async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-coverage-"));

  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }

  return root;
}

const card = (body: string, comments = `// key=${PLAN_CARD_KEY}\n// component=PlanCard`) =>
  `${comments}\nimport figma from 'figma'\nconst card = figma.selectedInstance\n${body}`;

describe("what a template's code leaves out", () => {
  it("names the card's own properties its code never reads, and counts a text it writes from the layer as read", async () => {
    const root = await project({
      "PlanCard.figma.ts": card(
        "export default { example: figma.tsx`<PlanCard name=\"${card.getString('Name')}\">${card.findText('Description').textContent}</PlanCard>` }",
      ),
    });
    const { templates } = await readCodeConnect(orbit().plugin, { node: "54:244" }, root);

    expect(templates[0]?.unread).toEqual(["Price", "Popular"]);
  });

  it("still names what the code never read when it asked for a property the card does not have", async () => {
    const root = await project({
      "PlanCard.figma.ts": card(
        "const missing = card.getPropertyValue('Titel')\nexport default { example: figma.tsx`<PlanCard name=\"${card.getString('Name')}\" />` }",
      ),
    });
    const { templates } = await readCodeConnect(orbit().plugin, { node: "54:244" }, root);

    expect(templates[0]?.unread).toEqual(["Price", "Popular", "Description"]);
  });

  it("names the properties of a nested instance the card exposes, or whose properties it overrides", async () => {
    const root = await project({
      "PlanCard.figma.ts": card(
        "export default { example: figma.tsx`<PlanCard ${card.getString('Name')} ${card.getString('Price')} ${card.getBoolean('Popular')} ${card.getString('Description')} />` }",
      ),
    });
    const { plugin } = orbit((find) => {
      (find("I54:268;54:205").instance as { exposed?: true }).exposed = true;
      find("I54:244;54:211").overrides = ["componentProperties"];
    });

    expect((await readCodeConnect(plugin, { node: "54:268" }, root)).templates[0]?.unread).toEqual(["Badge.Label"]);
    expect((await readCodeConnect(plugin, { node: "54:244" }, root)).templates[0]?.unread).toEqual([
      "Button.Label",
      "Button.Variant",
      "Button.State",
    ]);
  });

  it("names the variant values a getEnum mapping misses, from one components read", async () => {
    const root = await project({
      "PlanCard.figma.ts": card(
        "const state = card.findInstance('Button').getEnum('State', { Default: 'default', Hover: 'hover' })\nexport default { example: figma.tsx`<PlanCard state=\"${state}\" />` }",
      ),
    });
    const { plugin, asked } = orbit();
    const { templates } = await readCodeConnect(plugin, { node: "54:244" }, root);

    expect(templates[0]?.values).toEqual({ "Button.State": ["Disabled"] });
    expect(asked.filter((op) => op === "components")).toHaveLength(1);
  });
});

describe("code_connect_read's connections", () => {
  it("says how each matched, lists only the batch rows used, and a batch file with none once", async () => {
    const root = await project({
      "ui/component.figma.batch.ts":
        "import figma from 'figma'\nexport default { example: figma.code`<${figma.batch.component} />` }\n",
      "ui/rows.figma.batch.json": JSON.stringify({
        templateFile: "./component.figma.batch.ts",
        components: [
          {
            key: "k-unused",
            component: "Unused",
          },
          {
            key: ICON_KEY,
            component: "CheckIcon",
            source: "lucide-react",
          },
        ],
      }),
      "ui/other.figma.batch.json": JSON.stringify({
        templateFile: "./component.figma.batch.ts",
        components: [
          {
            key: "k-none",
            component: "None",
          },
        ],
      }),
      "PlanCard.figma.ts": card("export default { example: figma.tsx`<PlanCard />` }"),
    });
    const { templates, unconnected } = await readCodeConnect(orbit().plugin, {}, root);

    expect(templates.map(({ path, matches }) => [path, matches])).toEqual([
      [
        "PlanCard.figma.ts",
        [
          {
            component: "Plan Card",
            instances: 3,
            by: "key",
          },
        ],
      ],
      ["ui/other.figma.batch.json", []],
      ["ui/rows.figma.batch.json", []],
    ]);
    // Icon/Check sits inside the connected cards: it shows in no read as a layer, so no row of rows is used here.
    expect(unconnected).toEqual([]);
  });

  it("says how each instance matched, apart, when one component name matched two ways", async () => {
    const root = await project({
      "PlanCard.figma.ts":
        "// url=https://www.figma.com/design/KIT/Orbit?node-id=54-202\n// component=Plan Card\nimport figma from 'figma'\nexport default { example: figma.code`<PlanCard />` }\n",
    });
    // The Pro card from a library: another id, so only its name matches.
    const { plugin } = orbit((find) => {
      Object.assign(find("54:268").instance as object, {
        componentId: "77:1",
        remote: true,
      });
    });
    const { templates } = await readCodeConnect(plugin, { node: "54:243" }, root);

    expect(templates[0]?.matches).toEqual([
      {
        component: "Plan Card",
        instances: 2,
        by: "id",
      },
      {
        component: "Plan Card",
        instances: 1,
        by: "name",
      },
    ]);
  });

  it("gives each unconnected component's id, key and library, and counts only instances shown as layers", async () => {
    const root = await project({
      "rows.figma.batch.json": JSON.stringify({
        templateFile: "./component.figma.batch.ts",
        components: [
          {
            key: ICON_KEY,
            component: "CheckIcon",
          },
        ],
      }),
      "component.figma.batch.ts": "import figma from 'figma'\nexport default { example: figma.code`<CheckIcon />` }\n",
    });
    const { templates, unconnected } = await readCodeConnect(orbit().plugin, {}, root);

    expect(templates.find(({ path }) => path === "rows.figma.batch.json#1")?.matches).toEqual([
      {
        component: "Icon/Check",
        instances: 9,
        by: "key",
      },
    ]);
    expect(unconnected).toEqual([
      {
        component: "Plan Card",
        instances: 3,
        id: "54:202",
        key: PLAN_CARD_KEY,
      },
      // A variant's own key would match that variant alone: without the set's key (an older read) none is given.
      {
        component: "Button",
        instances: 3,
        id: "54:201",
      },
      {
        component: "Badge",
        instances: 1,
        id: "54:187",
        key: "3f9fe0719b313ebf477e6b5b5f67e3d594ab72fc",
      },
    ]);
  });

  it("checks a source that names a file, under the project and beside the Code Connect file, and leaves packages alone", async () => {
    const root = await project({
      "src/components/PlanCard.tsx": "export {}",
      "ui/Badge.tsx": "export {}",
      "PlanCard.figma.ts": card(
        "export default { example: figma.tsx`<PlanCard />` }",
        `// key=${PLAN_CARD_KEY}\n// source=src/components/PlanCard.tsx`,
      ),
      "ui/Badge.figma.ts":
        "// key=k-badge\n// source=Badge.tsx\nimport figma from 'figma'\nexport default { example: figma.code`<Badge />` }\n",
      "ui/Gone.figma.ts":
        "// key=k-gone\n// source=src/Gone.tsx\nimport figma from 'figma'\nexport default { example: figma.code`<Gone />` }\n",
      "ui/Icon.figma.ts":
        "// key=k-icon\n// source=lucide-react\nimport figma from 'figma'\nexport default { example: figma.code`<Icon />` }\n",
      "ui/Link.figma.ts":
        "// key=k-link\n// source=https://github.com/acme/ui/blob/main/Link.tsx\nimport figma from 'figma'\nexport default { example: figma.code`<Link />` }\n",
    });
    const { templates } = await readCodeConnect(orbit().plugin, {}, root);

    expect(templates.map(({ path, source, missing }) => [path, source, missing])).toEqual([
      ["PlanCard.figma.ts", "src/components/PlanCard.tsx", undefined],
      ["ui/Badge.figma.ts", "Badge.tsx", undefined],
      ["ui/Gone.figma.ts", "src/Gone.tsx", true],
      ["ui/Icon.figma.ts", "lucide-react", undefined],
      ["ui/Link.figma.ts", "https://github.com/acme/ui/blob/main/Link.tsx", undefined],
    ]);
  });
});

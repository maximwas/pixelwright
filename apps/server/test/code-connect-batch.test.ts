/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are template sources, their ${} the templates own. */
import { copyFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SnapshotNode } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { compile } from "../src/code-connect/compile.ts";
import { renderInstance } from "../src/code-connect/render-session.ts";
import { findTemplates } from "../src/code-connect/templates.ts";

const SHARED = fileURLToPath(new URL("../../../examples/orbit/components/component.figma.batch.ts", import.meta.url));

/** A Plan Card instance: its text, toggle and variant properties as Figma names them. */
const card = (properties: Record<string, string | boolean>, key = "k-card"): SnapshotNode => ({
  id: "1:1",
  name: "Pro",
  type: "INSTANCE",
  visible: true,
  x: 0,
  y: 0,
  width: 300,
  height: 400,
  childCount: 0,
  instance: {
    componentId: "9:1",
    componentName: "Tier=Pro",
    componentKey: "variant",
    setId: "9:0",
    setName: "Plan Card",
    setKey: key,
    properties: Object.fromEntries(
      Object.entries(properties).map(([name, value]) => [
        name,
        {
          type: typeof value === "boolean" ? "BOOLEAN" : name === "Tier" ? "VARIANT" : "TEXT",
          value,
        },
      ]),
    ),
  },
});

/** A project holding the shared template and a batch file of these rows. */
async function project(rows: object[], template?: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-batch-"));

  if (template === undefined) {
    await copyFile(SHARED, join(root, "component.figma.batch.ts"));
  } else {
    await writeFile(join(root, "component.figma.batch.ts"), template);
  }

  await writeFile(
    join(root, "rows.figma.batch.json"),
    JSON.stringify({
      templateFile: "./component.figma.batch.ts",
      components: rows,
    }),
  );

  return root;
}

const render = async (rows: object[], node: SnapshotNode, template?: string) =>
  renderInstance(node, (await findTemplates(await project(rows, template))).templates);

describe("a batch row through the shared template", () => {
  it("writes each mapped property as its prop: values passed, variants mapped, toggles bare, children inside", async () => {
    const rendered = await render(
      [
        {
          key: "k-card",
          component: "PricingTier",
          imports: ['import { PricingTier } from "@/components/PricingTier"'],
          props: {
            Name: "name",
            Price: "price",
            Tier: {
              prop: "tier",
              values: {
                Pro: "pro",
                Free: "free",
              },
            },
            Popular: "popular",
            Trial: "trial",
            Note: "children",
          },
        },
      ],
      card({
        "Name#1:0": 'The "Pro" plan',
        "Price#1:1": "$12",
        Tier: "Pro",
        "Popular#1:2": true,
        "Trial#1:3": false,
        "Note#1:4": "Billed yearly",
      }),
    );

    expect(rendered).toEqual({
      component: "PricingTier",
      template: "rows.figma.batch.json#1",
      snippet: '<PricingTier name={"The \\"Pro\\" plan"} price="$12" tier="pro" popular>Billed yearly</PricingTier>',
      imports: ['import { PricingTier } from "@/components/PricingTier"'],
    });
  });

  it("fails the row's instance, naming the property, when its props table names one the component lacks", async () => {
    const rendered = await render(
      [
        {
          key: "k-card",
          component: "PricingTier",
          props: { Titel: "title" },
        },
      ],
      card({}),
    );

    expect(rendered).toMatchObject({ error: expect.stringMatching(/^PROPERTY_NOT_FOUND: .* has no property Titel/) });
  });

  it("writes the bare component for a row without props, named by the row else the instance", async () => {
    expect(
      await render(
        [
          {
            key: "k-card",
            component: "PlanCard",
          },
        ],
        card({}),
      ),
    ).toMatchObject({
      snippet: "<PlanCard />",
      imports: [],
    });
    expect((await render([{ key: "k-card" }], card({})))?.template).toBe("rows.figma.batch.json#1");
  });

  it("gives each row's template its own frozen row as figma.batch, and {} to a template file", async () => {
    const probe =
      "import figma from 'figma'\nexport default { example: figma.code`${figma.batch.component ?? 'none'} ${Object.isFrozen(figma.batch)}` }\n";
    const root = await project(
      [
        {
          key: "k-card",
          component: "First",
        },
        {
          key: "k-other",
          component: "Second",
        },
      ],
      probe,
    );
    const { templates } = await findTemplates(root);

    expect(renderInstance(card({}), templates)).toMatchObject({ snippet: "First true" });
    expect(renderInstance(card({}, "k-other"), templates)).toMatchObject({ snippet: "Second true" });
    expect(
      renderInstance(card({}), [
        {
          path: "Card.figma.ts",
          source: probe,
          key: "k-card",
        },
      ]),
    ).toMatchObject({ snippet: "none false" });
  });

  it("compiles a batch file's shared template once for all its rows", async () => {
    const { templates } = await findTemplates(await project([{ key: "a" }, { key: "b" }]));

    expect(templates).toHaveLength(2);
    expect(compile(templates[0] as never)).toBe(compile(templates[1] as never));
  });
});

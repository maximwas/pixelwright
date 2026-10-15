import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { memoryFiles } from "../src/assets/written-files.ts";
import { renderInstance } from "../src/code-connect/render-session.ts";
import { findTemplates } from "../src/code-connect/templates.ts";
import { readDesign } from "../src/features/design-read/read-design.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const EXAMPLE = fileURLToPath(new URL("../../../examples/orbit", import.meta.url));
const ROW = JSON.parse(
  await readFile(new URL("../../../packages/core/test/fixtures/orbit-plans.json", import.meta.url), "utf8"),
) as unknown;

const bridge: BridgeView = {
  status: () => {
    throw new Error("not used");
  },
  pairing: () => null,
  plugins: () => [
    {
      session: "s1",
      info: pluginInfo(),
      active: true,
    },
  ],
  request: async (op) => {
    if (op !== "snapshot") {
      throw new Error(`unexpected ${op}`);
    }

    return ROW;
  },
};

describe("the Orbit example's Code Connect templates", () => {
  it("are found without problems", async () => {
    const { templates, problems } = await findTemplates(EXAMPLE);

    expect(problems).toEqual([]);
    expect(templates.map(({ path }) => path)).toEqual([
      "components/Button.figma.ts",
      "components/Callout.figma.ts",
      "components/PlanCard.figma.ts",
      "components/components.figma.batch.json#1",
      "components/components.figma.batch.json#2",
    ]);
  });

  it("give the Plans row's cards their code with their buttons inside, as the README shows", async () => {
    const result = await readDesign(
      new PluginClient(bridge),
      {
        node: "54:243",
        screenshot: false,
        maxChars: 80_000,
      },
      memoryFiles(),
      EXAMPLE,
    );
    const meta = JSON.parse((result.content[1] as { text: string }).text) as Record<string, unknown>;

    const imports = [
      'import { PlanCard } from "@/components/PlanCard"',
      'import { Button } from "@/components/Button"',
    ];
    const card = (id: string, props: string, label: string) => ({
      ids: [id],
      component: "PlanCard",
      template: "components/PlanCard.figma.ts",
      source: "src/components/PlanCard.tsx",
      snippet: `<PlanCard ${props}>\n  <Button variant="primary">${label}</Button>\n</PlanCard>`,
      imports,
    });

    // Every property of the cards reaches their code: no unread.
    expect(meta.codeComponents).toEqual([
      card("54:244", 'name="Starter" price="$0" description="For side projects and trying things out."', "Start free"),
      card("54:268", 'name="Pro" price="$12" description="For freelancers shipping fast." popular', "Get started"),
      card("54:292", 'name="Team" price="$29" description="For growing teams that ship together."', "Contact sales"),
    ]);
    expect(meta.imports).toEqual(imports);
    expect(meta).not.toHaveProperty("codeErrors");
  });
});

describe("the Orbit example's Callout", () => {
  /** A Button instance as the Orbit file has it: its variant and its label. */
  const button = (id: string, variant: "Primary" | "Secondary", label: string) => ({
    id,
    name: label,
    type: "INSTANCE",
    visible: true,
    x: 0,
    y: 0,
    width: 120,
    height: 44,
    childCount: 0,
    instance: {
      componentId: variant === "Primary" ? "54:189" : "54:195",
      componentName: `Variant=${variant}, State=Default`,
      setId: "54:201",
      setName: "Button",
      properties: {
        Variant: {
          type: "VARIANT",
          value: variant,
        },
        State: {
          type: "VARIANT",
          value: "Default",
        },
        "Label#54:1": {
          type: "TEXT",
          value: label,
        },
      },
    },
  });

  it("writes the buttons a designer puts in its Actions slot, each by the Button template", async () => {
    const { templates } = await findTemplates(EXAMPLE);
    const callout = {
      id: "81:1522",
      name: "Callout",
      type: "INSTANCE",
      visible: true,
      x: 0,
      y: 0,
      width: 1200,
      height: 200,
      childCount: 3,
      instance: {
        componentId: "81:1514",
        componentName: "Callout",
        properties: {
          "Title#81:0": {
            type: "TEXT",
            value: "Need more than 50 seats?",
          },
          "Body#81:1": {
            type: "TEXT",
            value: "Talk to us about volume pricing.",
          },
        },
      },
      children: [
        {
          id: "I81:1522;81:1517",
          name: "Actions",
          type: "SLOT",
          visible: true,
          x: 0,
          y: 0,
          width: 300,
          height: 44,
          childCount: 2,
          children: [
            button("I81:1522;81:1518", "Primary", "Talk to sales"),
            button("I81:1522;81:1519", "Secondary", "Compare plans"),
          ],
        },
      ],
    };

    expect(renderInstance(callout as never, templates)).toMatchObject({
      component: "Callout",
      template: "components/Callout.figma.ts",
      snippet: expect.stringMatching(
        /^<Callout title="Need more than 50 seats\?" body="Talk to us about volume pricing\.">\s*<Button variant="primary">Talk to sales<\/Button>\s*<Button variant="secondary">Compare plans<\/Button>\s*<\/Callout>$/,
      ),
    });
  });
});

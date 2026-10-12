import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { memoryFiles } from "../src/assets/written-files.ts";
import { findTemplates } from "../src/code-connect/templates.ts";
import { readDesign } from "../src/mcp/tools/design.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const EXAMPLE = fileURLToPath(new URL("../../../examples/positivus", import.meta.url));
const ROW = JSON.parse(
  await readFile(new URL("../../../packages/core/test/fixtures/positivus-services-row.json", import.meta.url), "utf8"),
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

describe("the Positivus example's Code Connect templates", () => {
  it("are found without problems", async () => {
    const { templates, problems } = await findTemplates(EXAMPLE);

    expect(problems).toEqual([]);
    expect(templates.map(({ path }) => path)).toEqual(["components/Heading.figma.ts", "components/Link.figma.ts"]);
  });

  it("give the Services row's headings and links their code, as the README shows", async () => {
    const result = await readDesign(
      bridge,
      {
        node: "2:4869",
        screenshot: false,
        maxChars: 80_000,
      },
      memoryFiles(),
      EXAMPLE,
    );
    const meta = JSON.parse((result.content[1] as { text: string }).text) as Record<string, unknown>;

    expect(meta.codeComponents).toEqual([
      {
        ids: ["2:4872"],
        component: "Heading",
        template: "components/Heading.figma.ts",
        snippet: '<Heading tone="green">Search engine optimization</Heading>',
        imports: ['import { Heading } from "@/components/Heading"'],
      },
      {
        ids: ["2:4873", "2:4879"],
        component: "Link",
        template: "components/Link.figma.ts",
        snippet: '<Link tone="dark" href="#">Learn more</Link>',
        imports: ['import { Link } from "@/components/Link"'],
      },
      {
        ids: ["2:4878"],
        component: "Heading",
        template: "components/Heading.figma.ts",
        snippet: '<Heading tone="light">Pay-per-click advertising</Heading>',
        imports: ['import { Heading } from "@/components/Heading"'],
      },
    ]);
    expect(meta.imports).toEqual([
      'import { Heading } from "@/components/Heading"',
      'import { Link } from "@/components/Link"',
    ]);
    expect(meta).not.toHaveProperty("codeErrors");
  });
});

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { findTemplates } from "../src/code-connect/templates.ts";

const BODY = "import figma from 'figma'\n\nexport default { example: figma.code`<Button />` }\n";
const SHARED = "import figma from 'figma'\n\nexport default { example: figma.code`<${figma.batch.component} />` }\n";

/** A project folder holding these files. */
async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-ccf-"));

  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }

  return root;
}

describe("Code Connect templates named by key", () => {
  it("takes a template with // key= and no url, and says once that Figma's CLI needs a url to publish it", async () => {
    const root = await project({
      "src/PricingTier.figma.ts": `// key=2f31fd\n// component=PricingTier\n// source=src/PricingTier.tsx\n${BODY}`,
      "src/Button.figma.ts": `// url=https://www.figma.com/design/K/F?node-id=1-2\n// key=b77\n${BODY}`,
    });

    const { templates, problems } = await findTemplates(root);

    expect(
      templates.map(({ path, key, url, component }) => ({
        path,
        key,
        url,
        component,
      })),
    ).toEqual([
      {
        path: "src/Button.figma.ts",
        key: "b77",
        url: "https://www.figma.com/design/K/F?node-id=1-2",
        component: undefined,
      },
      {
        path: "src/PricingTier.figma.ts",
        key: "2f31fd",
        url: undefined,
        component: "PricingTier",
      },
    ]);
    expect(problems).toEqual([
      "src/PricingTier.figma.ts: no url: Pixelwright matches it by key; Figma's CLI needs // url= to publish it.",
    ]);
  });

  it("drops a second connection with the same key, the first by path winning, and keeps key-only ones apart", async () => {
    const root = await project({
      "a/Card.figma.ts": `// key=k1\n${BODY}`,
      "b/Card.figma.ts": `// key=k1\n${BODY}`,
      "c/Tag.figma.ts": `// key=k2\n${BODY}`,
    });

    const { templates, problems } = await findTemplates(root);

    expect(templates.map(({ path }) => path)).toEqual(["a/Card.figma.ts", "c/Tag.figma.ts"]);
    expect(problems).toContain("b/Card.figma.ts: connects the same key as a/Card.figma.ts, which is the one used.");
  });
});

describe("Code Connect batch files", () => {
  it("reads Figma's batch format: groups as an object or an array, rows named <file>#<n> across groups", async () => {
    const root = await project({
      "figma.config.json": JSON.stringify({
        codeConnect: { documentUrlSubstitutions: { "<KIT>": "https://www.figma.com/design/KIT/Kit" } },
      }),
      "ui/component.figma.batch.ts": SHARED,
      "ui/icons.figma.batch.json": JSON.stringify({
        templateFile: "./component.figma.batch.ts",
        components: [
          {
            key: "k-check",
            component: "CheckIcon",
            source: "lucide-react",
          },
          {
            url: "<KIT>?node-id=5-6",
            component: "StarIcon",
          },
        ],
      }),
      "ui/cards.figma.batch.json": JSON.stringify([
        {
          templateFile: "component.figma.batch.ts",
          components: [
            {
              key: "k-card",
              component: "Card",
            },
          ],
        },
        {
          templateFile: "component.figma.batch.ts",
          components: [{ key: "k-badge" }],
        },
      ]),
    });

    const { templates, problems } = await findTemplates(root);

    expect(problems).toEqual([
      "ui/cards.figma.batch.json: rows without url (Card, row 2): Pixelwright matches them by key; Figma's CLI needs a row's url to publish them.",
      "ui/icons.figma.batch.json: rows without url (CheckIcon): Pixelwright matches them by key; Figma's CLI needs a row's url to publish them.",
    ]);
    expect(
      templates.map(({ path, file, key, nodeId, fileKey, component, codeSource, batch, batchFile }) => ({
        path,
        file,
        key,
        nodeId,
        fileKey,
        component,
        codeSource,
        batch,
        batchFile,
      })),
    ).toEqual([
      {
        path: "ui/cards.figma.batch.json#1",
        file: join(root, "ui/component.figma.batch.ts"),
        key: "k-card",
        nodeId: undefined,
        fileKey: undefined,
        component: "Card",
        codeSource: undefined,
        batch: {
          key: "k-card",
          component: "Card",
        },
        batchFile: "ui/cards.figma.batch.json",
      },
      {
        path: "ui/cards.figma.batch.json#2",
        file: join(root, "ui/component.figma.batch.ts"),
        key: "k-badge",
        nodeId: undefined,
        fileKey: undefined,
        component: undefined,
        codeSource: undefined,
        batch: { key: "k-badge" },
        batchFile: "ui/cards.figma.batch.json",
      },
      {
        path: "ui/icons.figma.batch.json#1",
        file: join(root, "ui/component.figma.batch.ts"),
        key: "k-check",
        nodeId: undefined,
        fileKey: undefined,
        component: "CheckIcon",
        codeSource: "lucide-react",
        batch: {
          key: "k-check",
          component: "CheckIcon",
          source: "lucide-react",
        },
        batchFile: "ui/icons.figma.batch.json",
      },
      {
        path: "ui/icons.figma.batch.json#2",
        file: join(root, "ui/component.figma.batch.ts"),
        key: undefined,
        nodeId: "5:6",
        fileKey: "KIT",
        component: "StarIcon",
        codeSource: undefined,
        batch: {
          url: "<KIT>?node-id=5-6",
          component: "StarIcon",
        },
        batchFile: "ui/icons.figma.batch.json",
      },
    ]);
    expect(Object.isFrozen(templates[0]?.batch)).toBe(true);
    expect(templates[0]?.source).toBe(SHARED);
  });

  it("gives a row without component or source the shared template's own, as Figma's CLI does", async () => {
    const root = await project({
      "component.figma.batch.ts": `// component=Generic\n// source=src/Generic.tsx\n${SHARED}`,
      "rows.figma.batch.json": JSON.stringify({
        templateFile: "./component.figma.batch.ts",
        components: [
          { key: "a" },
          {
            key: "b",
            component: "Own",
            source: "src/Own.tsx",
          },
        ],
      }),
    });
    const { templates } = await findTemplates(root);

    expect(templates.map(({ component, codeSource }) => [component, codeSource])).toEqual([
      ["Generic", "src/Generic.tsx"],
      ["Own", "src/Own.tsx"],
    ]);
  });

  it("skips a broken group or row with why, reads the file's other groups, and says Figma's CLI rejects the file", async () => {
    const root = await project({
      "component.figma.batch.ts": SHARED,
      "component.figma.ts": BODY,
      "bad.figma.batch.json": "{ not json",
      "mixed.figma.batch.json": JSON.stringify([
        { components: [{ key: "a" }] },
        {
          templateFile: "./missing.figma.batch.ts",
          components: [{ key: "b" }],
        },
        {
          templateFile: "./component.figma.ts",
          components: [{ key: "c" }],
        },
        {
          templateFile: "./component.figma.batch.ts",
          components: [],
        },
        {
          templateFile: "./component.figma.batch.ts",
          components: [{ component: "Lost" }, {}, { key: "ok" }],
        },
      ]),
    });

    const { templates, problems } = await findTemplates(root);

    expect(templates.filter(({ batchFile }) => batchFile !== undefined).map(({ path }) => path)).toEqual([
      "mixed.figma.batch.json#6",
    ]);
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^bad\.figma\.batch\.json: not JSON/),
        "mixed.figma.batch.json: group 1 has no templateFile; its rows are left out (Figma's CLI rejects the whole file).",
        "mixed.figma.batch.json: group 2's templateFile ./missing.figma.batch.ts does not exist; its rows are left out (Figma's CLI rejects the whole file).",
        "mixed.figma.batch.json: group 3's templateFile ./component.figma.ts must end in .figma.batch.ts or .figma.batch.js; its rows are left out (Figma's CLI rejects the whole file).",
        "mixed.figma.batch.json: group 4's components must be a non-empty array; its rows are left out (Figma's CLI rejects the whole file).",
        "mixed.figma.batch.json: row Lost has neither url nor key; it is left out (Figma's CLI rejects the whole file).",
        "mixed.figma.batch.json: row 5 has neither url nor key; it is left out (Figma's CLI rejects the whole file).",
      ]),
    );
  });

  it("leaves out a batch file a custom include misses, as Figma does, and names it", async () => {
    const root = await project({
      "figma.config.json": JSON.stringify({ codeConnect: { include: ["components/**/*.figma.ts"] } }),
      "components/Card.figma.ts": `// key=k-card\n${BODY}`,
      "components/component.figma.batch.ts": SHARED,
      "components/rows.figma.batch.json": JSON.stringify({
        templateFile: "./component.figma.batch.ts",
        components: [{ url: "https://www.figma.com/design/K/F?node-id=1-2" }],
      }),
      "node_modules/pkg/x.figma.batch.json": "[]",
    });

    const { templates, problems } = await findTemplates(root);

    expect(templates.map(({ path }) => path)).toEqual(["components/Card.figma.ts"]);
    expect(problems).toContain(
      "components/rows.figma.batch.json: not in figma.config.json's include, so Figma skips it too: add **/*.figma.batch.json.",
    );
    expect(problems.join("\n")).not.toContain("node_modules");
  });
});

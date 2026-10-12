import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { SnapshotNode } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { findTemplates, templateFor } from "../src/code-connect/templates.ts";
import type { TemplateFile } from "../src/types/code-connect.ts";

type Instance = NonNullable<SnapshotNode["instance"]>;

const BODY = "import figma from 'figma'\n\nexport default { example: figma.code`<Button />` }\n";

/** A project folder holding these files. */
async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-cc-"));

  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }

  return root;
}

function instance(fields: Partial<Instance>): Instance {
  return {
    componentId: "9:9",
    componentName: "Other",
    properties: {},
    ...fields,
  };
}

function template(path: string, fields: Partial<TemplateFile> = {}): TemplateFile {
  return {
    path,
    source: BODY,
    url: "https://www.figma.com/design/KEY/Kit?node-id=1-2",
    ...fields,
  };
}

describe("finding the project's Code Connect templates", () => {
  it("takes figma.config.json's globs, reads each file's comments and leaves node_modules out", async () => {
    const root = await project({
      "figma.config.json": JSON.stringify({ codeConnect: { include: ["src/**/*.figma.ts"] } }),
      "src/ui/Button.figma.ts": `// url=https://www.figma.com/design/KEY123/Kit?node-id=1-2\n// component=Button\n// source=src/ui/Button.tsx\n${BODY}`,
      "src/Card.figma.ts": `// url=https://www.figma.com/file/KEY456/Old?node-id=12%3A34\n${BODY}`,
      "src/node_modules/x/A.figma.ts": `// url=https://www.figma.com/design/X/Y?node-id=5-6\n${BODY}`,
      "other/Other.figma.ts": `// url=https://www.figma.com/design/X/Y?node-id=7-8\n${BODY}`,
    });

    const { templates, problems } = await findTemplates(root);

    expect(problems).toEqual([]);
    expect(templates).toEqual([
      {
        path: "src/Card.figma.ts",
        file: join(root, "src/Card.figma.ts"),
        source: expect.stringContaining("figma.code"),
        url: "https://www.figma.com/file/KEY456/Old?node-id=12%3A34",
        nodeId: "12:34",
        fileKey: "KEY456",
      },
      {
        path: "src/ui/Button.figma.ts",
        file: join(root, "src/ui/Button.figma.ts"),
        source: expect.stringContaining("figma.code"),
        url: "https://www.figma.com/design/KEY123/Kit?node-id=1-2",
        nodeId: "1:2",
        fileKey: "KEY123",
        component: "Button",
        codeSource: "src/ui/Button.tsx",
      },
    ]);
  });

  it("looks for *.figma.ts and *.figma.js anywhere without a config, minus its exclude globs", async () => {
    const root = await project({
      "figma.config.json": JSON.stringify({ codeConnect: { exclude: ["legacy/**"] } }),
      "a/One.figma.ts": `// url=https://www.figma.com/design/K/F?node-id=1-1\n${BODY}`,
      "Two.figma.js": `// url=https://www.figma.com/design/K/F?node-id=1-3\n${BODY}`,
      "legacy/Three.figma.ts": `// url=https://www.figma.com/design/K/F?node-id=1-4\n${BODY}`,
      "node_modules/pkg/Four.figma.ts": `// url=https://www.figma.com/design/K/F?node-id=1-5\n${BODY}`,
    });

    expect((await findTemplates(root)).templates.map(({ path }) => path)).toEqual(["Two.figma.js", "a/One.figma.ts"]);
  });

  it("says what is wrong instead of failing: a broken config, a file without url, two templates for one component", async () => {
    const root = await project({
      "figma.config.json": "{ not json",
      "A.figma.ts": BODY,
      "B.figma.ts": `// url=not a link\n${BODY}`,
      "x/Button.figma.ts": `// url=https://www.figma.com/design/K/F?node-id=1-2\n${BODY}`,
      "y/Button.figma.ts": `// url=https://www.figma.com/design/K/F?node-id=1-2\n${BODY}`,
      "z/Button.figma.ts": `// url=https://www.figma.com/design/K/F?node-id=3-4\n${BODY}`,
    });

    const { templates, problems } = await findTemplates(root);

    // y connects the component x does; z another one of the same name, which only a match by name cannot tell apart.
    expect(templates.map(({ path }) => path)).toEqual(["x/Button.figma.ts", "z/Button.figma.ts"]);
    expect(problems).toEqual([
      expect.stringMatching(/^figma\.config\.json: /),
      expect.stringMatching(/^A\.figma\.ts: no \/\/ url= comment/),
      expect.stringMatching(/^B\.figma\.ts: .*Figma link/),
      expect.stringMatching(/^y\/Button\.figma\.ts: .*x\/Button\.figma\.ts/),
      expect.stringMatching(/^z\/Button\.figma\.ts: .*x\/Button\.figma\.ts/),
    ]);
  });

  it("takes only Code Connect files from the config's globs, quietly passing over code that is no template", async () => {
    const root = await project({
      "figma.config.json": JSON.stringify({
        codeConnect: {
          parser: "react",
          include: ["src/**/*.{tsx,ts}"],
        },
      }),
      "src/Button.tsx": "export function Button() { return null }\n",
      "src/util.ts": "export const x = 1\n",
      "src/Button.figma.ts": `// url=https://www.figma.com/design/K/F?node-id=1-2\n${BODY}`,
      "src/Card.figma.ts": BODY,
      "src/Old.figma.ts":
        "import figma from '@figma/code-connect/html'\nfigma.connect('https://figma.com/x', { example: () => null })\n",
    });
    const { templates, problems } = await findTemplates(root);

    expect(templates.map(({ path }) => path)).toEqual(["src/Button.figma.ts"]);
    expect(problems).toEqual([
      expect.stringMatching(/^src\/Card\.figma\.ts: no \/\/ url= comment/),
      expect.stringMatching(/^src\/Old\.figma\.ts: .*npx figma connect migrate/),
    ]);
  });

  it("finds .figma.template files too, and never fails on a folder or a broken link named like a template", async () => {
    const root = await project({
      "Card.figma.template.ts": `// url=https://www.figma.com/design/K/F?node-id=1-2\n${BODY}`,
      "Tag.figma.template.js": `// url=https://www.figma.com/design/K/F?node-id=1-3\n${BODY}`,
      "folder.figma.ts/inside.txt": "",
    });

    await symlink(join(root, "gone.ts"), join(root, "Broken.figma.ts"));

    const { templates, problems } = await findTemplates(root);

    expect(templates.map(({ path }) => path)).toEqual(["Card.figma.template.ts", "Tag.figma.template.js"]);
    expect(problems).toEqual([expect.stringMatching(/^Broken\.figma\.ts: cannot be read/)]);
  });

  it("takes the config's url substitutions, globs written with ./ and directives in any case", async () => {
    const root = await project({
      "figma.config.json": JSON.stringify({
        codeConnect: {
          include: ["./src/**/*.figma.ts"],
          exclude: ["./src/legacy/**"],
          documentUrlSubstitutions: { "<FIGMA_BUTTON>": "https://www.figma.com/design/K/F?node-id=1-2" },
        },
      }),
      "src/Button.figma.ts": `// URL=<FIGMA_BUTTON>\n// Component=Button\n${BODY}`,
      "src/legacy/Old.figma.ts": `// url=https://www.figma.com/design/K/F?node-id=9-9\n${BODY}`,
    });

    expect(await findTemplates(root)).toEqual({
      templates: [
        expect.objectContaining({
          path: "src/Button.figma.ts",
          nodeId: "1:2",
          component: "Button",
        }),
      ],
      problems: [],
    });
  });

  it("does not walk the home folder or the disk's root, and says how to name the project", async () => {
    for (const root of [homedir(), "/"]) {
      expect(await findTemplates(root)).toEqual({
        templates: [],
        problems: [expect.stringMatching(/CLAUDE_PROJECT_DIR/)],
      });
    }
  });

  it("finds nothing, and says so, in a project without templates", async () => {
    expect(await findTemplates(await project({ "README.md": "hi" }))).toEqual({
      templates: [],
      problems: [],
    });
  });
});

describe("matching an instance to its template", () => {
  const button = template("ui/Button.figma.ts", {
    nodeId: "1:2",
    component: "Button",
  });
  const card = template("ui/Card.figma.ts", { nodeId: "3:4" });

  it("goes by the main component's or its set's id in this file", () => {
    expect(templateFor(instance({ componentId: "3:4" }), [button, card])).toBe(card);
    expect(
      templateFor(
        instance({
          componentId: "5:6",
          setId: "1:2",
          setName: "Renamed",
        }),
        [button, card],
      ),
    ).toBe(button);
  });

  it("goes by name for a library's component, whose id is the library's own", () => {
    expect(
      templateFor(
        instance({
          componentId: "1:2",
          componentName: "Toggle",
          remote: true,
        }),
        [button],
      ),
    ).toBeNull();
    expect(
      templateFor(
        instance({
          componentId: "77:1",
          componentName: "Size=Large",
          setName: "Button",
          remote: true,
        }),
        [button],
      ),
    ).toBe(button);
    expect(
      templateFor(
        instance({
          componentId: "77:2",
          componentName: "Card",
          remote: true,
        }),
        [button, card],
      ),
    ).toBe(card);
  });

  it("compares names as code names: case, spaces, punctuation and the Figma name's folders aside", () => {
    const primary = template("ui/primary-button.figma.ts");

    expect(
      templateFor(
        instance({
          componentId: "77:3",
          componentName: "Size=Large",
          setName: "Buttons/Primary Button",
          remote: true,
        }),
        [primary],
      ),
    ).toBe(primary);
    expect(
      templateFor(
        instance({
          componentId: "77:4",
          componentName: "Badge",
          remote: true,
        }),
        [primary],
      ),
    ).toBeNull();
  });

  it("prefers a template that both id and name point at, then one by name, then one by id alone", () => {
    const stranger = template("other/Badge.figma.ts", {
      nodeId: "3:4",
      component: "Badge",
    });

    // The id of another file's component that this file's Card happens to share: the name decides.
    expect(
      templateFor(
        instance({
          componentId: "3:4",
          componentName: "Card",
        }),
        [stranger, card],
      ),
    ).toBe(card);
    expect(
      templateFor(
        instance({
          componentId: "3:4",
          componentName: "Renamed",
        }),
        [stranger],
      ),
    ).toBe(stranger);
  });
});

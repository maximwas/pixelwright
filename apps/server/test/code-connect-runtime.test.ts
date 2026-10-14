/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are template sources, their ${} the templates own. */
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SnapshotNode } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { RenderSession, renderInstance } from "../src/code-connect/render-session.ts";
import type { SnapshotInstance, TemplateFile } from "../src/types/code-connect.ts";

type Layer = Partial<SnapshotNode> & Pick<SnapshotNode, "id" | "name" | "type">;

function layer(fields: Layer): SnapshotNode {
  return {
    visible: true,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    childCount: fields.children?.length ?? 0,
    ...fields,
  } as SnapshotNode;
}

function text(id: string, name: string, characters: string): SnapshotNode {
  return layer({
    id,
    name,
    type: "TEXT",
    text: {
      characters,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [],
    },
  });
}

function instance(
  id: string,
  name: string,
  component: Omit<SnapshotInstance, "properties">,
  properties: SnapshotInstance["properties"] = {},
  children: SnapshotNode[] = [],
): SnapshotNode {
  return layer({
    id,
    name,
    type: "INSTANCE",
    instance: {
      ...component,
      properties,
    },
    children,
  });
}

/** A template for the component of this name, its comments as Figma wants them. */
function template(component: string, body: string, path = `ui/${component}.figma.ts`): TemplateFile {
  return {
    path,
    source: `// url=https://www.figma.com/design/KIT/Kit?node-id=1-1\nimport figma from 'figma'\n${body}`,
    url: "https://www.figma.com/design/KIT/Kit?node-id=1-1",
    nodeId: "1:1",
    fileKey: "KIT",
    component,
  };
}

const ARROW = template(
  "Arrow",
  `export default { example: figma.code\`<ArrowIcon />\`, imports: ['import { ArrowIcon } from "./icons"', 'import { Button } from "./Button"'], id: 'arrow' }`,
);

function button(properties: SnapshotInstance["properties"] = {}, children?: SnapshotNode[]): SnapshotNode {
  return instance(
    "10:1",
    "Button",
    {
      componentId: "1:2",
      componentName: "Size=Large, State=Default",
      setId: "1:1",
      setName: "Button",
      remote: true,
    },
    {
      Size: {
        type: "VARIANT",
        value: "Large",
      },
      State: {
        type: "VARIANT",
        value: "Default",
      },
      "Label#3:4": {
        type: "TEXT",
        value: "Save `now` ${x}",
      },
      "Disabled#3:5": {
        type: "BOOLEAN",
        value: false,
      },
      "Icon#3:6": {
        type: "INSTANCE_SWAP",
        value: "5:1",
      },
      ...properties,
    },
    children ?? [
      instance("I10:1;3:7", "Icon", {
        componentId: "5:1",
        componentName: "Arrow",
        remote: true,
      }),
      text("I10:1;3:8", "Label", "Save"),
    ],
  );
}

describe("running a Code Connect template against an instance", () => {
  it("renders the instance's properties and its nested template, hoisting the imports once each", () => {
    const BUTTON = template(
      "Button",
      `interface Mapped { size?: string }
const instance = figma.selectedInstance
const props: Mapped = { size: instance.getEnum('Size', { Large: 'lg', Small: 'sm' }) as string | undefined }
const icon = instance.getInstanceSwap('Icon')

export default {
  example: figma.code\`<Button size="\${props.size}" disabled={\${instance.getBoolean('Disabled')}} tone="\${instance.getBoolean('Disabled', { true: 'muted', false: 'loud' })}">\${instance.getString('Label')}\${icon?.executeTemplate().example}</Button>\`,
  imports: ['import { Button } from "./Button"'],
  id: 'button',
}`,
    );

    expect(renderInstance(button(), [BUTTON, ARROW])).toEqual({
      component: "Button",
      template: "ui/Button.figma.ts",
      snippet: '<Button size="lg" disabled={false} tone="loud">Save `now` ${x}<ArrowIcon /></Button>',
      imports: ['import { Button } from "./Button"', 'import { ArrowIcon } from "./icons"'],
    });
  });

  it("leaves a value an enum does not map out of the snippet", () => {
    const BUTTON = template(
      "Button",
      "export default { example: figma.code`<Button size=\"${figma.selectedInstance.getEnum('Size', { Small: 'sm' })}\" />` }",
    );

    expect(renderInstance(button(), [BUTTON])).toMatchObject({ snippet: '<Button size="" />' });
  });

  it("gives the instance's id, raw property values, property names and texts", () => {
    const BUTTON = template(
      "Button",
      "const i = figma.selectedInstance\nexport default { example: figma.code`${i.id} ${i.getPropertyValue('State')} ${Object.keys(i.properties).join(',')} ${i.findText('Label').textContent} ${i.hasCodeConnect()} ${i.codeConnectId()}`, id: 'button' }",
    );

    expect(renderInstance(button(), [BUTTON])).toMatchObject({
      snippet: "10:1 Default Size,State,Label,Disabled,Icon Save true button",
    });
  });

  it("renders nothing for a nested instance without a template, as Figma does", () => {
    const BUTTON = template(
      "Button",
      "export default { example: figma.code`<Button>${figma.selectedInstance.findInstance('Icon').executeTemplate().example}</Button>` }",
    );

    expect(renderInstance(button(), [BUTTON])).toMatchObject({ snippet: "<Button></Button>" });
  });

  it("makes a missing layer the instance's error only when the template uses it", () => {
    const unused = template(
      "Button",
      "figma.selectedInstance.findInstance('Nope')\nexport default { example: figma.code`<Button />` }",
    );
    const used = template(
      "Button",
      "export default { example: figma.code`<Button>${figma.selectedInstance.findInstance('Nope')}</Button>` }",
    );

    expect(renderInstance(button(), [unused])).toMatchObject({ snippet: "<Button />" });
    expect(renderInstance(button(), [used])).toEqual({
      template: "ui/Button.figma.ts",
      error: expect.stringMatching(/^CHILD_LAYER_NOT_FOUND: .*Nope/),
    });
  });

  it("makes a property the instance lacks its error", () => {
    const BUTTON = template(
      "Button",
      "export default { example: figma.code`${figma.selectedInstance.getString('Title')}` }",
    );

    expect(renderInstance(button(), [BUTTON])).toEqual({
      template: "ui/Button.figma.ts",
      error: expect.stringMatching(/^PROPERTY_NOT_FOUND: .*Title/),
    });
  });

  it("renders a slot's instances and lists them", () => {
    const CARD = template(
      "Card",
      "const slot = figma.selectedInstance.getSlot('Content')\nexport default { example: figma.code`<Card>${slot}</Card> ${slot.connectedInstances.length}` }",
    );
    const card = instance(
      "20:1",
      "Card",
      {
        componentId: "2:1",
        componentName: "Card",
      },
      {},
      [
        layer({
          id: "I20:1;2:2",
          name: "Content",
          type: "SLOT",
          children: [
            instance("I20:1;2:3", "Arrow", {
              componentId: "5:1",
              componentName: "Arrow",
            }),
            instance("I20:1;2:4", "Arrow", {
              componentId: "5:1",
              componentName: "Arrow",
            }),
          ],
        }),
      ],
    );

    expect(renderInstance(card, [CARD, ARROW])).toMatchObject({ snippet: "<Card><ArrowIcon /><ArrowIcon /></Card> 2" });
  });

  it("finds connected instances by a test, inside other instances only when asked, and along a path", () => {
    const ITEM = template("Item", "export default { example: figma.code`<Item />`, id: 'item' }");
    const TOOLBAR = template(
      "Toolbar",
      `const t = figma.selectedInstance
const count = (options) => t.findConnectedInstances(() => true, options).length
export default { example: figma.code\`\${count()} \${count({ traverseInstances: true })} \${count({ path: ['Menu'] })} \${t.findConnectedInstance('item').id}\` }`,
    );
    const item = (id: string) =>
      instance(id, "Item", {
        componentId: "6:1",
        componentName: "Item",
      });
    const toolbar = instance(
      "30:1",
      "Toolbar",
      {
        componentId: "7:1",
        componentName: "Toolbar",
      },
      {},
      [
        layer({
          id: "I30:1;1",
          name: "Group",
          type: "FRAME",
          children: [item("I30:1;2"), item("I30:1;3")],
        }),
        instance(
          "I30:1;4",
          "Menu",
          {
            componentId: "8:1",
            componentName: "Menu",
          },
          {},
          [item("I30:1;4;1")],
        ),
      ],
    );

    expect(renderInstance(toolbar, [TOOLBAR, ITEM])).toMatchObject({ snippet: "2 3 1 I30:1;2" });
  });

  it("gives Figma's React helpers", () => {
    const BUTTON = template(
      "Button",
      `const r = figma.helpers.react
const icon = figma.selectedInstance.findInstance('Icon').executeTemplate().example
export default { example: figma.tsx\`<Button\${r.renderProp('disabled', true)}\${r.renderProp('hidden', false)}\${r.renderProp('label', 'Hi "you"')}>\${r.renderChildren(icon)}</Button>\` }`,
    );

    expect(renderInstance(button(), [BUTTON, ARROW])).toMatchObject({
      snippet: '<Button disabled label="Hi \\"you\\""><ArrowIcon /></Button>',
    });
  });

  it("takes require('figma') as well as the import", () => {
    const BUTTON: TemplateFile = {
      ...template("Button", ""),
      source:
        "// url=https://www.figma.com/design/KIT/Kit?node-id=1-1\nconst figma = require('figma')\nexport default { example: figma.code`<Button />` }",
    };

    expect(renderInstance(button(), [BUTTON])).toMatchObject({ snippet: "<Button />" });
  });

  it("refuses what a template may not do: other imports, named exports, no example, a legacy figma.connect file", () => {
    const cases = {
      "import fs from 'fs'\nexport default { example: figma.code`x` }": /^TEMPLATE_IMPORT: .*fs/,
      "export const x = 1\nexport default { example: figma.code`x` }": /^TEMPLATE_EXPORT: /,
      "export default { imports: [] }": /^TEMPLATE_EXAMPLE: /,
      "figma.connect(Button, 'https://figma.com', { example: () => null })":
        /^TEMPLATE_LEGACY: .*npx figma connect migrate/,
    };

    for (const [body, error] of Object.entries(cases)) {
      expect(renderInstance(button(), [template("Button", body)]), body).toEqual({
        template: "ui/Button.figma.ts",
        error: expect.stringMatching(error),
      });
    }
  });

  it("stops a template that never returns, and one that renders itself", () => {
    const started = Date.now();

    expect(renderInstance(button(), [template("Button", "while (true) {}")], { timeout: 200 })).toEqual({
      template: "ui/Button.figma.ts",
      error: expect.stringMatching(/^TEMPLATE_TIMEOUT: /),
    });
    expect(Date.now() - started).toBeLessThan(1_500);
    expect(
      renderInstance(button(), [
        template(
          "Button",
          "export default { example: figma.code`${figma.selectedInstance.executeTemplate().example}` }",
        ),
      ]),
    ).toEqual({
      template: "ui/Button.figma.ts",
      error: expect.stringMatching(/^TEMPLATE_CYCLE: /),
    });
  });

  it("gives null for an instance no template connects", () => {
    expect(renderInstance(button(), [ARROW])).toBeNull();
  });
});

describe("templates across a read", () => {
  const LOOP = template("Button", "while (true) {}");

  it("stops a template that loops on promises, and leaves the event loop free", () => {
    const started = Date.now();

    expect(
      renderInstance(
        button(),
        [
          template(
            "Button",
            ";(async () => { for (;;) await null })()\nexport default { example: figma.code`<Button />` }",
          ),
        ],
        { timeout: 200 },
      ),
    ).toEqual({
      template: "ui/Button.figma.ts",
      error: expect.stringMatching(/^TEMPLATE_TIMEOUT: /),
    });
    expect(Date.now() - started).toBeLessThan(1_500);
  });

  it("gives a template that ran out of time no second chance in the same read", () => {
    const session = new RenderSession([LOOP], { timeout: 100 });
    const started = Date.now();
    const results = Array.from({ length: 5 }, () => session.render(button()));

    expect(results).toEqual(
      Array(5).fill(expect.objectContaining({ error: expect.stringMatching(/^TEMPLATE_TIMEOUT: /) })),
    );
    expect(Date.now() - started).toBeLessThan(600);
  });

  it("blames the nested template that ran out of time, not the one that nests it", () => {
    const BUTTON = template(
      "Button",
      "export default { example: figma.code`<Button>${figma.selectedInstance.findInstance('Icon').executeTemplate().example}</Button>` }",
    );
    const SPIN = template("Arrow", "while (true) {}", "ui/Spin.figma.ts");

    expect(renderInstance(button(), [BUTTON, SPIN], { timeout: 200 })).toEqual({
      template: "ui/Button.figma.ts",
      error: expect.stringMatching(/^TEMPLATE_TIMEOUT: ui\/Spin\.figma\.ts/),
    });
  });

  it("stops rendering once the read's time is spent", () => {
    const SLOW = template(
      "Button",
      "const end = Date.now() + 120\nwhile (Date.now() < end) {}\nexport default { example: figma.code`<Button />` }",
    );
    const session = new RenderSession([SLOW], {
      timeout: 1_000,
      budget: 300,
    });
    const results = Array.from({ length: 6 }, () => session.render(button()));

    expect(results[0]).toMatchObject({ snippet: "<Button />" });
    expect(results.at(-1)).toMatchObject({ error: expect.stringMatching(/^TEMPLATE_BUDGET: /) });
  });

  it("runs a template written with semicolons, its default export's included", () => {
    const BUTTON = template(
      "Button",
      "const label = 'Save';\nexport default { example: figma.code`<Button>${label}</Button>` };\n",
    );

    expect(renderInstance(button(), [BUTTON])).toMatchObject({ snippet: "<Button>Save</Button>" });
  });

  it("runs a template whose comment mentions figma.connect(", () => {
    const BUTTON = template(
      "Button",
      "// Migrated from a figma.connect( file.\nexport default { example: figma.code`<Button />` }",
    );

    expect(renderInstance(button(), [BUTTON])).toMatchObject({ snippet: "<Button />" });
  });

  it("imports the template's relative helpers, TypeScript and nested ones included", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixelwright-helpers-"));

    await mkdir(join(root, "ui", "deep"), { recursive: true });
    await writeFile(
      join(root, "ui", "helpers.ts"),
      "import { shout } from './deep/text'\nexport const sizes: Record<string, string> = { Large: 'lg' }\nexport function label(text: string): string { return shout(text) }\nexport * from './deep/text'\nexport default 'base'\n",
    );
    await writeFile(
      join(root, "ui", "deep", "text.ts"),
      "export const shout = (text: string) => text.toUpperCase()\nexport const quiet = 'quiet'\n",
    );

    const BUTTON: TemplateFile = {
      ...template(
        "Button",
        "import base, { sizes, label, quiet } from './helpers'\nimport * as all from './helpers'\nconst i = figma.selectedInstance\nexport default { example: figma.code`<Button size=\"${sizes[i.getPropertyValue('Size')]}\">${label('save')} ${quiet} ${base} ${all.sizes.Large}</Button>` }",
      ),
      file: join(root, "ui", "Button.figma.ts"),
    };

    expect(renderInstance(button(), [BUTTON])).toMatchObject({
      snippet: '<Button size="lg">SAVE quiet base lg</Button>',
    });
  });

  it("gives what templates migrated by Figma use: props metadata, render with a function, value exports", () => {
    const ARROW_PROPS = template(
      "Arrow",
      "export default { example: figma.code`<ArrowIcon />`, metadata: { __props: { name: 'arrow' } } }",
    );
    const BUTTON = template(
      "Button",
      "const icon = figma.selectedInstance.findInstance('Icon')\nconst props = icon.executeTemplate().metadata.props\nexport default { example: figma.code`${props.name} ${icon.__renderWithFn__((p) => figma.code`<I n=\"${p.name}\" />`)}` }",
    );
    const ARROW_VALUE = template("Arrow", "export default figma.value('arrow', 'Arrow')");
    const NESTING = template(
      "Button",
      "export default { example: figma.code`<Button icon=\"${figma.selectedInstance.findInstance('Icon').executeTemplate().example}\" />` }",
    );

    expect(renderInstance(button(), [BUTTON, ARROW_PROPS])).toMatchObject({ snippet: 'arrow <I n="arrow" />' });
    expect(renderInstance(button(), [NESTING, ARROW_VALUE])).toMatchObject({ snippet: '<Button icon="Arrow" />' });
  });
});

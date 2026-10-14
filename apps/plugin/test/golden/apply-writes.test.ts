import { afterEach, describe, expect, it } from "vitest";
import { applyDesign } from "../../../server/src/design/apply-design.ts";
import { setEditsAllowed } from "../../src/figma/edits.ts";
import { applyDocument } from "../helpers/apply-document.ts";
import type { FakeNode } from "../helpers/fake-figma.ts";
import { pluginBridge } from "../helpers/plugin-bridge.ts";

/**
 * What design_apply does to a Figma document, call by call, as the plugin before the apply pipeline's rewrite does it:
 * each call runs on a fresh document, for real and as a dry run, through the server's applyDesign over the plugin.
 * Kept per call: the answer (or the error thrown), the plugin's method calls on layers in order, the layers made with
 * their state, every existing layer's changed fields, undo steps and the fonts loaded.
 */

interface Case {
  readonly name: string;
  readonly xml: string;
  readonly parent?: string;
  readonly editsOff?: boolean;
}

const GROUPS: Readonly<Record<string, readonly Case[]>> = {
  layout: [
    {
      name: "gap",
      xml: '<Frame id="1:1" gap="24px"/>',
    },
    {
      name: "padding",
      xml: '<Frame id="1:1" padding="16px 24px"/>',
    },
    {
      name: "a row with its alignment",
      xml: '<Frame id="1:1" flex-direction="row" align-items="center" justify-content="space-between"/>',
    },
    {
      name: "wrap with two gaps",
      xml: '<Frame id="9:1" flex-wrap="wrap" gap="8px 12px"/>',
    },
    {
      name: "auto layout off",
      xml: '<Frame id="1:1" display="block"/>',
    },
    {
      name: "auto layout on a board",
      xml: '<Frame id="3:1" display="flex" flex-direction="column" gap="4px"/>',
    },
  ],
  sizing: [
    {
      name: "fixed width",
      xml: '<Frame id="1:1" width="320px"/>',
    },
    {
      name: "hug",
      xml: '<Frame id="1:1" width="auto"/>',
    },
    {
      name: "fill along the row",
      xml: '<Rectangle id="9:2" flex="1"/>',
    },
    {
      name: "stretch across",
      xml: '<Frame id="1:5" align-self="stretch"/>',
    },
    {
      name: "min and max",
      xml: '<Frame id="1:1" min-width="200px" max-width="600px"/>',
    },
    {
      name: "a line's length",
      xml: '<Line id="6:1" width="200px"/>',
    },
    {
      name: "a standing line's length",
      xml: '<Line id="6:2" height="150px"/>',
    },
  ],
  placement: [
    {
      name: "absolute on a board",
      xml: '<Rectangle id="3:2" left="16px" top="24px"/>',
    },
    {
      name: "pinned right and bottom",
      xml: '<Rectangle id="3:2" right="0" bottom="0"/>',
    },
    {
      name: "absolute in auto layout",
      xml: '<Rectangle id="9:3" position="absolute" left="0" top="0"/>',
    },
    {
      name: "turned",
      xml: '<Rectangle id="9:4" transform="rotate(45deg)"/>',
    },
  ],
  paint: [
    {
      name: "a background",
      xml: '<Rectangle id="9:2" background="#FF0000"/>',
    },
    {
      name: "no background",
      xml: '<Rectangle id="9:2" background="none"/>',
    },
    {
      name: "a border",
      xml: '<Rectangle id="9:3" border="2px solid #000"/>',
    },
    {
      name: "an outline",
      xml: '<Rectangle id="9:4" outline="1px solid #3B2FD9"/>',
    },
    {
      name: "a gradient",
      xml: '<Rectangle id="9:2" background="linear-gradient(90deg, #FF0000, #0000FF)"/>',
    },
    {
      name: "a group's child",
      xml: '<Ellipse id="4:2" background="#00FF00"/>',
    },
  ],
  effects: [
    {
      name: "a shadow",
      xml: '<Frame id="1:1" box-shadow="0 4px 12px rgba(0, 0, 0, 0.25)"/>',
    },
    {
      name: "a blur",
      xml: '<Frame id="1:1" filter="blur(4px)"/>',
    },
    {
      name: "opacity",
      xml: '<Frame id="1:1" opacity="0.5"/>',
    },
    {
      name: "corners",
      xml: '<Frame id="1:1" border-radius="12px"/>',
    },
  ],
  text: [
    {
      name: "characters",
      xml: '<Text id="1:2">Hi there</Text>',
    },
    {
      name: "a font",
      xml: '<Text id="1:2" font="700 20px/28px \'Inter\'"/>',
    },
    {
      name: "a colour",
      xml: '<Text id="1:2" color="#3B2FD9"/>',
    },
    {
      name: "a span",
      xml: '<Text id="1:2">Hel<Span color="#FF0000">lo</Span></Text>',
    },
    {
      name: "an underline",
      xml: '<Text id="1:6" text-decoration="underline"/>',
    },
    {
      name: "centred",
      xml: '<Text id="1:2" text-align="center"/>',
    },
    {
      name: "spacing and case",
      xml: '<Text id="1:2" letter-spacing="1px" text-transform="uppercase"/>',
    },
    {
      name: "a new text",
      xml: "<Text>New text</Text>",
      parent: "1:5",
    },
  ],
  components: [
    {
      name: "a variant",
      xml: '<Instance id="2:1" variant="Property 1=Green"/>',
    },
    {
      name: "an instance's text",
      xml: '<Text id="I2:1;3:5">Search</Text>',
    },
    {
      name: "a new instance",
      xml: '<Instance component="Heading" variant="Property 1=Green"/>',
      parent: "3:1",
    },
    {
      name: "a new component set",
      parent: "3:1",
      xml: '<ComponentSet name="Tag"><Component variant="Tone=Dark"><Text prop="Label">A</Text></Component><Component variant="Tone=Light"><Text prop="Label">B</Text></Component></ComponentSet>',
    },
    {
      name: "a copy of an instance in another variant",
      xml: '<Frame id="3:1"><Instance copyOf="2:1" variant="Property 1=Green"/></Frame>',
    },
    {
      name: "a local component's text",
      xml: '<Text id="11:2">Tag</Text>',
    },
    {
      name: "a set, an instance of it and a copy of an instance at once",
      parent: "3:1",
      xml: '<ComponentSet name="Tag"><Component variant="Tone=Dark"><Text prop="Label">A</Text></Component></ComponentSet>\n<Instance component="Tag" variant="Tone=Dark"/>\n<Instance copyOf="2:1"/>',
    },
  ],
  structure: [
    {
      name: "creates of each shape",
      parent: "3:1",
      xml: '<Frame name="New" width="100px" height="40px"/>\n<Rectangle name="Box" width="10px" height="10px" background="#FFF"/>\n<Ellipse name="Round" width="8px" height="8px"/>\n<Line name="Line" width="60px" border-top="1px solid #000"/>',
    },
    {
      name: "a reorder",
      xml: '<Frame id="9:1"><Rectangle id="9:3"/><Rectangle id="9:4"/><Rectangle id="9:2"/></Frame>',
    },
    {
      name: "a move before",
      xml: '<Frame id="1:5"><Text id="1:6" before="1:2"/></Frame>',
    },
    {
      name: "a move into another parent",
      xml: '<Frame id="3:1"><Rectangle id="9:2"/></Frame>',
    },
    {
      name: "a copy of a frame with a retyped text",
      xml: '<Frame id="3:1"><Frame copyOf="1:1" name="Card 2"><Frame id="1:5"><Text id="1:2">Copied title</Text></Frame></Frame></Frame>',
    },
    {
      name: "a copy retyping a text in another font",
      parent: "3:1",
      xml: '<Frame copyOf="1:1"><Frame id="1:5"><Text id="1:6">More</Text></Frame></Frame>',
    },
    {
      name: "hidden",
      xml: '<Frame id="1:1" display="none"/>',
    },
    {
      name: "a new section",
      xml: '<Section name="New area" width="400px" height="300px"/>',
    },
  ],
  notes: [
    {
      name: "a note",
      xml: '<Frame id="1:1" note="Card: keep the 24px gap"/>',
    },
    {
      name: "a link on a text",
      xml: '<Text id="1:6" href="https://example.com"/>',
    },
    {
      name: "a rename",
      xml: '<Frame id="1:5" name="Header"/>',
    },
  ],
  run: [
    {
      name: "Allow edits off",
      xml: '<Frame id="1:1" gap="8px"/>',
      editsOff: true,
    },
    {
      name: "an id the file does not hold",
      xml: '<Frame id="99:9" gap="8px"/>',
    },
    {
      name: "one good and one refused attribute",
      xml: '<Frame id="1:1" gap="8px" padding="8px var(--nope)"/>',
    },
  ],
};

/** How a call runs: the one place the apply pipeline's rewrite changes in this file. */
function run(testCase: Case, dryRun: boolean) {
  return applyDesign(pluginBridge(), {
    xml: testCase.xml,
    dryRun,
    ...(testCase.parent === undefined ? {} : { parent: testCase.parent }),
  });
}

/** Allows or refuses edits for the next call: the one other place the rewrite changes. */
function allowEdits(allowed: boolean): void {
  setEditsAllowed(allowed);
}

const isNode = (value: object): value is FakeNode => "id" in value && "type" in value && "parent" in value;

/** A value as JSON keeps it: numbers to 1e-9, a layer inside another value as node:<id>, no functions. */
function plain(value: unknown, nested = false): unknown {
  if (typeof value === "number") {
    return Math.round(value * 1e9) / 1e9;
  }

  if (typeof value === "symbol") {
    return String(value);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => plain(item, true));
  }

  if (nested && isNode(value)) {
    return `node:${value.id}`;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => typeof item !== "function" && key !== "parent")
      .map(([key, item]) => [
        key,
        key === "children" ? (item as FakeNode[]).map((child) => child.id) : plain(item, true),
      ]),
  );
}

/** Each field that differs between two states of a layer, as [before, after]. */
function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changed: Record<string, [unknown, unknown]> = {};

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed[key] = [before[key] ?? null, after[key] ?? null];
    }
  }

  return changed;
}

async function outcomeOf(testCase: Case, dryRun: boolean) {
  const document = applyDocument();
  const before = new Map(document.nodes().map((node) => [node.id, plain(node) as Record<string, unknown>]));

  allowEdits(!(testCase.editsOff ?? false));

  const answer = await run(testCase, dryRun).then(
    (result) => ({ result }),
    (error: unknown) => ({
      thrown: {
        ...(error instanceof Error && "code" in error ? { code: error.code } : {}),
        message: error instanceof Error ? error.message : String(error),
      },
    }),
  );
  const { writes } = document.fake;
  const changed = Object.fromEntries(
    document
      .nodes()
      .filter((node) => before.has(node.id))
      .map((node) => [node.id, changedFields(before.get(node.id) ?? {}, plain(node) as Record<string, unknown>)])
      .filter(([, fields]) => Object.keys(fields as object).length > 0),
  );

  return {
    ...answer,
    calls: writes.calls.map(({ node, method, args }) => ({
      node,
      method,
      args: plain(args, true),
    })),
    created: writes.created.map((node) => ({
      parent: node.parent?.id ?? null,
      state: plain(node),
    })),
    changed,
    undo: writes.undo,
    fonts: [...writes.loaded].sort(),
  };
}

afterEach(() => {
  allowEdits(false);
});

describe.each(Object.keys(GROUPS))("golden apply writes (%s)", (group) => {
  it("keeps what each call does to the document, for real and as a dry run", async () => {
    const record: Record<string, unknown> = {};

    for (const testCase of GROUPS[group] ?? []) {
      record[testCase.name] = {
        real: await outcomeOf(testCase, false),
        dry: await outcomeOf(testCase, true),
      };
    }

    await expect(`${JSON.stringify(record, null, 2)}\n`).toMatchFileSnapshot(`__golden__/apply-writes/${group}.json`);
  });
});

import { type ApplyChange, type ApplyError, changeOf, readApply } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setEditsAllowed } from "../src/figma/edits.ts";
import { runOperation } from "../src/figma/operations.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";

interface Applied {
  created: { line: number; ref: string; id: string; tag: string }[];
  changed: string[];
  errors: ApplyError[];
}

function changesOf(xml: string): ApplyChange[] {
  const { elements, errors } = readApply(xml);

  expect(errors).toEqual([]);

  return elements.map((element) => changeOf(element).change);
}

const apply = async (xml: string, options: { parent?: string } = {}) =>
  (await runOperation("apply", {
    changes: changesOf(xml),
    ...options,
  })) as Applied;

/** A team library's Heading set, off the page: two variants and a text property. */
function heading(): FakeNode {
  const set = tree({
    id: "7:1",
    name: "Heading",
    type: "COMPONENT_SET",
    key: "heading-key",
    componentPropertyDefinitions: {
      "Property 1": {
        type: "VARIANT",
        defaultValue: "Default",
        variantOptions: ["Default", "Green"],
      },
      "Label#1:0": {
        type: "TEXT",
        defaultValue: "Title",
      },
    },
    children: [
      {
        id: "7:2",
        name: "Property 1=Default",
        type: "COMPONENT",
      },
      {
        id: "7:3",
        name: "Property 1=Green",
        type: "COMPONENT",
      },
    ],
  });

  set.defaultVariant = set.children?.[0];

  return set;
}

let root: FakeNode;
let library: FakeNode;
let fake: ReturnType<typeof installFigma>;
const all = (from: FakeNode): FakeNode[] => [from, ...(from.children ?? []).flatMap(all)];
const byId = (id: string) => [...all(root), ...all(library), ...fake.writes.created].find((node) => node.id === id);
const made = (type: string) => fake.writes.created.filter((node) => node.type === type);

beforeEach(() => {
  library = heading();
  root = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "3:1",
        name: "Board",
        layoutMode: "NONE",
        absoluteBoundingBox: {
          x: 0,
          y: 0,
          width: 800,
          height: 600,
        },
        children: [],
      },
      {
        id: "2:1",
        name: "Heading",
        type: "INSTANCE",
        mainComponent: library.children?.[0],
        componentProperties: {
          "Property 1": {
            type: "VARIANT",
            value: "Default",
          },
          "Label#1:0": {
            type: "TEXT",
            value: "Title",
          },
        },
        children: [],
      },
    ],
  });
  fake = installFigma(root, {
    components: [library],
    fonts: [
      {
        family: "Inter",
        style: "Regular",
      },
    ],
  });
  setEditsAllowed(true);
});

afterEach(() => {
  setEditsAllowed(false);
});

describe("apply: instances", () => {
  it("makes an instance of a library component the page uses, by name and variant, its props set", async () => {
    const { errors, created } = await apply(
      '<Instance component="Heading" variant="Property 1=Green" props="Label=Our work"/>',
      { parent: "3:1" },
    );
    const instance = byId(created[0]?.id ?? "");

    expect(errors).toEqual([]);
    expect((instance?.mainComponent as FakeNode | undefined)?.id).toBe("7:3");
    expect(instance?.parent?.id).toBe("3:1");
    expect((instance as FakeNode).componentProperties).toMatchObject({ "Label#1:0": { value: "Our work" } });
  });

  it("switches an instance's variant and props by id, and names what it has when asked for what it lacks", async () => {
    await apply('<Instance id="2:1" variant="Property 1=Green"/>');

    expect((byId("2:1") as FakeNode).mainComponent).toMatchObject({ id: "7:3" });

    const { errors } = await apply(
      ['<Instance component="Headng"/>', '<Instance id="2:1" variant="Property 1=Purple" props="Lable=x"/>'].join("\n"),
      { parent: "3:1" },
    );

    expect(errors.map(({ line, attribute, message, hint }) => [line, attribute, `${message} ${hint ?? ""}`])).toEqual([
      [1, undefined, expect.stringMatching(/Headng.*Heading/)],
      [2, "variant", expect.stringMatching(/Purple.*Default, Green/)],
      [2, "props", expect.stringMatching(/Lable.*Label/)],
    ]);
  });
});

describe("apply: a dry run of instances", () => {
  it("checks the component and variant an instance names without making it", async () => {
    const result = (await runOperation("apply", {
      changes: changesOf('<Instance component="Heading" variant="Property 1=Green"/>\n<Instance component="Nope"/>'),
      parent: "3:1",
      dryRun: true,
    })) as Applied;

    expect(result.errors.map(({ line, message }) => [line, message])).toEqual([[2, expect.stringMatching(/Nope/)]]);
    expect(made("INSTANCE")).toEqual([]);
  });
});

describe("apply: components and sets", () => {
  it("makes a component whose layers make its properties, and an instance of it later in the XML", async () => {
    const { errors } = await apply(
      '<Component name="Badge" display="flex" padding="4px" description="A small label."><Text prop="Label" visibleProp="Shown">New</Text></Component>\n<Instance component="Badge" props="Label=Hot, Shown=false"/>',
      { parent: "3:1" },
    );
    const [component] = made("COMPONENT");
    const text = made("TEXT")[0];
    const instance = made("INSTANCE")[0];

    expect(errors).toEqual([]);
    expect(component).toMatchObject({
      name: "Badge",
      description: "A small label.",
      layoutMode: "HORIZONTAL",
      componentPropertyDefinitions: {
        "Label#1:0": {
          type: "TEXT",
          defaultValue: "New",
        },
        "Shown#2:0": {
          type: "BOOLEAN",
          defaultValue: true,
        },
      },
    });
    expect(text?.componentPropertyReferences).toEqual({
      characters: "Label#1:0",
      visible: "Shown#2:0",
    });
    expect(instance?.componentProperties).toMatchObject({
      "Label#1:0": { value: "Hot" },
      "Shown#2:0": { value: false },
    });
  });

  it("combines new variants into one set laid out in a grid, its properties defined once on the set", async () => {
    const { errors, created } = await apply(
      '<ComponentSet name="Tag"><Component variant="Tone=Dark" width="80px" height="30px"><Text prop="Label">A</Text></Component><Component variant="Tone=Light" width="80px" height="30px"><Text prop="Label">B</Text></Component></ComponentSet>',
      { parent: "3:1" },
    );
    const set = byId(created.find(({ tag }) => tag === "ComponentSet")?.id ?? "");
    const texts = made("TEXT");

    expect(errors).toEqual([]);
    expect(set).toMatchObject({
      type: "COMPONENT_SET",
      name: "Tag",
    });
    expect(set?.parent?.id).toBe("3:1");
    expect(set?.children?.map(({ name, x }) => [name, x])).toEqual([
      ["Tone=Dark", 40],
      ["Tone=Light", 160],
    ]);
    expect(Object.keys(set?.componentPropertyDefinitions as object)).toEqual(["Tone", "Label#2:0"]);
    expect(texts.map(({ componentPropertyReferences }) => componentPropertyReferences)).toEqual([
      { characters: "Label#2:0" },
      { characters: "Label#2:0" },
    ]);
  });
});

describe("apply: notes", () => {
  it("writes notes with their categories, making a category the file lacks", async () => {
    await apply('<Frame id="3:1" note="Development: build it | Behavior: opens the modal | Plain"/>');

    expect(byId("3:1")?.annotations).toEqual([
      {
        label: "build it",
        categoryId: "cat-dev",
      },
      {
        label: "opens the modal",
        categoryId: "cat-2",
      },
      { label: "Plain" },
    ]);
  });
});

import { type ApplyChange, type ApplyError, changeOf, readApply } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { samePaints } from "../src/figma/paints.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

interface Applied {
  created: { line: number; ref: string; id: string; tag: string }[];
  changed: string[];
  errors: ApplyError[];
}

/** The changes core makes of an XML; `extra` adds what the server would (streams, SVGs, moves) by element ref. */
function changesOf(xml: string, extra: Record<string, (change: ApplyChange) => ApplyChange> = {}): ApplyChange[] {
  const { elements, errors } = readApply(xml);

  expect(errors).toEqual([]);

  return elements.map((element) => {
    const { change } = changeOf(element);

    return extra[change.ref]?.(change) ?? change;
  });
}

const apply = async (changes: ApplyChange[], options: { parent?: string } = {}) =>
  (await plugin.run("apply", {
    changes,
    ...options,
  })) as Applied;

/** A file's bytes sent the way the server sends them, in one chunk. */
async function send(stream: string, length: number): Promise<void> {
  await plugin.run("upload", {
    stream,
    offset: 0,
    chunk: btoa("x".repeat(length)),
    total: length,
  });
}

const withAsset = (patch: Record<string, string>) => (change: ApplyChange) => ({
  ...change,
  props: {
    ...change.props,
    asset: {
      ...(change.props.asset ?? {
        kind: "image" as const,
        src: "",
      }),
      ...patch,
    },
  },
});
const moved = (change: ApplyChange) => ({
  ...change,
  move: true,
});

let root: FakeNode;
let other: FakeNode;
let fake: ReturnType<typeof installFigma>;
const all = (from: FakeNode): FakeNode[] => [from, ...(from.children ?? []).flatMap(all)];
const byId = (id: string) => [...all(root), ...all(other), ...fake.writes.created].find((node) => node.id === id);
const made = (type: string) => fake.writes.created.filter((node) => node.type === type);

beforeEach(() => {
  other = tree({
    id: "5:0",
    type: "PAGE",
    name: "Other",
    children: [
      {
        id: "5:2",
        name: "Elsewhere",
      },
    ],
  });
  root = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Card",
        layoutMode: "VERTICAL",
        layoutSizingHorizontal: "FIXED",
        layoutSizingVertical: "HUG",
        children: [
          {
            id: "1:2",
            type: "TEXT",
            name: "Title",
            characters: "Hello",
            fontName: {
              family: "Inter",
              style: "Regular",
            },
          },
          {
            id: "1:3",
            name: "Side",
          },
        ],
      },
      {
        id: "3:1",
        name: "Board",
        layoutMode: "NONE",
        children: [],
      },
      {
        id: "4:2",
        type: "ELLIPSE",
        name: "Avatar",
        fills: [
          {
            type: "SOLID",
            color: {
              r: 0.85,
              g: 0.85,
              b: 0.85,
            },
          },
        ],
      },
      {
        id: "4:1",
        type: "RECTANGLE",
        name: "Photo",
        fills: [
          {
            type: "IMAGE",
            imageHash: "old",
            scaleMode: "FIT",
          },
        ],
      },
      {
        id: "2:1",
        type: "INSTANCE",
        name: "Heading",
        children: [
          {
            id: "I2:1;3:4",
            name: "Label box",
          },
        ],
      },
    ],
  });
  fake = installFigma(root, {
    pages: [other],
    fonts: [
      {
        family: "Inter",
        style: "Regular",
      },
    ],
  });
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("apply refused while Allow edits is off", () => {
  it("drops the files the call uploaded, as a finished call does", async () => {
    await send("img-off", 12);
    plugin.services.edits.allow(false);

    const changes = changesOf('<Image name="Photo" src="a.png" width="200px" height="100px"/>', {
      "new:1": withAsset({ stream: "img-off" }),
    });

    await expect(apply(changes, { parent: "3:1" })).rejects.toThrow(/Allow edits/);
    expect(plugin.services.uploads.bytes("img-off")).toBeUndefined();
  });
});

describe("apply: images and icons", () => {
  it("makes an image from its uploaded file and an icon from its SVG, sized as the XML says", async () => {
    await send("img-1", 12);

    const changes = changesOf(
      '<Image name="Photo" src="a.png" width="200px" height="100px"/>\n<Icon src="a.svg" width="48px"/>',
      {
        "new:1": withAsset({ stream: "img-1" }),
        "new:2": withAsset({ svg: '<svg width="24" height="24"/>' }),
      },
    );
    const { errors, created } = await apply(changes, { parent: "3:1" });
    const [image, icon] = created.map(({ id }) => byId(id));

    expect(errors).toEqual([]);
    expect(image).toMatchObject({
      type: "RECTANGLE",
      name: "Photo",
      width: 200,
      height: 100,
      fills: [
        {
          type: "IMAGE",
          imageHash: "hash-12",
          scaleMode: "FILL",
        },
      ],
    });
    expect(icon).toMatchObject({
      type: "FRAME",
      name: "a",
      width: 48,
      height: 48,
    });
    expect(icon?.parent?.id).toBe("3:1");
  });

  it("keeps every file of a call, however many, and makes no image whose file did not come", async () => {
    for (let index = 1; index <= 9; index++) {
      await send(`many-${index}`, index);
    }

    const { errors, created } = await apply(
      changesOf('<Image src="1.png"/>\n<Image src="lost.png"/>', {
        "new:1": withAsset({ stream: "many-1" }),
        "new:2": withAsset({ stream: "never-sent" }),
      }),
      { parent: "3:1" },
    );

    expect(errors).toEqual([
      expect.objectContaining({
        line: 2,
        message: expect.stringMatching(/lost\.png did not reach the plugin/),
      }),
    ]);
    expect(created.map(({ line }) => line)).toEqual([1]);
    expect(made("RECTANGLE")).toHaveLength(1);
  });

  it("swaps a background's image for another file's", async () => {
    const side = byId("1:3");

    if (side !== undefined) {
      side.fills = [
        {
          type: "IMAGE",
          imageHash: "hash-7",
          scaleMode: "FILL",
        },
      ];
    }

    await send("bg-5", 5);

    const { errors, changed } = await apply(
      changesOf('<Frame id="1:3" background="url(b.png)"/>', {
        "1:3": (change) => ({
          ...change,
          props: {
            ...change.props,
            fills: (change.props.fills ?? []).map((paint) =>
              paint.kind === "image"
                ? {
                    ...paint,
                    stream: "bg-5",
                  }
                : paint,
            ),
          },
        }),
      }),
    );

    expect(errors).toEqual([]);
    expect(changed).toEqual(["1:3"]);
    expect(byId("1:3")?.fills).toEqual([
      {
        type: "IMAGE",
        imageHash: "hash-5",
        scaleMode: "FILL",
      },
    ]);
  });

  it("fills an existing ellipse with a picture from a file, as a frame's background", async () => {
    await send("face-6", 6);

    const { errors, changed } = await apply(
      changesOf('<Ellipse id="4:2" background="url(face.png)"/>', {
        "4:2": (change) => ({
          ...change,
          props: {
            ...change.props,
            fills: (change.props.fills ?? []).map((paint) =>
              paint.kind === "image"
                ? {
                    ...paint,
                    stream: "face-6",
                  }
                : paint,
            ),
          },
        }),
      }),
    );

    expect(errors).toEqual([]);
    expect(changed).toEqual(["4:2"]);
    expect(byId("4:2")?.fills).toEqual([
      {
        type: "IMAGE",
        imageHash: "hash-6",
        scaleMode: "FILL",
      },
    ]);
  });

  it("tells paints of another image or another fit from the same ones", () => {
    const image = (imageHash: string, scaleMode: ImagePaint["scaleMode"]): ImagePaint => ({
      type: "IMAGE",
      imageHash,
      scaleMode,
    });

    expect(samePaints([image("a", "FILL")], [image("a", "FILL")])).toBe(true);
    expect(samePaints([image("a", "FILL")], [image("b", "FILL")])).toBe(false);
    expect(samePaints([image("a", "FIT")], [image("a", "FILL")])).toBe(false);
  });

  it("swaps an image by id and keeps how it fits", async () => {
    await send("img-2", 20);
    await apply(
      changesOf('<Image id="4:1" src="b.png"/>', {
        "4:1": withAsset({ stream: "img-2" }),
      }),
    );

    expect(byId("4:1")?.fills).toEqual([
      {
        type: "IMAGE",
        imageHash: "hash-20",
        scaleMode: "FIT",
      },
    ]);
  });
});

describe("apply: copies, slots and moves", () => {
  it("copies a layer and writes the copy's layers by the source's ids, the source untouched", async () => {
    const { errors, created } = await apply(
      changesOf('<Frame copyOf="1:1" name="Card 2"><Text id="1:2">New title</Text></Frame>'),
      { parent: "3:1" },
    );
    const copy = byId(created[0]?.id ?? "");

    expect(errors).toEqual([]);
    expect(copy?.name).toBe("Card 2");
    expect(copy?.parent?.id).toBe("3:1");
    expect(copy?.children?.[0]?.characters).toBe("New title");
    expect(byId("1:2")?.characters).toBe("Hello");
  });

  it("keeps a copy's own sizing and fill: only a layer made from nothing starts bare", async () => {
    const { errors, created } = await apply(changesOf('<Frame copyOf="1:1" name="Card 2"/>'), { parent: "3:1" });

    expect(errors).toEqual([]);
    expect(byId(created[0]?.id ?? "")).toMatchObject({
      layoutSizingHorizontal: "FIXED",
      layoutSizingVertical: "HUG",
    });
  });

  it("checks a copy on a dry run without its own ids", async () => {
    const result = (await plugin.run("apply", {
      changes: changesOf('<Frame copyOf="1:1" name="Card 2"><Text id="1:2">New title</Text></Frame>'),
      parent: "3:1",
      dryRun: true,
    })) as Applied;

    expect(result.errors).toEqual([]);
  });

  it("makes a slot in a new component, its content inside it", async () => {
    const { errors } = await apply(
      changesOf('<Component name="Card"><Slot name="Content"><Frame name="Inside"/></Slot></Component>'),
      { parent: "3:1" },
    );
    const slot = fake.writes.created.find(({ type }) => type === "SLOT");

    expect(errors).toEqual([]);
    expect(slot?.parent?.type).toBe("COMPONENT");
    expect(slot?.name).toBe("Content");
    expect(slot?.children?.map(({ name }) => name)).toEqual(["Inside"]);
  });

  it("moves a layer into another frame and reorders one, keeping ids, and refuses moving out of an instance", async () => {
    await apply(changesOf('<Frame id="3:1"><Frame id="1:3"/></Frame>', { "1:3": moved }));

    expect(byId("3:1")?.children?.map(({ id }) => id)).toEqual(["1:3"]);

    await apply(changesOf('<Frame id="1:1"><Frame id="3:1"/><Text id="1:2"/></Frame>', { "3:1": moved }));

    expect(byId("1:1")?.children?.map(({ id }) => id)).toEqual(["3:1", "1:2"]);

    const { errors } = await apply(changesOf('<Frame id="3:1"><Frame id="I2:1;3:4"/></Frame>', { "I2:1;3:4": moved }));

    expect(errors).toEqual([expect.objectContaining({ message: expect.stringMatching(/instance/) })]);
  });

  it("still writes a layer's own attributes when it cannot move", async () => {
    const { errors } = await apply(
      changesOf('<Frame id="3:1"><Frame id="I2:1;3:4" name="Renamed"/></Frame>', { "I2:1;3:4": moved }),
    );

    expect(errors).toEqual([expect.objectContaining({ message: expect.stringMatching(/instance/) })]);
    expect(byId("I2:1;3:4")?.name).toBe("Renamed");
  });

  it("loads the page of a layer a new one goes next to", async () => {
    const { errors, created } = await apply(changesOf('<Frame name="Next" after="5:2"/>'));

    expect(errors).toEqual([]);
    expect(byId(created[0]?.id ?? "")?.parent?.id).toBe("5:0");
    expect(fake.writes.calls).toContainEqual(
      expect.objectContaining({
        node: "5:0",
        method: "loadAsync",
      }),
    );
  });
});

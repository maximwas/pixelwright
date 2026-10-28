import { describe, expect, it } from "vitest";
import {
  type ApplyError,
  assessElements,
  CurrentLayers,
  changesToSend,
  type EntriesRead,
  type FileChanges,
  layersToRead,
  movedRefs,
  planChanges,
  readApply,
  type SnapshotNode,
  sortedErrors,
} from "../src/index.ts";
import { layer, textLayer } from "./helpers/layers.ts";

const shape = (id: string) =>
  layer({
    id,
    name: id,
    type: "RECTANGLE",
  });

/** Board 3:1 holds Row 9:1 (9:2, 9:3, 9:4), a rectangle 3:2 and a text 1:2. */
const row = layer({
  id: "9:1",
  name: "Row",
  children: [shape("9:2"), shape("9:3"), shape("9:4")],
});
const board = layer({
  id: "3:1",
  name: "Board",
  children: [row, shape("3:2"), textLayer("1:2", "Title", [["Hello"]])],
});

function entries(roots: readonly SnapshotNode[], missing: readonly string[] = []): EntriesRead {
  return {
    roots: roots.map((node) => ({
      node,
      parent: null,
    })),
    missing: [...missing],
    styles: {},
    variables: {},
  };
}

/** The plan of a call over the board, as design_apply makes it before files are attached. */
function plan(xml: string, layers = CurrentLayers.of(entries([board]))) {
  const { elements } = readApply(xml);
  const { assessed, errors } = assessElements(elements, layers);

  return {
    elements,
    refused: errors,
    ...planChanges({
      elements,
      assessed,
      layers,
      files: new Map(),
    }),
  };
}

describe("layersToRead", () => {
  it("reads the layers changed, the sources a copy's layers stand for and the layers copied, each once", () => {
    const { elements } = readApply(
      [
        '<Frame id="9:1"><Rectangle id="9:2"/></Frame>',
        '<Frame copyOf="3:1"><Rectangle id="3:2"/></Frame>',
        '<Frame copyOf="9:1"/>',
        '<Frame copyOf="9:1"/>',
      ].join("\n"),
    );

    expect(layersToRead(elements)).toEqual(["9:1", "9:2", "3:1", "3:2"]);
  });

  it("does not read what a new instance's layers name: they start as the component's", () => {
    const { elements } = readApply('<Instance component="Heading"><Text id="I2:1;3:5">Hi</Text></Instance>');

    expect(layersToRead(elements)).toEqual([]);
  });
});

describe("CurrentLayers", () => {
  it("indexes every layer read with its parent, and knows the ids the file does not hold", () => {
    const layers = CurrentLayers.of(entries([board], ["99:9"]));

    expect(layers.entry("9:3")).toEqual({
      node: row.children?.[1],
      parent: row,
    });
    expect(layers.entry("3:1")?.parent).toBeNull();
    expect(layers.entry("99:9")).toBeUndefined();
    expect([layers.isMissing("99:9"), layers.isMissing("9:3")]).toEqual([true, false]);
  });
});

describe("assessElements", () => {
  it("refuses a named layer the read could not take, and passes an id the file lacks, a copy and a create", () => {
    const cut = CurrentLayers.of(
      entries(
        [
          {
            ...board,
            children: [],
          },
        ],
        ["99:9"],
      ),
    );
    const { elements } = readApply(
      [
        '<Frame id="3:1" gap="8px"/>',
        '<Rectangle id="9:2" width="10px"/>',
        '<Frame id="99:9" gap="8px"/>',
        '<Frame copyOf="9:1"/>',
        '<Frame name="New"/>',
      ].join("\n"),
    );
    const { assessed, errors } = assessElements(elements, cut);

    expect(errors).toEqual([
      {
        line: 2,
        column: 1,
        id: "9:2",
        message:
          "design_apply could not read 9:2's current state: the layers this call names, with every layer inside them, are more than one call reads.",
        hint: 'Leave out the layers that stay as they are: an element alone (<Frame id="…"/>) moves or changes its layer with everything inside it. Or split the call.',
      },
    ]);
    expect(
      assessed.map(({ element, entry, now }) => [element.line, entry?.node.id ?? null, now !== undefined]),
    ).toEqual([
      [1, "3:1", true],
      [3, null, false],
      [4, null, false],
      [5, null, false],
    ]);
  });
});

describe("planChanges", () => {
  const picture = '<Rectangle id="3:2" opacity="lots" background="url(a.png)"/>';

  /** The picture's element compared with a layer that holds its background already. */
  function held(files: ReadonlyMap<string, FileChanges>) {
    const layers = CurrentLayers.of(entries([board]));
    const { elements } = readApply(picture);
    const { assessed } = assessElements(elements, layers);

    return planChanges({
      elements,
      assessed: assessed.map((assessment) => ({
        ...assessment,
        now: {
          attributes: new Set(["background"]),
          text: true,
          visible: true,
          current: {},
        },
      })),
      layers,
      files,
    });
  }

  it("writes again an attribute held when its file holds another image", () => {
    const same = held(new Map());
    const other = held(
      new Map([
        [
          "3:2",
          {
            changed: ["background"],
            problems: [],
          },
        ],
      ]),
    );

    expect(same.changes[0]?.props.fills).toBeUndefined();
    expect(other.changes[0]?.props.fills).toEqual([
      {
        kind: "image",
        src: "a.png",
        scaleMode: "FILL",
      },
    ]);
  });

  it("reports an element's own errors before its files'", () => {
    const { errors } = held(
      new Map([
        [
          "3:2",
          {
            changed: [],
            problems: [
              {
                attribute: "background",
                message: "a.png is not a file the server can read.",
              },
            ],
          },
        ],
      ]),
    );

    expect(errors).toEqual([
      {
        line: 1,
        column: 1,
        id: "3:2",
        attribute: "opacity",
        message: 'opacity="lots" is not a number from 0 to 1 or a percent.',
      },
      {
        line: 1,
        column: 1,
        id: "3:2",
        attribute: "background",
        message: "a.png is not a file the server can read.",
      },
    ]);
  });

  it("marks the changes that move their layer", () => {
    const { changes } = plan('<Frame id="3:1"><Rectangle id="9:2"/></Frame>');

    expect(changes.map(({ ref, move }) => [ref, move ?? false])).toEqual([
      ["3:1", false],
      ["9:2", true],
    ]);
  });
});

describe("movedRefs", () => {
  const moved = (xml: string, layers = CurrentLayers.of(entries([board]))) => [
    ...movedRefs(readApply(xml).elements, layers),
  ];

  it("moves a layer placed with before or after, even at the top", () => {
    expect(moved('<Rectangle id="9:3" before="9:2"/>\n<Rectangle id="9:2" after="9:4"/>')).toEqual(["9:3", "9:2"]);
  });

  it("moves a layer under another parent element, a new one included", () => {
    expect(moved('<Frame id="3:1"><Rectangle id="9:2"/></Frame>')).toEqual(["9:2"]);
    expect(moved('<Frame name="New"><Rectangle id="9:2"/></Frame>')).toEqual(["9:2"]);
  });

  it("moves a layer listed after one it stands behind, and leaves layers listed in their order", () => {
    expect(moved('<Frame id="9:1"><Rectangle id="9:3"/><Rectangle id="9:4"/><Rectangle id="9:2"/></Frame>')).toEqual([
      "9:2",
    ]);
    expect(moved('<Frame id="9:1"><Rectangle id="9:2"/><Rectangle id="9:4"/></Frame>')).toEqual([]);
  });

  it("never moves top-level layers for their order", () => {
    expect(moved('<Rectangle id="9:4"/>\n<Rectangle id="9:2"/>')).toEqual([]);
  });

  it("counts a refused element as a parent", () => {
    const rowOnly = CurrentLayers.of({
      ...entries([]),
      roots: [
        {
          node: row,
          parent: board,
        },
      ],
    });
    const { refused } = plan('<Frame id="3:1"><Rectangle id="9:2"/></Frame>', rowOnly);

    expect(refused.map(({ id }) => id)).toEqual(["3:1"]);
    expect(moved('<Frame id="3:1"><Rectangle id="9:2"/></Frame>', rowOnly)).toEqual(["9:2"]);
  });
});

describe("changesToSend", () => {
  it("sends what writes, and a placed layer with its parent and the layers beside it", () => {
    const { changes } = plan(
      [
        '<Frame id="3:1">',
        '  <Frame id="9:1"><Rectangle id="9:2"/></Frame>',
        '  <Rectangle name="New"/>',
        "</Frame>",
        '<Rectangle id="3:2" opacity="0.5"/>',
        '<Text id="1:2">Hi</Text>',
      ].join("\n"),
    );

    expect(changesToSend(changes).map(({ tag, id }) => `${tag} ${id}`)).toEqual([
      "Frame 3:1",
      "Frame 9:1",
      "Rectangle null",
      "Rectangle 3:2",
      "Text 1:2",
    ]);
  });

  it("sends nothing when nothing writes", () => {
    expect(changesToSend(plan('<Frame id="9:1"><Rectangle id="9:2"/></Frame>').changes)).toEqual([]);
  });
});

describe("sortedErrors", () => {
  it("orders errors by line then column, keeping the order of errors at one place", () => {
    const at = (line: number, column: number, message: string): ApplyError => ({
      line,
      column,
      message,
    });

    expect(
      sortedErrors([at(2, 5, "b"), at(1, 9, "a"), at(2, 5, "c"), at(2, 1, "d")]).map(({ message }) => message),
    ).toEqual(["a", "d", "b", "c"]);
  });
});

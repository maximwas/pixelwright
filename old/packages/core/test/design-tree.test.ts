import { describe, expect, it } from "vitest";
import {
  type DesignElement,
  designTree,
  designXml,
  joinedContent,
  parseXml,
  type Snapshot,
  type XmlChild,
} from "../src/index.ts";
import { fixture } from "./helpers/fixtures.ts";
import { layer } from "./helpers/layers.ts";
import { oddTextSnapshot } from "./helpers/odd-text.ts";

/** An element as XML reads it back: its tag, its attributes by name, then its text, spans and child elements. */
interface ReadBack {
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly (string | ReadBack)[];
}

function fromTree(element: DesignElement): ReadBack {
  return {
    tag: element.tag,
    attributes: Object.fromEntries(element.attributes),
    children: [
      ...joinedContent(element.content ?? []).map((piece) =>
        piece.kind === "text"
          ? piece.value
          : {
              tag: "Span",
              attributes: Object.fromEntries(piece.attributes),
              children: piece.value === "" ? [] : [piece.value],
            },
      ),
      ...element.children.map(fromTree),
    ],
  };
}

function fromXml(child: XmlChild): string | ReadBack {
  return child.kind === "text"
    ? child.value
    : {
        tag: child.type,
        attributes: { ...child.props },
        children: child.children.map(fromXml),
      };
}

const SNAPSHOTS: readonly (readonly [string, () => Snapshot])[] = [
  ...["orbit-plans", "orbit-pricing", "orbit-customers", "orbit-desktop-top"].map(
    (name) => [name, () => fixture(name)] as const,
  ),
  ["quotes, line breaks, U+2028 and texts of odd spaces", oddTextSnapshot],
];

describe("the design tree", () => {
  for (const [name, snapshotOf] of SNAPSHOTS) {
    it(`reads as its XML reads back: ${name}`, () => {
      const snapshot = snapshotOf();
      const { root } = designTree(snapshot);

      expect(root === null ? [] : [fromTree(root)]).toEqual(parseXml(designXml(snapshot).xml).map(fromXml));
    });
  }

  it("writes a frame holding only slices as one empty element, with nothing said cut", () => {
    const snapshot: Snapshot = {
      root: layer({
        id: "1:1",
        name: "Screen",
        layoutMode: "VERTICAL",
        children: [
          layer({
            id: "1:2",
            name: "Marks",
            children: [
              layer({
                id: "1:3",
                name: "Export area",
                type: "SLICE",
              }),
            ],
          }),
        ],
      }),
      styles: {},
      variables: {},
    };
    const { xml } = designXml(snapshot);

    expect(xml).toMatch(/^ {2}<Frame id="1:2" [^\n]*\/>$/m);
    expect(xml).not.toContain("$truncated");
  });
});

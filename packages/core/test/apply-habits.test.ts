import { describe, expect, it } from "vitest";
import { changeOf, readApply } from "../src/index.ts";

/** The Figma props of the first element of a snippet, with every error the read and the mapping gave. */
function written(xml: string) {
  const { elements, errors } = readApply(xml);
  const [first] = elements;

  if (first === undefined) {
    throw new Error(`nothing read: ${JSON.stringify(errors)}`);
  }

  const { change, errors: mapped } = changeOf(first);

  return {
    props: change.props,
    errors: [...errors, ...mapped],
  };
}

describe("design_apply: what agents write out of habit", () => {
  it("answers x and y with left and top, as CSS places a layer, not with 'Did you mean id?'", () => {
    const { errors } = readApply('<Image x="539" y="20" src="photo.png" width="363px" height="200px"/>');

    expect(
      errors.map(({ attribute, hint }) => ({
        attribute,
        hint,
      })),
    ).toEqual([
      {
        attribute: "x",
        hint: 'Write position="absolute" left="539px": CSS places a layer by left and top.',
      },
      {
        attribute: "y",
        hint: 'Write position="absolute" top="20px": CSS places a layer by left and top.',
      },
    ]);
  });

  it("answers Figma's own names with the CSS that writes them", () => {
    const { errors } = readApply('<Frame fill="#FFF" stroke="#000" rotation="15" corner-radius="8px"/>');

    expect(
      errors.map(({ attribute, hint }) => ({
        attribute,
        hint,
      })),
    ).toEqual([
      {
        attribute: "fill",
        hint: 'Write background="#FFF" (color on a Text).',
      },
      {
        attribute: "stroke",
        hint: 'Write border="1px solid #000".',
      },
      {
        attribute: "rotation",
        hint: 'Write transform="rotate(15deg)".',
      },
      {
        attribute: "corner-radius",
        hint: 'Write border-radius="8px".',
      },
    ]);
  });

  it("takes a bare number as px for sizes, places, gaps, paddings and radii", () => {
    const bare = written(
      '<Frame display="flex" position="absolute" left="539" top="20" width="363" height="200" min-width="100" gap="16" padding="8 16" border-radius="12"/>',
    );
    const px = written(
      '<Frame display="flex" position="absolute" left="539px" top="20px" width="363px" height="200px" min-width="100px" gap="16px" padding="8px 16px" border-radius="12px"/>',
    );

    expect(bare.errors).toEqual([]);
    expect(bare.props).toEqual(px.props);
  });

  it("keeps a bare line height a multiple of the font size, as CSS does", () => {
    const { props, errors } = written("<Text font=\"400 16px/1.5 'Inter'\">Words</Text>");

    expect(errors).toEqual([]);
    expect(props).toMatchObject({
      font: {
        lineHeight: {
          unit: "PERCENT",
          value: 150,
        },
      },
    });
  });

  it("answers src on a shape or a frame with its background, which takes a picture on any of them", () => {
    const { errors } = written('<Ellipse id="4:2" src="face.png"/>');

    expect(
      errors.map(({ attribute, hint }) => ({
        attribute,
        hint,
      })),
    ).toEqual([
      {
        attribute: "src",
        hint: 'Fill it with the picture by its background: background="url(face.png)".',
      },
    ]);
  });

  it("takes HTML's lowercase <span> as a <Span>, and any tag in another case as that tag", () => {
    const { elements, errors } = readApply('<text name="Note">Hi <span color="#FF0000">there</span></text>');

    expect(errors).toEqual([]);
    expect(elements.map(({ tag }) => tag)).toEqual(["Text"]);
    expect(elements[0]?.content?.[1]).toMatchObject({
      kind: "span",
      attributes: { color: "#FF0000" },
      value: "there",
    });
  });

  it("reads the elements a <Root> wraps, as XML documents have one root, as the top level", () => {
    const { elements, errors } = readApply('<Root>\n  <Frame id="1:1" opacity="0.5"/>\n  <Frame name="New"/>\n</Root>');

    expect(errors).toEqual([]);
    expect(elements.map(({ tag, parent, line }) => [tag, parent, line])).toEqual([
      ["Frame", null, 2],
      ["Frame", null, 3],
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { type ApplyElement, changeOf, readApply } from "../src/index.ts";

/** The first element of a snippet. */
function element(xml: string): ApplyElement {
  const { elements, errors } = readApply(xml);
  const [first] = elements;

  if (first === undefined) {
    throw new Error(`nothing read: ${JSON.stringify(errors)}`);
  }

  return first;
}

/** The change of the first element of a snippet, and the errors; `current` is what the layer has now. */
function change(
  xml: string,
  now?: { unchanged?: string[]; current?: Record<string, string>; text?: boolean; visible?: boolean },
) {
  const { errors } = readApply(xml);
  const result = changeOf(
    element(xml),
    now === undefined
      ? undefined
      : {
          attributes: new Set(now.unchanged ?? []),
          text: now.text ?? false,
          visible: now.visible ?? true,
          current: now.current ?? {},
        },
  );

  return {
    ...result,
    errors: [...errors, ...result.errors],
  };
}

const props = (xml: string, now?: Parameters<typeof change>[1]) => change(xml, now).change.props;
const failed = (xml: string, now?: Parameters<typeof change>[1]) =>
  change(xml, now).errors.map(({ attribute }) => attribute);

const DARK = {
  r: 25 / 255,
  g: 26 / 255,
  b: 35 / 255,
  a: 1,
};

describe("CSS to Figma: layout", () => {
  it("reads flex: direction, wrap, spacing per axis, padding and alignment", () => {
    expect(
      props(
        '<Frame id="1:1" display="flex" flex-direction="column" flex-wrap="wrap" gap="12px" column-gap="40px" padding="8px 16px" justify-content="space-between" align-items="center" align-content="space-between"/>',
      ),
    ).toEqual({
      layoutMode: "VERTICAL",
      layoutWrap: "WRAP",
      itemSpacing: 12,
      counterAxisSpacing: 40,
      padding: [8, 16, 8, 16],
      primaryAxisAlignItems: "SPACE_BETWEEN",
      counterAxisAlignItems: "CENTER",
      counterAxisAlignContent: "SPACE_BETWEEN",
    });
    expect(props('<Frame id="1:1" display="flex" flex-wrap="wrap" gap="12px" row-gap="40px"/>')).toMatchObject({
      layoutMode: "HORIZONTAL",
      itemSpacing: 12,
      counterAxisSpacing: 40,
    });
  });

  it("reads the gap along the direction as CSS does: column-gap in a row, row-gap in a column", () => {
    expect(props('<Frame display="flex" column-gap="20px"/>')).toEqual({
      layoutMode: "HORIZONTAL",
      itemSpacing: 20,
    });
    expect(props('<Frame display="flex" flex-direction="column" row-gap="20px"/>')).toEqual({
      layoutMode: "VERTICAL",
      itemSpacing: 20,
    });
  });

  it("hides with display none, turns auto layout off with block, and refuses what Figma lacks", () => {
    expect(props('<Frame id="1:1" display="none"/>')).toEqual({ visible: false });
    expect(props('<Frame id="1:1" display="block"/>')).toEqual({ layoutMode: "NONE" });
    expect(props('<Frame id="1:1" display="flex"/>', { visible: false })).toEqual({
      visible: true,
      layoutMode: "HORIZONTAL",
    });
    expect(failed('<Frame display="flex" flex-direction="row-reverse"/>')).toEqual(["flex-direction"]);
    expect(failed('<Frame gap="8px"/>')).toEqual(["gap"]);
    expect(change('<Frame gap="8px"/>').errors[0]?.message).toMatch(/display/);
  });

  it("reads grid tracks, gaps and where a child sits", () => {
    expect(
      props(
        '<Frame id="1:1" display="grid" grid-template-columns="1fr 1fr 200px" grid-template-rows="repeat(2, auto)" column-gap="16px" row-gap="8px"/>',
      ),
    ).toEqual({
      layoutMode: "GRID",
      gridColumns: [
        {
          type: "FLEX",
          value: 1,
        },
        {
          type: "FLEX",
          value: 1,
        },
        {
          type: "FIXED",
          value: 200,
        },
      ],
      gridRows: [{ type: "HUG" }, { type: "HUG" }],
      gridColumnGap: 16,
      gridRowGap: 8,
    });
    expect(props('<Frame id="1:1" display="grid" gap="10px"/>')).toEqual({
      layoutMode: "GRID",
      gridColumnGap: 10,
      gridRowGap: 10,
    });
    expect(props('<Frame id="1:2" grid-row="1" grid-column="2 / span 2" justify-self="center"/>')).toEqual({
      gridRow: {
        anchor: 0,
        span: 1,
      },
      gridColumn: {
        anchor: 1,
        span: 2,
      },
      justifySelf: "CENTER",
    });
  });

  it("writes only the grid tracks a call gives: new columns leave alone the rows Figma holds", () => {
    // Figma adds a row for children that do not fit: rows read earlier and sent back would delete it, a taken row.
    const written = props('<Frame id="1:1" grid-template-columns="repeat(3, 1fr)"/>', {
      current: {
        display: "grid",
        "grid-template-columns": "1fr 1fr",
        "grid-template-rows": "auto auto",
      },
    });

    expect(written).toHaveProperty("gridColumns");
    expect(written).not.toHaveProperty("gridRows");
  });

  it("refuses justify-content and align-items on a grid in plain words, which Figma refuses raw", () => {
    const { errors, change: written } = change(
      '<Frame id="1:1" display="grid" justify-content="center" align-items="center"/>',
    );

    expect(
      errors.map(({ attribute, hint }) => ({
        attribute,
        hint,
      })),
    ).toEqual([
      {
        attribute: "justify-content",
        hint: 'Give its children justify-self and align-self ("stretch" fills the cell).',
      },
      {
        attribute: "align-items",
        hint: 'Give its children justify-self and align-self ("stretch" fills the cell).',
      },
    ]);
    expect(written.props).not.toHaveProperty("primaryAxisAlignItems");
    expect(written.props).not.toHaveProperty("counterAxisAlignItems");
  });

  it("reads sizes, filling, hugging and limits, a token where a length may be one", () => {
    expect(
      props('<Frame id="1:1" width="300px" height="var(--card-h)" min-width="120px" flex="1" align-self="stretch"/>'),
    ).toEqual({
      width: 300,
      height: { token: "--card-h" },
      minWidth: 120,
      grow: true,
      alignSelf: "STRETCH",
    });
    expect(props('<Frame id="1:1" width="auto" max-width="none" flex="none"/>')).toEqual({
      width: "HUG",
      maxWidth: null,
      grow: false,
    });
  });

  it("reads absolute placement and constraints from the edges, the centre and percents", () => {
    expect(props('<Frame id="1:1" position="absolute" left="10px" top="20px"/>')).toEqual({
      absolute: true,
      horizontal: {
        kind: "MIN",
        offset: 10,
      },
      vertical: {
        kind: "MIN",
        offset: 20,
      },
    });
    expect(props('<Frame id="1:1" position="absolute" left="auto" right="20px" bottom="0"/>')).toMatchObject({
      horizontal: {
        kind: "MAX",
        offset: 20,
      },
      vertical: {
        kind: "MAX",
        offset: 0,
      },
    });
    expect(
      props('<Frame id="1:1" position="absolute" left="calc(50% - 30px)" top="10px" bottom="10px"/>'),
    ).toMatchObject({
      horizontal: {
        kind: "CENTER",
        offset: -30,
      },
      vertical: {
        kind: "STRETCH",
        start: 10,
        end: 10,
      },
    });
    expect(props('<Frame id="1:1" position="absolute" left="10%" width="50%" top="60%" height="25%"/>')).toMatchObject({
      horizontal: {
        kind: "SCALE",
        start: 10,
        size: 50,
      },
      vertical: {
        kind: "SCALE",
        start: 60,
        size: 25,
      },
    });
  });

  it("refuses placement CSS would not apply: offsets without position, fixed", () => {
    expect(failed('<Frame left="10px"/>')).toEqual(["left"]);
    expect(failed('<Frame position="fixed"/>')).toEqual(["position"]);
  });

  it("stretches between both edges with a size given too, as CSS sizes it: the size wins, auto leaves it to them", () => {
    expect(props('<Frame id="1:1" position="absolute" top="0" bottom="0" height="120px"/>')).toEqual({
      absolute: true,
      vertical: {
        kind: "STRETCH",
        start: 0,
        end: 0,
      },
      height: 120,
    });
    expect(props('<Frame id="1:1" position="absolute" left="8px" right="8px" width="auto"/>')).toEqual({
      absolute: true,
      horizontal: {
        kind: "STRETCH",
        start: 8,
        end: 8,
      },
    });
  });

  it("reads turns, mirrors, opacity, clipping and radii", () => {
    expect(
      props('<Frame id="1:1" transform="rotate(-30deg)" opacity="0.5" overflow="hidden" border-radius="8px 8px 0 0"/>'),
    ).toEqual({
      rotation: 30,
      mirror: false,
      opacity: 0.5,
      clipsContent: true,
      cornerRadius: [8, 8, 0, 0],
    });
    expect(
      props('<Frame id="1:1" transform="scaleX(-1)" opacity="40%" border-radius="var(--radius-m) 0 0 0"/>'),
    ).toEqual({
      mirror: true,
      rotation: 0,
      opacity: 0.4,
      cornerRadius: [{ token: "--radius-m" }, 0, 0, 0],
    });
  });
});

describe("CSS to Figma: paint", () => {
  it("reads colours, tokens, a token with opacity, stacked layers bottom first, and none", () => {
    expect(props('<Frame id="1:1" background="#191A23"/>').fills).toEqual([
      {
        kind: "color",
        color: DARK,
      },
    ]);
    expect(props('<Frame id="1:1" background="var(--Dark)"/>').fills).toEqual([
      {
        kind: "token",
        token: "--Dark",
        opacity: 1,
      },
    ]);
    expect(props('<Frame id="1:1" background="color-mix(in srgb, var(--Dark) 50%, transparent)"/>').fills).toEqual([
      {
        kind: "token",
        token: "--Dark",
        opacity: 0.5,
      },
    ]);
    expect(
      props('<Frame id="1:1" background="linear-gradient(rgba(25, 26, 35, 0.5), rgba(25, 26, 35, 0.5)), #FFF"/>').fills,
    ).toEqual([
      {
        kind: "color",
        color: {
          r: 1,
          g: 1,
          b: 1,
          a: 1,
        },
      },
      {
        kind: "color",
        color: {
          ...DARK,
          a: 0.5,
        },
      },
    ]);
    expect(props('<Frame id="1:1" background="none"/>').fills).toEqual([]);
  });

  it("reads borders and outlines as strokes: weight, side, dash, inside or outside, none", () => {
    expect(props('<Frame id="1:1" border="1px solid var(--Dark)"/>').strokes).toEqual({
      paints: [
        {
          kind: "token",
          token: "--Dark",
          opacity: 1,
        },
      ],
      weight: 1,
      align: "INSIDE",
      dash: false,
    });
    expect(props('<Frame id="1:1" outline="2px dashed #191A23"/>').strokes).toEqual({
      paints: [
        {
          kind: "color",
          color: DARK,
        },
      ],
      weight: 2,
      align: "OUTSIDE",
      dash: true,
    });
    expect(props('<Frame id="1:1" border-bottom="1px solid #191A23"/>').strokes).toEqual({
      paints: [
        {
          kind: "color",
          color: DARK,
        },
      ],
      sides: {
        top: 0,
        right: 0,
        bottom: 1,
        left: 0,
      },
      align: "INSIDE",
      dash: false,
    });
    expect(props('<Frame id="1:1" border="none"/>').strokes).toEqual({
      paints: [],
      align: "INSIDE",
      dash: false,
    });
    expect(failed('<Frame id="1:1" border-top="1px solid #000" border-bottom="1px solid #FFF"/>')).toEqual([
      "border-top",
    ]);
  });

  it("reads shadows bottom first, inset ones inner, blurs at Figma's double radius, an effect token", () => {
    expect(
      props(
        '<Frame id="1:1" box-shadow="inset 0 -1px 0 0 #191A23, rgba(25, 26, 35, 0.25) 0 4px 8px 0" backdrop-filter="blur(10px)"/>',
      ).effects,
    ).toEqual([
      {
        type: "BACKGROUND_BLUR",
        radius: 20,
      },
      {
        type: "DROP_SHADOW",
        color: {
          ...DARK,
          a: 0.25,
        },
        x: 0,
        y: 4,
        radius: 8,
        spread: 0,
      },
      {
        type: "INNER_SHADOW",
        color: DARK,
        x: 0,
        y: -1,
        radius: 0,
        spread: 0,
      },
    ]);
    expect(props('<Frame id="1:1" box-shadow="var(--Card-shadow)"/>').effects).toEqual({ token: "--Card-shadow" });
    expect(props('<Frame id="1:1" box-shadow="none"/>').effects).toEqual([]);
  });

  it("refuses what it cannot write yet, naming the attribute, in the element's order", () => {
    const { errors } = change(
      '<Frame id="1:1" display="flex" gap="big" background="repeating-linear-gradient(90deg, #000, #FFF 10%)" border-radius="1em"/>',
    );

    expect(errors.map(({ attribute }) => attribute)).toEqual(["gap", "background", "border-radius"]);
    expect(errors[1]?.message).toMatch(/gradient/);
  });
});

describe("CSS to Figma: text", () => {
  it("reads the font shorthand, spacing, case, decoration, alignment, wrapping, colour and truncation", () => {
    expect(
      props(
        '<Text id="1:1" font="italic 700 16px/24px \'Inter\'" letter-spacing="0.07em" text-transform="uppercase" text-decoration="underline wavy #F00" text-underline-offset="3px" text-decoration-thickness="0.1em" text-align="center" text-wrap="balance" color="var(--Black)" overflow="hidden" text-overflow="ellipsis" white-space="nowrap" textStyle="h3" href="https://example.com">Hi</Text>',
      ),
    ).toEqual({
      textStyle: "h3",
      hyperlink: "https://example.com",
      font: {
        family: "Inter",
        weight: 700,
        italic: true,
        size: 16,
        lineHeight: {
          unit: "PIXELS",
          value: 24,
        },
      },
      letterSpacing: {
        unit: "PERCENT",
        value: 7,
      },
      textCase: "UPPER",
      textDecoration: {
        line: "UNDERLINE",
        style: "WAVY",
        color: {
          r: 1,
          g: 0,
          b: 0,
          a: 1,
        },
        offset: {
          unit: "PIXELS",
          value: 3,
        },
        thickness: {
          unit: "PERCENT",
          value: 10,
        },
      },
      textAlignHorizontal: "CENTER",
      textWrapStyle: "BALANCE",
      textFills: [
        {
          kind: "token",
          token: "--Black",
          opacity: 1,
        },
      ],
      truncate: true,
    });
    expect(
      props('<Text id="1:1" font="400 20px/normal \'Space Grotesk\', sans-serif" letter-spacing="1.5px">Hi</Text>'),
    ).toMatchObject({
      font: {
        family: "Space Grotesk",
        weight: 400,
        italic: false,
        size: 20,
        lineHeight: { unit: "AUTO" },
      },
      letterSpacing: {
        unit: "PIXELS",
        value: 1.5,
      },
    });
  });

  it("joins text and spans into characters and runs", () => {
    expect(
      change('<Text id="1:1">Hello <Span font="700 16px/normal \'Inter\'" href="https://x.y">world</Span>!</Text>')
        .change.text,
    ).toEqual({
      characters: "Hello world!",
      runs: [
        {
          start: 6,
          end: 11,
          props: {
            font: {
              family: "Inter",
              weight: 700,
              italic: false,
              size: 16,
              lineHeight: { unit: "AUTO" },
            },
            hyperlink: "https://x.y",
          },
        },
      ],
    });
  });

  it("restyles with the element's own overrides and its runs, as Figma does when a style is applied", () => {
    const restyled = change(
      '<Text id="1:1" textStyle="h2" font="700 16px/24px \'Inter\'">Hi <Span color="#F00">there</Span></Text>',
      {
        unchanged: ["id", "font"],
        text: true,
        current: {
          font: "700 16px/24px 'Inter'",
          "letter-spacing": "0.1em",
        },
      },
    ).change;

    expect(Object.keys(restyled.props)).toEqual(["textStyle", "font"]);
    expect(restyled.text?.runs).toHaveLength(1);
  });
});

describe("what the layer has now completes what Figma keeps in one property", () => {
  it("a gap keeps the direction and wrap the layer has", () => {
    expect(
      props('<Frame id="1:1" column-gap="24px"/>', {
        current: {
          display: "flex",
          "flex-direction": "column",
          "flex-wrap": "wrap",
          gap: "12px",
          "column-gap": "40px",
        },
      }),
    ).toEqual({
      layoutMode: "VERTICAL",
      layoutWrap: "WRAP",
      itemSpacing: 12,
      counterAxisSpacing: 24,
    });
  });

  it("a padding side keeps the other sides the layer has, their tokens too", () => {
    const current = {
      display: "flex",
      padding: "var(--space-8) 16px",
    };

    expect(change('<Frame id="1:1" padding-top="12px"/>', { current }).change).toMatchObject({
      props: {
        padding: [12, 16, { token: "--space-8" }, 16],
      },
      sources: { padding: "padding-top" },
    });
    expect(
      props('<Frame display="flex" padding="4px" padding-left="var(--space-8)" padding-right="0"/>').padding,
    ).toEqual([4, 0, 4, { token: "--space-8" }]);
    expect(failed('<Frame id="1:1" padding-bottom="wide"/>', { current })).toEqual(["padding-bottom"]);
    expect(failed('<Text id="1:2" padding-top="4px"/>')).toEqual(["padding-top"]);
  });

  it("a blur keeps the shadows, a side keeps the other sides, an offset keeps the underline", () => {
    expect(
      props('<Frame id="1:1" filter="blur(2px)"/>', { current: { "box-shadow": "0 4px 8px 0 #191A23" } }).effects,
    ).toEqual([
      {
        type: "LAYER_BLUR",
        radius: 4,
      },
      {
        type: "DROP_SHADOW",
        color: DARK,
        x: 0,
        y: 4,
        radius: 8,
        spread: 0,
      },
    ]);
    expect(
      props('<Frame id="1:1" border-bottom="2px solid #191A23"/>', {
        current: { "border-top": "2px solid #191A23" },
      }).strokes?.sides,
    ).toEqual({
      top: 2,
      right: 0,
      bottom: 2,
      left: 0,
    });
    expect(
      props('<Frame id="1:1" border="none"/>', { current: { "border-bottom": "2px solid #191A23" } }).strokes?.paints,
    ).toEqual([]);
    expect(
      props('<Text id="1:1" text-underline-offset="4px"/>', { current: { "text-decoration": "underline" } })
        .textDecoration,
    ).toEqual({
      line: "UNDERLINE",
      offset: {
        unit: "PIXELS",
        value: 4,
      },
    });
  });

  it("a new size keeps the edge the layer is pinned to; new edges replace the old ones", () => {
    const pinned = {
      position: "absolute",
      right: "10px",
      top: "0",
      width: "300px",
    };

    expect(props('<Frame id="1:1" width="320px"/>', { current: pinned })).toEqual({
      horizontal: {
        kind: "MAX",
        offset: 10,
      },
      width: 320,
    });
    expect(
      props('<Frame id="1:1" left="0"/>', {
        current: pinned,
      }).horizontal,
    ).toEqual({
      kind: "MIN",
      offset: 0,
    });
  });
});

describe("the change itself", () => {
  it("says create or update, where it goes, which attribute each property came from", () => {
    const { elements } = readApply('<Frame id="2:1" gap="8px" padding="4px"><Text name="Title">Hi</Text></Frame>');
    const update = changeOf(elements[0] as ApplyElement, {
      attributes: new Set(["id", "padding"]),
      text: true,
      visible: true,
      current: { display: "flex" },
    });
    const create = changeOf(elements[1] as ApplyElement);

    expect(update.change).toMatchObject({
      kind: "update",
      id: "2:1",
      props: { itemSpacing: 8 },
      sources: { itemSpacing: "gap" },
    });
    expect(update.change.props).not.toHaveProperty("padding");
    expect(create.change).toMatchObject({
      kind: "create",
      ref: "new:1",
      parent: "2:1",
      index: 0,
      tag: "Text",
      props: { name: "Title" },
      text: {
        characters: "Hi",
        runs: [],
      },
    });
  });
});

describe("CSS to Figma: components, notes, files and copies", () => {
  it("reads component, variant and props with design_read's escapes", () => {
    expect(
      props(
        '<Instance id="1:1" component="Heading" variant="Property 1=Green, Size\\=XL=Large" props="Label=Hello\\, world, Has icon=false"/>',
      ),
    ).toEqual({
      component: "Heading",
      variant: {
        "Property 1": "Green",
        "Size=XL": "Large",
      },
      props: {
        Label: "Hello, world",
        "Has icon": "false",
      },
    });
  });

  it("reads notes with their categories, descriptions and the properties a new component's layers make", () => {
    expect(
      props('<Frame id="1:1" note="Behavior: opens the modal | Plain note with a \\| bar" description="A card."/>'),
    ).toEqual({
      notes: [
        {
          category: "Behavior",
          label: "opens the modal",
        },
        {
          category: null,
          label: "Plain note with a | bar",
        },
      ],
      description: "A card.",
    });
    expect(props('<Component><Text prop="Label" visibleProp="Shown">Hi</Text></Component>').property).toBeUndefined();
    expect(
      changeOf(
        readApply('<Component><Text prop="Label" visibleProp="Shown">Hi</Text></Component>')
          .elements[1] as ApplyElement,
      ).change.props.property,
    ).toEqual({
      text: "Label",
      visible: "Shown",
    });
  });

  it("reads files: an image or icon src, and an image in a background with its fit", () => {
    expect(props('<Image src="assets/photo.png" width="20px"/>').asset).toEqual({
      kind: "image",
      src: "assets/photo.png",
    });
    expect(props('<Icon id="1:2" src="assets/arrow.svg"/>').asset).toEqual({
      kind: "icon",
      src: "assets/arrow.svg",
    });
    expect(props('<Frame id="1:1" background="url(assets/hero.png) center / contain no-repeat, #FFF"/>').fills).toEqual(
      [
        {
          kind: "color",
          color: {
            r: 1,
            g: 1,
            b: 1,
            a: 1,
          },
        },
        {
          kind: "image",
          src: "assets/hero.png",
          scaleMode: "FIT",
        },
      ],
    );
  });

  it("makes a copy a create with its source, and the layers inside it updates of the copy's", () => {
    const { elements } = readApply('<Frame copyOf="2:4870" name="Card 2"><Text id="I2:1;3:4">New</Text></Frame>');
    const [copy, text] = elements.map((element) => changeOf(element).change);

    expect(copy).toMatchObject({
      kind: "create",
      copyOf: "2:4870",
      props: { name: "Card 2" },
    });
    expect(text).toMatchObject({
      kind: "update",
      id: null,
      source: "I2:1;3:4",
      parent: copy?.ref,
    });
  });

  it("lets a gap shorthand reset the line gap the layer has, as CSS does", () => {
    expect(
      props('<Frame id="1:1" gap="20px"/>', {
        current: {
          display: "flex",
          "flex-wrap": "wrap",
          gap: "12px",
          "row-gap": "30px",
        },
      }),
    ).toMatchObject({
      itemSpacing: 20,
      counterAxisSpacing: 20,
    });
  });
});

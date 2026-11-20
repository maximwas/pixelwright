/** The words design_apply answers a reader's refusals with, kept as 0.7.0 wrote them (C-161, C-163, C-164). */
export const READ_TEXT = {
  noElement: "The XML holds no element: there is nothing to write.",
  strayText: (value: string) => `Text "${value}" outside a <Text>: text belongs in a Text element.`,
  notAttribute: (name: string, tag: string) => `${name} is not an attribute of <${tag}>: left out.`,
  didYouMean: (near: string) => `Did you mean ${near}?`,
} as const;

/** Places and limits of a reading. */
export const READ_RULE = {
  /** How much of a stray text the error quotes. */
  quoted: 30,
  firstLine: 1,
  firstColumn: 1,
  trueValue: "true",
} as const;

/** The ref a new element gets: its line, and its column too when two share a line. */
export const READ_REF = {
  onLine: (line: number) => `new:${line}`,
  atColumn: (line: number, column: number) => `new:${line}:${column}`,
} as const;

/** How a habit's value is written in CSS: a bare number gets a unit (pixels from a trimmed value), else it is as given. */
export const HABIT_UNIT = { pixels: "px", degrees: "deg", none: "" } as const;

/** The CSS an attribute written out of habit says (Figma's or SVG's name), a closer hint than the nearest spelling. */
export const HABIT_HINT: Readonly<Record<string, { readonly unit: string; readonly text: (value: string) => string }>> =
  {
    x: {
      unit: HABIT_UNIT.pixels,
      text: (value) => `Write position="absolute" left="${value}": CSS places a layer by left and top.`,
    },
    y: {
      unit: HABIT_UNIT.pixels,
      text: (value) => `Write position="absolute" top="${value}": CSS places a layer by left and top.`,
    },
    fill: { unit: HABIT_UNIT.none, text: (value) => `Write background="${value}" (color on a Text).` },
    stroke: { unit: HABIT_UNIT.none, text: (value) => `Write border="1px solid ${value}".` },
    rotation: { unit: HABIT_UNIT.degrees, text: (value) => `Write transform="rotate(${value})".` },
    "corner-radius": { unit: HABIT_UNIT.pixels, text: (value) => `Write border-radius="${value}".` },
    cornerRadius: { unit: HABIT_UNIT.pixels, text: (value) => `Write border-radius="${value}".` },
  };

export const ADMISSION_TEXT = {
  notCreated: (
    tag: string,
    parentTag: string,
    parentLine: number,
  ) =>
    `<${tag}> is not created: its parent <${parentTag}> at line ${parentLine} was not applied.`,
  spanOutsideText: "A <Span> belongs inside a Text: it is a run of the text's characters.",
  notPixelwrightTag: (tag: string) => `<${tag}> is not a Pixelwright tag.`,
  tagsHint: "Tags are Figma layer types: Frame, Text, Rectangle…",
  tagNear: (near: string) => `Did you mean <${near}>?`,
  pageInLayer: "A <Page> stands at the top level: a page holds layers, and no layer holds a page.",
  notLayerId: (id: string) => `id="${id}" is not a Figma layer id (like 54:243): a new layer has no id.`,
  copyWithId: (id: string) => `A copy is a new layer: an element with copyOf has no id (${id}).`,
  givenTwice: (id: string) => `id ${id} is given twice: a new layer has no id, so copy an element without its ids.`,
  namedTwice: (id: string) => `${id} is named twice in one copy: each of the source's layers has one element.`,
  instanceNeedsComponent: "An <Instance> is made from a component.",
  instanceHint: 'Give component="Name" and variant="Property=Value"; components_read lists them.',
  textPathNeedsPath: "A <TextPath> is made along a path: give it d or arc.",
  textPathHint:
    'd="M 0 100 C 50 0 150 0 200 100" in its own box, or arc="200 200 150 -60 60" (centre, radius, from and to degrees) in its parent.',
  needsSrc: (tag: string) => `An <${tag}> is made from a file: give it src.`,
  srcHint: (extension: string) => `Give src="path/to/file${extension}".`,
  groupMessage: "A group is made by grouping layers in Figma.",
  groupHint: "Create a <Frame> instead, or change the group by its id.",
  undrawn: (tag: string) => `A <${tag}> is not drawn from XML.`,
  undrawnHint: 'Draw it as an <Icon src="…svg">, or change it by its id.',
  uncreatable: (tag: string) => `<${tag}> cannot be created.`,
} as const;

export const ICON_EXTENSION = { icon: ".svg", image: ".png" } as const;

export const REFUSAL_TEXT = {
  pageName: (name: string) => `A <Page> takes only a name: ${name} is not written.`,
  pageHint: "Give it on the layers in the page.",
  property: (name: string) =>
    `${name} makes a property of the <Component> holding the layer: this new layer is in none.`,
  propertyHint:
    "Use it on the layers inside a <Component> you create, or on an existing component's: by their ids, or new ones inside its element.",
  display: (tag: string) => `A <${tag}> has no auto layout: display takes none (hidden) or block here.`,
  displayHint: 'Put the layers in a <Frame display="flex">.',
  layout: (tag: string, name: string) => `${name} lays out a frame's children: a <${tag}> has none.`,
  layoutHint: 'Put the layers in a <Frame display="flex"> and give it there.',
  text: (tag: string, name: string) => `${name} styles a text: a <${tag}> holds none.`,
  textHint: "Give it on the <Text> inside.",
  path: (tag: string, name: string) => `${name} belongs to a text on a path: a <${tag}> has no path.`,
  pathHint: 'Set text along a path with a <TextPath d="…"> or <TextPath arc="…">.',
  textBox: (tag: string, name: string) => `A <${tag}> has no box to paint: ${name} is not written on it.`,
  textBoxBackground: "A text's colour is color; a background goes on a <Frame> around it.",
  textBoxShadow: "A text's shadow is text-shadow.",
  textBoxOther: "Put the text in a <Frame> and give it there.",
  noPaint: (tag: string, name: string) => `A <${tag}> has no ${name}.`,
  linePaintHint: "A line is drawn by its border-top (or border-left when it stands).",
  groupPaintHint: "Paint its layers.",
  overflow: (tag: string) => `A <${tag}> holds no layers to clip.`,
  overflowHint: "overflow clips a frame's content.",
  borderPrefix: "border",
} as const;

export const PIECE_TEXT = {
  notSpan: (tag: string, parent: string) => `<${tag}> inside a ${parent}: a text holds only text and <Span> runs.`,
  textPathHint: 'Write the characters in the TextPath itself: <TextPath id="…">text</TextPath>.',
  runAttribute: (name: string) => `${name} is not an attribute of <Span>: left out.`,
  runHolds: (tag: string) => `<${tag}> inside a <Span>: a run holds only characters, so it is left out.`,
  runNests: (name: string) => `${name} is set on a <Span> inside a <Span>: runs do not nest, so it is left out.`,
} as const;

/** What becomes of an element admission turns away. */
export const ADMISSION_ACTION = { skip: "skip", refuse: "refuse" } as const;

export type AdmissionAction = (typeof ADMISSION_ACTION)[keyof typeof ADMISSION_ACTION];

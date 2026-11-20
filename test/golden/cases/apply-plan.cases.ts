/**
 * 0.7.0's change and edit cases, verbatim (C-196, C-197): CHANGE_CASES walk the change of every attribute on its natural
 * tag, the change's envelope, the order of errors, and what the layer holds completing what Figma keeps in one property.
 * EDIT_CASES send edits back against an Orbit fixture's layers, so the comparison is seen to leave a change in place.
 * apply-changes.json and apply-edits.json pin what the planner makes of them.
 */

/** A snippet of several lines. */
const lines = (...xml: string[]) => xml.join("\n");

/** What a case's first element finds on its layer, unchangedAttributes' answer as a case gives it. */
export interface NowCase {
  /** The element's attributes the layer already holds. */
  readonly unchanged?: readonly string[];
  /** Whether the layer's text already reads as the element's. */
  readonly text?: boolean;
  readonly visible?: boolean;
  /** The layer's attributes as design_read writes them now. */
  readonly current?: Readonly<Record<string, string>>;
}

/** An XML whose every element becomes a change: the first one against what its layer holds when `now` says. */
export interface ChangeCase {
  readonly xml: string;
  readonly now?: NowCase;
}

/** A layer positioned from its right edge, as design_read writes it. */
const PINNED_RIGHT = { position: "absolute", right: "10px", top: "0", width: "300px" };

export const CHANGE_CASES: Readonly<Record<string, ChangeCase>> = {
  name: { xml: '<Frame id="1:1" name="Card &amp; co"/>' },
  "a link on a frame": { xml: '<Frame id="1:1" href="https://example.com"/>' },
  "component, variant and props with design_read's escapes": {
    xml: '<Instance id="1:1" component="Heading" variant="Property 1=Green, Size\\=XL=Large" props="Label=Hello\\, world, Has icon=false, Trailing=1,"/>',
  },
  "a library component by key": { xml: '<Instance component="key:abc123" variant=""/>' },
  "lists that are not Name=Value": { xml: '<Instance id="1:1" variant="Large" props="A=1,,B=2"/>' },
  "a description and notes with categories": {
    xml: '<Component id="1:1" description="A card." note="Behavior: opens the modal | Plain note with a \\| bar | | Copy: Hi"/>',
  },
  "an empty note takes the notes away": { xml: '<Frame id="1:1" note=""/>' },
  "the properties a new component's layers make": {
    xml: '<Component name="Badge"><Text prop="Label" visibleProp="Shown">New</Text><Frame visibleProp="Icon shown"/></Component>',
  },
  "an image's and an icon's file": {
    xml: lines('<Image src="assets/photo.png" width="20px" height="10px"/>', '<Icon id="1:2" src="assets/arrow.svg"/>'),
  },
  "src on a frame": { xml: '<Frame id="1:1" src="assets/photo.png"/>' },
  "flex: direction, wrap, gaps, padding and alignment": {
    xml: lines(
      '<Frame id="1:1" display="flex" flex-direction="column" flex-wrap="wrap" gap="12px" column-gap="40px"',
      '  padding="8px 16px" justify-content="space-between" align-items="center" align-content="space-between"/>',
    ),
  },
  "display none hides, the layout left as it is": {
    xml: '<Frame id="1:1" display="none" flex-direction="column" gap="8px"/>',
  },
  "display block takes auto layout away; a gap needs flex or grid": {
    xml: lines(
      '<Frame id="1:1" display="block" gap="8px"/>',
      '<Frame id="1:2" gap="8px"/>',
      '<Text id="1:3" display="block"/>',
    ),
  },
  "displays Figma has and one it has not": {
    xml: lines(
      '<Frame id="1:1" display="inline-flex"/>',
      '<Frame id="1:2" display="inline-grid"/>',
      '<Frame id="1:3" display="inline-block"/>',
      '<Frame id="1:4" display="contents"/>',
    ),
  },
  "a reversed direction and a reversed wrap": {
    xml: lines(
      '<Frame id="1:1" display="flex" flex-direction="row-reverse" gap="8px"/>',
      '<Frame id="1:2" display="flex" flex-wrap="wrap-reverse" flex-direction="row"/>',
      '<Frame id="1:3" display="flex" flex-wrap="nowrap"/>',
    ),
  },
  "column-gap along a row, row-gap along a column": {
    xml: lines(
      '<Frame display="flex" column-gap="20px"/>',
      '<Frame display="flex" flex-direction="column" row-gap="20px"/>',
    ),
  },
  "a gap of two lengths, and a normal one": {
    xml: lines(
      '<Frame id="1:1" display="flex" flex-wrap="wrap" gap="10px var(--space-s)"/>',
      '<Frame id="1:2" display="flex" column-gap="normal"/>',
      '<Frame id="1:3" display="flex" gap="10px 20px"/>',
    ),
  },
  "gaps that are no lengths": {
    xml: lines(
      '<Frame id="1:1" display="flex" gap="big"/>',
      '<Frame id="1:2" display="flex" gap="1px 2px 3px"/>',
      '<Frame id="1:3" display="flex" column-gap="wide"/>',
    ),
  },
  "grid tracks and gaps": {
    xml: '<Frame id="1:1" display="grid" grid-template-columns="1fr 1fr 200px" grid-template-rows="repeat(2, auto)" column-gap="16px" row-gap="8px"/>',
  },
  "a grid's gap shorthand, tracks it cannot read, and flex attributes on it": {
    xml: '<Frame id="1:1" display="grid" gap="10px" grid-template-columns="1fr minmax(0, 1fr)" grid-template-rows="1.5fr" flex-direction="column" flex-wrap="wrap"/>',
  },
  "grid tracks on a flex frame": {
    xml: '<Frame id="1:1" display="flex" grid-template-columns="1fr 1fr" grid-template-rows="auto"/>',
  },
  "padding of one to four lengths and tokens": {
    xml: lines(
      '<Frame id="1:1" padding="8px var(--space-m)"/>',
      '<Frame id="1:2" padding="1px 2px 3px"/>',
      '<Frame id="1:3" padding="0"/>',
      '<Frame id="1:4" padding="1em"/>',
      '<Frame id="1:5" padding="1px 2px 3px 4px 5px"/>',
    ),
  },
  "the flex alignments": {
    xml: lines(
      '<Frame id="1:1" justify-content="space-evenly" align-items="baseline" align-content="normal"/>',
      '<Frame id="1:2" justify-content="flex-end" align-items="end" align-content="space-between"/>',
      '<Frame id="1:3" justify-content="stretch" align-items="self-start" align-content="center"/>',
    ),
  },
  "position absolute from the left and the top": {
    xml: '<Frame id="1:1" position="absolute" left="10px" top="20px"/>',
  },
  "positions Figma has and one it has not": {
    xml: lines(
      '<Frame id="1:1" position="relative"/>',
      '<Frame id="1:2" position="static"/>',
      '<Frame id="1:3" position="fixed"/>',
    ),
  },
  "pinned to the right and the bottom": {
    xml: '<Frame id="1:1" position="absolute" left="auto" right="20px" bottom="0"/>',
  },
  "from the centre, and stretched between two edges": {
    xml: lines(
      '<Frame id="1:1" position="absolute" left="calc(50% - 30px)" top="10px" bottom="10px"/>',
      '<Frame id="1:2" position="absolute" left="50%" top="calc(50% + 4.5px)"/>',
    ),
  },
  "scaled in percents of the parent": {
    xml: '<Frame id="1:1" position="absolute" left="10%" width="50%" top="60%" height="25%"/>',
  },
  "placements CSS would not apply": {
    xml: lines(
      '<Frame id="1:1" left="10px" right="auto"/>',
      '<Frame id="1:3" position="absolute" left="10%"/>',
      '<Frame id="1:4" position="absolute" left="var(--x)"/>',
      '<Frame id="1:5" position="absolute" right="1em"/>',
    ),
  },
  "sizes: a length, a token, hugging": {
    xml: lines(
      '<Frame id="1:1" width="300px" height="var(--card-h)"/>',
      '<Frame id="1:2" width="auto" height="fit-content"/>',
      '<Text id="1:3" width="max-content" height="0"/>',
    ),
  },
  "sizes that are no lengths": { xml: '<Frame id="1:1" width="50%" height="tall"/>' },
  "limits: lengths, tokens and none": {
    xml: lines(
      '<Frame id="1:1" min-width="120px" max-width="none" min-height="0" max-height="var(--max-h)"/>',
      '<Frame id="1:2" min-width="auto" max-width="10em"/>',
    ),
  },
  "flex fills its parent's direction or not": {
    xml: lines(
      '<Frame id="1:1" flex="1"/>',
      '<Frame id="1:2" flex="none"/>',
      '<Frame id="1:3" flex="1 1 0%"/>',
      '<Frame id="1:4" flex="auto"/>',
      '<Frame id="1:5" flex="initial"/>',
      '<Frame id="1:6" flex="2"/>',
    ),
  },
  "align-self and justify-self": {
    xml: lines(
      '<Frame id="1:1" align-self="stretch" justify-self="center"/>',
      '<Frame id="1:2" align-self="auto" justify-self="self-end"/>',
      '<Frame id="1:3" align-self="baseline" justify-self="left"/>',
    ),
  },
  "grid cells": {
    xml: lines(
      '<Frame id="1:1" grid-row="1" grid-column="2 / span 2"/>',
      '<Frame id="1:2" grid-row="2 / 4" grid-column="0"/>',
      '<Frame id="1:3" grid-row="span 2" grid-column="3 / 2"/>',
    ),
  },
  "turns and mirrors": {
    xml: lines(
      '<Frame id="1:1" transform="rotate(-30deg)"/>',
      '<Frame id="1:2" transform="scaleX(-1) rotate(45.5deg)"/>',
      '<Frame id="1:3" transform="none"/>',
      '<Frame id="1:4" transform="skewX(10deg)"/>',
    ),
  },
  opacity: {
    xml: lines(
      '<Frame id="1:1" opacity="0.5"/>',
      '<Frame id="1:2" opacity="40%"/>',
      '<Frame id="1:3" opacity="1.5"/>',
      '<Frame id="1:4" opacity="half"/>',
    ),
  },
  "overflow on a frame": {
    xml: lines(
      '<Frame id="1:1" overflow="hidden"/>',
      '<Frame id="1:2" overflow="visible"/>',
      '<Frame id="1:3" overflow="clip"/>',
      '<Frame id="1:4" overflow="scroll"/>',
    ),
  },
  "truncating a text": {
    xml: lines(
      '<Text id="1:1" overflow="hidden" text-overflow="ellipsis" white-space="nowrap"/>',
      '<Text id="1:2" text-overflow="clip"/>',
      '<Text id="1:3" overflow="hidden"/>',
    ),
  },
  "corner radii": {
    xml: lines(
      '<Frame id="1:1" border-radius="8px"/>',
      '<Frame id="1:2" border-radius="8px 8px 0 0"/>',
      '<Frame id="1:3" border-radius="var(--radius-m) 0 0 0"/>',
      '<Ellipse id="1:4" border-radius="50%"/>',
      '<Rectangle id="1:5" border-radius="50%"/>',
      '<Frame id="1:6" border-radius="1em"/>',
      '<Frame id="1:7" border-radius="10px / 20px"/>',
    ),
  },
  "background colours and tokens": {
    xml: lines(
      '<Frame id="1:1" background="#191A23"/>',
      '<Frame id="1:2" background="var(--Dark)"/>',
      '<Frame id="1:3" background="color-mix(in srgb, var(--Dark) 50%, transparent)"/>',
      '<Frame id="1:4" background="color-mix(in display-p3, var(--Dark) 25%, transparent)"/>',
      '<Frame id="1:5" background="color(display-p3 1 0 0)"/>',
      '<Frame id="1:6" background="rgba(25, 26, 35, 0.5)"/>',
      '<Frame id="1:7" background="hsl(0 100% 50%)"/>',
      '<Frame id="1:8" background="red"/>',
    ),
  },
  "background layers bottom first, a flat gradient, none": {
    xml: lines(
      '<Frame id="1:1" background="linear-gradient(rgba(25, 26, 35, 0.5), rgba(25, 26, 35, 0.5)), #FFF"/>',
      '<Frame id="1:2" background="none"/>',
      '<Frame id="1:3" background="transparent"/>',
    ),
  },
  "image backgrounds and their fit": {
    xml: lines(
      '<Frame id="1:1" background="url(assets/hero.png) center / contain no-repeat, #FFF"/>',
      '<Frame id="1:2" background="url(&quot;my photo.png&quot;) center / cover no-repeat"/>',
      '<Frame id="1:3" background="url(tile.png) repeat"/>',
    ),
  },
  "backgrounds that cannot be written": {
    xml: lines(
      '<Frame id="1:1" background="linear-gradient(90deg, #000, #FFF)"/>',
      '<Frame id="1:2" background="url(my photo.png)"/>',
      '<Frame id="1:3" background="paper"/>',
      '<Frame id="1:4" background="#FFF, url(a.png), nonsense"/>',
    ),
  },
  "a text's colour": {
    xml: lines(
      '<Text id="1:1" color="#F00"/>',
      '<Text id="1:2" color="color-mix(in srgb, var(--Black) 60%, transparent)"/>',
      '<Text id="1:3" color="url(a.png)"/>',
      '<Text id="1:4" color="linear-gradient(#000, #FFF)"/>',
    ),
  },
  "a border inside, an outline outside, dashed and dotted": {
    xml: lines(
      '<Frame id="1:1" border="1px solid var(--Dark)"/>',
      '<Frame id="1:2" outline="2px dashed #191A23"/>',
      '<Frame id="1:3" border="#000 dotted 1.5px"/>',
    ),
  },
  "border sides, and none": {
    xml: lines(
      '<Frame id="1:1" border-bottom="1px solid #191A23"/>',
      '<Frame id="1:2" border-top="2px solid #000" border-bottom="1px solid #000"/>',
      '<Frame id="1:3" border="none"/>',
      '<Frame id="1:4" border="0" outline="none"/>',
      '<Frame id="1:5" border="1px solid #000" border-left="none"/>',
      '<Frame id="1:6" border-right="1px solid #000" border-left="1px solid #000"/>',
    ),
  },
  "strokes Figma cannot draw": {
    xml: lines(
      '<Frame id="1:1" border="1px solid #000" outline="1px solid #000"/>',
      '<Frame id="1:2" border-top="1px solid #000" border-bottom="1px solid #FFF"/>',
      '<Frame id="1:3" border="thick"/>',
      '<Frame id="1:4" border="1px solid #000" border-left="2px dashed #000"/>',
    ),
  },
  "a line's border": {
    xml: lines('<Line id="1:1" border-top="2px solid #000"/>', '<Line id="1:2" border-left="1px dashed var(--Dark)"/>'),
  },
  "shadows bottom first, inset ones inner, blurs at the radius Figma renders so": {
    xml: '<Frame id="1:1" box-shadow="inset 0 -1px 0 0 #191A23, rgba(25, 26, 35, 0.25) 0 4px 8px 0" backdrop-filter="blur(10px)" filter="blur(1.25px)"/>',
  },
  "an effect style, and a blur beside it": {
    xml: lines(
      '<Frame id="1:1" box-shadow="var(--Card-shadow)"/>',
      '<Frame id="1:2" box-shadow="var(--Card-shadow)" filter="blur(2px)" backdrop-filter="none"/>',
    ),
  },
  "none takes shadows and blurs away": {
    xml: '<Frame id="1:1" box-shadow="none" filter="none" backdrop-filter="none"/>',
  },
  "a text's shadow": {
    xml: lines('<Text id="1:1" text-shadow="0 1px 2px #000"/>', '<Text id="1:2" text-shadow="var(--Glow)"/>'),
  },
  "effects Figma has not": {
    xml: lines(
      '<Frame id="1:1" filter="grayscale(1)"/>',
      '<Frame id="1:2" box-shadow="0 1px"/>',
      '<Frame id="1:3" box-shadow="1px 2px 3px 4px 5px #000"/>',
      '<Frame id="1:4" backdrop-filter="blur(1em)" box-shadow="0 1px 2px 0 #000"/>',
    ),
  },
  "the font shorthand and its line heights": {
    xml: lines(
      '<Text id="1:1" font="italic 700 16px/24px \'Inter\'"/>',
      '<Text id="1:2" font="400 20px/normal \'Space Grotesk\', sans-serif"/>',
      '<Text id="1:3" font="bold 12px/150% Inter"/>',
      '<Text id="1:4" font="normal 14px/1.5 &quot;Roboto Mono&quot;"/>',
      '<Text id="1:5" font="oblique 10.5px \'A\'"/>',
      '<Text id="1:6" font="300 18px/1.2em \'B\'"/>',
    ),
  },
  "fonts that cannot be read": {
    xml: lines(
      '<Text id="1:1" font="bold"/>',
      '<Text id="1:2" font="16px"/>',
      '<Text id="1:3" font="16px/tall \'Inter\'"/>',
    ),
  },
  "letter spacing": {
    xml: lines(
      '<Text id="1:1" letter-spacing="0.07em"/>',
      '<Text id="1:2" letter-spacing="-1.5px"/>',
      '<Text id="1:3" letter-spacing="normal"/>',
      '<Text id="1:4" letter-spacing="wide"/>',
    ),
  },
  "case, alignment and wrapping": {
    xml: lines(
      '<Text id="1:1" text-transform="uppercase" text-align="center" text-wrap="balance"/>',
      '<Text id="1:2" text-transform="capitalize" text-align="justify" text-wrap="pretty"/>',
      '<Text id="1:3" text-transform="none" text-align="end" text-wrap="wrap"/>',
      '<Text id="1:4" text-transform="small-caps" text-align="middle" text-wrap="nowrap"/>',
    ),
  },
  "the decoration: line, style, colour, offset and thickness": {
    xml: lines(
      '<Text id="1:1" text-decoration="underline wavy #F00" text-underline-offset="3px" text-decoration-thickness="0.1em"/>',
      '<Text id="1:2" text-decoration="line-through"/>',
      '<Text id="1:3" text-decoration="none"/>',
      '<Text id="1:4" text-underline-offset="auto"/>',
    ),
  },
  "decorations that cannot be read": {
    xml: lines(
      '<Text id="1:1" text-decoration="overline"/>',
      '<Text id="1:2" text-decoration="underline nocolour"/>',
      '<Text id="1:3" text-decoration="underline" text-decoration-thickness="thin"/>',
    ),
  },
  "a text style and a link on a text": {
    xml: lines('<Text id="1:1" textStyle="h3" href="https://example.com"/>', '<Text id="1:2" textStyle=""/>'),
  },
  "characters and runs": {
    xml: '<Text id="1:1">Hello <Span font="700 16px/normal \'Inter\'" href="https://x.y">world</Span>!</Text>',
  },
  "a span's run over the text's own values": {
    xml: lines(
      '<Text id="1:1" font="400 16px/24px \'Inter\'" color="#000" text-decoration="underline" text-underline-offset="2px">',
      'a<Span text-decoration="line-through" text-underline-offset="1px" color="var(--Brand)">b</Span>',
      '<Span textStyle="Caption">c</Span>',
      '<Span letter-spacing="0.1em" text-transform="uppercase" text-decoration-thickness="3px">d</Span></Text>',
    ),
  },
  "a nested span's characters join its run": {
    xml: '<Text id="1:1">a<Span color="#F00">b<Span>c</Span>d</Span>e</Text>',
  },
  "entities, CDATA and line breaks in a text": { xml: '<Text id="1:1">a &amp; b&#8232;c <![CDATA[<raw>]]></Text>' },
  "an empty span": { xml: '<Text id="1:1">a<Span color="#F00"></Span>b</Text>' },
  "a new layer and its children: kind, ref, parent and index": {
    xml: lines(
      '<Frame name="Card" display="flex">',
      '  <Text name="Title">Hi</Text>',
      '  <Rectangle name="Bar" width="10px"/>',
      "</Frame>",
    ),
  },
  "a layer that holds every attribute already": {
    xml: '<Frame id="2:1" gap="8px" padding="4px"/>',
    now: { unchanged: ["id", "gap", "padding"], current: { display: "flex" } },
  },
  "what the layer does not hold yet": {
    xml: '<Frame id="2:1" gap="8px" padding="4px"><Text name="Title">Hi</Text></Frame>',
    now: { unchanged: ["id", "padding"], text: true, current: { display: "flex" } },
  },
  "new layers placed before and after existing ones": {
    xml: lines('<Frame name="A" before="2:1"/>', '<Frame name="B" after="2:1"/>', '<Frame id="2:2" after="2:1"/>'),
  },
  "a copy, the layers in it and a new one": {
    xml: '<Frame copyOf="2:4870" name="Card 2"><Text id="I2:1;3:4">New</Text><Frame name="Extra"/></Frame>',
  },
  "a new instance's layers": {
    xml: '<Instance component="Plan Card" variant="Tier=Pro"><Text id="I54:268;54:211">Pro</Text></Instance>',
  },
  "a hidden layer shown again keeps the layout it has": {
    xml: '<Frame id="5:1" display="flex"/>',
    now: { visible: false, current: { display: "flex", "flex-direction": "column" } },
  },
  "a hidden layer shown again without auto layout": {
    xml: '<Frame id="5:1" display="block"/>',
    now: { visible: false },
  },
  "a text the layer already reads is not sent": {
    xml: '<Text id="1:1" color="#F00">Hi</Text>',
    now: { unchanged: ["id"], text: true },
  },
  "a new gap keeps the direction and wrap the layer has": {
    xml: '<Frame id="1:1" column-gap="24px"/>',
    now: {
      current: { display: "flex", "flex-direction": "column", "flex-wrap": "wrap", gap: "12px", "column-gap": "40px" },
    },
  },
  "a gap shorthand resets the line gap the layer has": {
    xml: '<Frame id="1:1" gap="20px"/>',
    now: { current: { display: "flex", "flex-wrap": "wrap", gap: "12px", "row-gap": "30px" } },
  },
  "a new direction keeps the gap the layer has": {
    xml: '<Frame id="1:1" flex-direction="column"/>',
    now: { current: { display: "flex", gap: "12px" } },
  },
  "a blur keeps the shadows the layer has": {
    xml: '<Frame id="1:1" filter="blur(2px)"/>',
    now: { current: { "box-shadow": "0 4px 8px 0 #191A23" } },
  },
  "a shadow keeps the blur the layer has": {
    xml: '<Frame id="1:1" box-shadow="0 1px 2px 0 #000"/>',
    now: { current: { "backdrop-filter": "blur(5px)" } },
  },
  "a border side keeps the other sides the layer has": {
    xml: '<Frame id="1:1" border-bottom="2px solid #191A23"/>',
    now: { current: { "border-top": "2px solid #191A23" } },
  },
  "border none takes every side away": {
    xml: '<Frame id="1:1" border="none"/>',
    now: { current: { "border-bottom": "2px solid #191A23" } },
  },
  "an underline offset keeps the decoration the layer has": {
    xml: '<Text id="1:1" text-underline-offset="4px"/>',
    now: { current: { "text-decoration": "underline" } },
  },
  "a span's run completes its decoration from what the layer has": {
    xml: '<Text id="1:1">a<Span text-underline-offset="2px">b</Span></Text>',
    now: { unchanged: ["id"], current: { "text-decoration": "underline" } },
  },
  "a new size keeps the edge the layer is pinned to": {
    xml: '<Frame id="1:1" width="320px"/>',
    now: { current: PINNED_RIGHT },
  },
  "a new edge replaces the layer's": { xml: '<Frame id="1:1" left="0"/>', now: { current: PINNED_RIGHT } },
  "a new top keeps the layer absolute": {
    xml: '<Frame id="1:1" top="5px"/>',
    now: { current: { position: "absolute", left: "10px", top: "0" } },
  },
  "truncation keeps the text-overflow the layer has": {
    xml: '<Text id="1:1" overflow="hidden"/>',
    now: { current: { overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" } },
  },
  "a new text style writes the text's own values and runs again": {
    xml: '<Text id="1:1" textStyle="h2" font="700 16px/24px \'Inter\'">Hi <Span color="#F00">there</Span></Text>',
    now: {
      unchanged: ["id", "font"],
      text: true,
      current: { font: "700 16px/24px 'Inter'", "letter-spacing": "0.1em" },
    },
  },
  "a text style the layer holds writes nothing again": {
    xml: '<Text id="1:1" textStyle="h2" font="700 16px/24px \'Inter\'">Hi <Span color="#F00">there</Span></Text>',
    now: { unchanged: ["id", "textStyle", "font"], text: true },
  },
  "a new text style writes a decoration again from the element's own values, not the layer's": {
    xml: '<Text id="1:1" textStyle="h2" text-underline-offset="2px"/>',
    now: { unchanged: ["id", "text-underline-offset"], text: true, current: { "text-decoration": "underline" } },
  },
  "span problems ranked among the element's own, by the element's attribute order": {
    xml: '<Text id="1:1" color="#F00" font="huge">a<Span color="nope">b</Span><Span letter-spacing="wide">c</Span></Text>',
  },
  "problems in the element's attribute order, not the table's": {
    xml: '<Frame id="1:1" border-radius="1em" display="flex" gap="big" background="linear-gradient(90deg, #000, #FFF)"/>',
  },
};

/** A snapshot the edits are sent against, by the name its goldens carry. */
type EditSnapshot = "orbit-customers" | "orbit-plans" | "orbit-pricing" | "orbit-pricing.p3";

/** An XML sent back against a snapshot's layers, every element naming one, as design_apply compares it. */
export interface EditCase {
  readonly snapshot: EditSnapshot;
  readonly xml: string;
}

/**
 * The texts edited: orbit-plans' I54:244;54:207 reads 'For side projects and trying things out.', orbit-customers'
 * quote 54:449 writes its author in a Span of font 600 and orbit-pricing's lede 54:242 ends in a Span of href,
 * text-decoration and color, in that order.
 */
export const EDIT_CASES: Readonly<Record<string, EditCase>> = {
  "a span recolouring characters the layer holds": {
    snapshot: "orbit-plans",
    xml: '<Text id="I54:244;54:207">For side <Span color="#F00">projects</Span> and trying things out.</Text>',
  },
  "the layer's span taken away, its characters kept": {
    snapshot: "orbit-customers",
    xml: '<Text id="54:449">“Orbit replaced three tools for us.” Maya Chen, Head of Design at Nova</Text>',
  },
  "the layer's span over other characters": {
    snapshot: "orbit-customers",
    xml: '<Text id="54:449">“Orbit replaced three tools for us.” <Span font="600 16px/24px \'Inter\'">Maya Chen,</Span> Head of Design at Nova</Text>',
  },
  "the layer's span with another look": {
    snapshot: "orbit-customers",
    xml: '<Text id="54:449">“Orbit replaced three tools for us.” <Span font="700 16px/24px \'Inter\'">Maya Chen</Span>, Head of Design at Nova</Text>',
  },
  "the layer's span split in two of the same look": {
    snapshot: "orbit-customers",
    xml: '<Text id="54:449">“Orbit replaced three tools for us.” <Span font="600 16px/24px \'Inter\'">Maya </Span><Span font="600 16px/24px \'Inter\'">Chen</Span>, Head of Design at Nova</Text>',
  },
  "the layer's span with its attributes in another order": {
    snapshot: "orbit-pricing",
    xml: '<Text id="54:242">Start free, upgrade when your team takes off. Every plan includes unlimited projects and a 14-day trial of Pro. <Span color="var(--color-brand)" href="https://orbit.example/plans" text-decoration="underline">See what\'s included.</Span></Text>',
  },
  "other characters": {
    snapshot: "orbit-plans",
    xml: '<Text id="I54:244;54:207">For side projects and trying things.</Text>',
  },
  "the layer's characters split by a comment, held": {
    snapshot: "orbit-plans",
    xml: '<Text id="I54:244;54:207">For side projects <!-- kept -->and trying things out.</Text>',
  },
  "the layer's span holding a nested span of no attributes, held": {
    snapshot: "orbit-customers",
    xml: '<Text id="54:449">“Orbit replaced three tools for us.” <Span font="600 16px/24px \'Inter\'">Maya <Span>Chen</Span></Span>, Head of Design at Nova</Text>',
  },
  "a new gap": { snapshot: "orbit-plans", xml: '<Frame id="54:243" gap="48px"/>' },
  "another token": { snapshot: "orbit-plans", xml: '<Frame id="54:243" gap="var(--space-32)"/>' },
  "the layer's token as the number it stands for": { snapshot: "orbit-plans", xml: '<Frame id="54:243" gap="24px"/>' },
  "a new hex colour": { snapshot: "orbit-customers", xml: '<Rectangle id="54:458" background="#E1E5EF"/>' },
  "the layer's hex colour in lower case": {
    snapshot: "orbit-customers",
    xml: '<Rectangle id="54:458" background="#e1e5ee"/>',
  },
  "the layer's numbers as an sRGB hex in a Display P3 file": {
    snapshot: "orbit-pricing.p3",
    xml: '<Rectangle id="54:458" background="#E1E5EE"/>',
  },
  "an image's file the read did not write, held: the server compares the bytes": {
    snapshot: "orbit-customers",
    xml: '<Image id="54:454" src="assets/other.png"/>',
  },
  "a shown layer hidden": { snapshot: "orbit-customers", xml: '<Frame id="54:450" display="none"/>' },
  "a hidden layer shown, compared as shown": {
    snapshot: "orbit-plans",
    xml: '<Instance id="I54:244;54:205" name="Badge" display="flex"/>',
  },
  "a nested element compared only as its parent holds it: the width its own read writes is new": {
    snapshot: "orbit-plans",
    xml: '<Frame id="54:243"><Instance id="54:244" width="383px"/></Frame>',
  },
  "the same element at the top, compared as the read's root too": {
    snapshot: "orbit-plans",
    xml: '<Instance id="54:244" width="383px"/>',
  },
};

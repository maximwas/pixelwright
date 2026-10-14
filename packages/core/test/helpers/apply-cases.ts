/**
 * The design_apply inputs the apply goldens (test/golden/apply.test.ts) pin, each named for what it shows. READ_CASES
 * walk the reader: every admission branch, every attribute refusal with its hint, unknown attributes, `$` ones, a
 * Text's content, text outside a Text, ref clashes, parse errors, skipped and refused parents, copies and new
 * instances. They also pin the order of the admission checks, through elements that fail two of them at once (the
 * earlier check decides; every other pair follows from these or cannot meet), and where an id is taken: only once its
 * element passes every check, before its children are read. CHANGE_CASES walk changeOf: every attribute on its natural
 * tag, the change's envelope, the order of errors, and what the layer holds completing what Figma keeps in one
 * property.
 */

/** A snippet of several lines. */
const lines = (...xml: string[]) => xml.join("\n");

export const READ_CASES: Readonly<Record<string, string>> = {
  "elements in document order, each with its parent, position and ref": lines(
    '<Frame id="2:1" gap="24px">',
    '  <Text name="Title">Hello <Span color="#F00">world</Span></Text>',
    '  <Rectangle width="10px" height="10px"/>',
    "</Frame>",
    '<Frame name="Card" width="300px"/>',
  ),
  "$ attributes left out without a word": lines(
    '<Frame id="2:1" $css="display: flex" $children="3" $pins="gap" $motion="opacity 0→1; 0–0.6s linear"',
    '  $override="text" $dev="ready for dev" $code="Card" $grid-style="Desktop 12" $on-click="navigate" name="Card"/>',
  ),
  "before, after and copyOf kept as attributes": lines(
    '<Frame name="A" before="2:1"/>',
    '<Frame name="B" after="2:1"/>',
    '<Frame copyOf="2:1" name="C"/>',
  ),
  "text outside a Text, an error that takes no place among its siblings": lines(
    '<Frame id="2:1">loose words<Frame id="2:2"/>more <Frame name="New"/></Frame>',
    "stray",
  ),
  "refs of new layers on one line, told apart by their column": '<Frame name="A"/><Frame name="B"/><Rectangle/>',
  "an unknown attribute near a known one, and one near none":
    '<Frame id="2:1" gapp="24px" colour="#F00" background-color="#FFF" zzzzzzzz="1" name="Kept"/>',
  "an unknown tag near a known one, its children still read under it": lines(
    '<Fram id="2:1">',
    '  <Frame id="2:2" name="Kept"/>',
    '  <Text name="New">Fails in the plugin</Text>',
    "</Fram>",
  ),
  "an unknown tag near none": '<Widget id="2:2"/>',
  "an unknown new tag: its layers with ids stand alone, its new ones are not created":
    '<Wigdet><Frame id="2:5"/><Frame name="Lost"/></Wigdet>',
  "an id that is no Figma id: skipped, its layers with ids stand alone, its new ones are not created":
    '<Frame id="hero"><Frame id="2:5" name="Kept"/><Frame name="Lost"/></Frame>',
  "an id given twice: skipped with what it holds": lines(
    '<Frame id="2:4870" name="Card"/>',
    '<Frame id="2:4870" name="Copy"><Frame name="Badge"/><Frame id="2:9" name="Kept"/></Frame>',
  ),
  "an instance's layer ids": '<Text id="I54:244;54:217" color="#F00"/>\n<Frame id="I54:268;54:211;54:7"/>',
  "copyOf with an id: skipped": '<Frame copyOf="2:1" id="2:2"><Frame id="2:3" name="Kept"/></Frame>',
  "ids inside a copy name the source's layers, each copy on its own": lines(
    '<Frame copyOf="2:4870" name="Card One"><Frame id="2:4871"><Text id="I2:4872;330:292">One</Text></Frame></Frame>',
    '<Frame copyOf="2:4870" name="Card Two"><Frame id="2:4871"><Text id="I2:4872;330:292">Two</Text></Frame></Frame>',
  ),
  "a source's layer named twice in one copy":
    '<Frame copyOf="2:1"><Frame id="2:2"/><Frame id="2:2" name="Again"/></Frame>',
  "an id both inside a copy and outside it": lines(
    '<Frame id="2:2" name="Outside before"/>',
    '<Frame copyOf="2:1"><Frame id="2:2" name="Inside"/><Frame id="2:3" name="Inside too"/></Frame>',
    '<Frame id="2:3" name="Outside after"/>',
  ),
  "a copy in a copy, and new layers in a copy": lines(
    '<Frame copyOf="2:1">',
    '  <Frame id="2:2">',
    '    <Frame copyOf="2:3" name="Inner"><Text id="2:4">Deep</Text></Frame>',
    '    <Frame name="New"/>',
    "  </Frame>",
    "</Frame>",
  ),
  "a new instance's ids name another instance's layers": lines(
    '<Instance component="Plan Card" variant="Tier=Pro">',
    '  <Text id="I54:268;54:211">Pro</Text>',
    '  <Frame id="I54:268;54:212"><Text id="I54:268;54:213">$29</Text></Frame>',
    "</Instance>",
  ),
  "an existing instance's ids are its own layers":
    '<Instance id="54:268"><Text id="I54:268;54:211">Pro</Text></Instance>',
  "new instances in a copy and in a new instance, an existing one in a copy": lines(
    '<Frame copyOf="2:1"><Frame id="2:2"><Instance component="Badge"><Text id="I9:1;9:2">New</Text></Instance></Frame></Frame>',
    '<Instance component="Card"><Instance component="Badge"><Text id="I1:1;1:2">Inner</Text></Instance></Instance>',
    '<Frame copyOf="2:1"><Instance id="2:5"><Text id="I2:5;3:1">Kept</Text></Instance></Frame>',
  ),
  "in a copy, a refused layer's new layers and counterparts take the source's id as their parent":
    '<Frame copyOf="2:1"><Fram id="2:2"><Frame name="New"/><Frame id="2:3"/></Fram></Frame>',
  "in a new instance, a refused layer's new layers take the other instance's id as their parent":
    '<Instance component="Card"><Fram id="I1:1;1:2"><Frame name="New"/></Fram></Instance>',
  "in a copy, a skipped layer's layers are not created, counterparts too":
    '<Frame copyOf="2:1"><Frame id="2:2"/><Frame id="2:2"><Frame name="New"/><Frame id="2:3"/></Frame></Frame>',
  "a create of every tag that can be made": lines(
    '<Frame name="F"/>',
    '<Section name="S"/>',
    "<Text>T</Text>",
    "<Rectangle/>",
    "<Ellipse/>",
    "<Line/>",
    '<Instance component="Button"/>',
    '<Component name="K"/>',
    '<ComponentSet name="KS"/>',
    '<Image src="assets/photo.png"/>',
    '<Icon src="assets/arrow.svg"/>',
    '<Slot name="Sl"/>',
  ),
  "what a create lacks: a component, a file": lines(
    '<Instance variant="Size=Large"><Text id="1:2">Kept</Text><Text>Lost</Text></Instance>',
    "<Image/>",
    "<Icon/>",
  ),
  "a group is made by grouping": '<Group name="G"><Frame id="2:5" name="Kept"/><Frame name="Lost"/></Group>',
  "shapes not drawn from XML": lines(
    "<Vector/>",
    "<Star/>",
    "<Polygon/>",
    "<BooleanOperation/>",
    "<TextPath/>",
    "<TransformGroup/>",
  ),
  "other known tags that cannot be created": lines(
    "<Table/>",
    "<TableCell/>",
    "<Media/>",
    "<Embed/>",
    "<LinkUnfurl/>",
    "<Slice/>",
  ),
  "known tags changed by id": lines(
    '<Group id="1:1" opacity="0.5"/>',
    '<Vector id="1:2" opacity="0.5"/>',
    '<Slice id="1:3" width="10px"/>',
    '<Table id="1:4" name="T"/>',
    '<Media id="1:5" name="M"/>',
  ),
  "a copy of a tag that cannot be drawn": '<Group copyOf="1:1" name="G2"/>',
  "a new layer under a skipped new one: not created, nor anything in it":
    '<Frame id="bad"><Frame name="New"><Frame id="1:5" opacity="0.5"/><Text>x</Text></Frame></Frame>',
  "a Span outside a Text drops what it holds, and takes a place among its siblings":
    '<Frame id="2:1"><Span color="#F00">x<Frame id="2:2"/></Span><Frame id="2:3" name="After"/></Frame>',
  "a Span under a skipped parent is not created, before it is outside a Text": '<Frame id="bad"><Span>x</Span></Frame>',
  "a Span under a refused parent is not created, before it is outside a Text": "<Wigdet><Span>x</Span></Wigdet>",
  "an unknown tag under a skipped parent is not created, before it is unknown": '<Frame id="bad"><Wigdet/></Frame>',
  "a Span outside a Text is refused before its id is checked": '<Span id="hero">x</Span>',
  "an unknown tag is refused before its id is checked; its new layers take that id as their parent":
    '<Wigdet id="hero"><Frame name="In"/></Wigdet>',
  "an id that is no Figma id is refused before copyOf, in either attribute order": lines(
    '<Frame copyOf="2:1" id="hero"/>',
    '<Frame id="hero" copyOf="2:1"/>',
  ),
  "copyOf with an id is refused before the id counts as given twice": lines(
    '<Frame id="2:2"/>',
    '<Frame copyOf="2:1" id="2:2"/>',
  ),
  "an unknown tag leaves its id to a later element": lines('<Fram id="2:1"/>', '<Frame id="2:1" name="Kept"/>'),
  "a Span outside a Text leaves its id to a later element": lines(
    '<Span id="2:3">x</Span>',
    '<Frame id="2:3" name="Kept"/>',
  ),
  "copyOf with an id leaves the id to a later element": lines(
    '<Frame copyOf="2:1" id="2:2"/>',
    '<Frame id="2:2" name="Kept"/>',
  ),
  "in a copy, a layer not created leaves its source's id to a later one":
    '<Frame copyOf="2:1"><Frame id="hero"><Frame id="2:3"/></Frame><Frame id="2:3" name="Kept"/></Frame>',
  "an id is taken before its element's children are read": '<Frame id="2:1"><Frame id="2:1" name="Inner"/></Frame>',
  "prop and visibleProp outside a new Component": lines(
    '<Frame name="F"><Text prop="Label" visibleProp="Shown">x</Text></Frame>',
    '<Component id="1:1"><Text id="1:2" prop="Label">x</Text></Component>',
  ),
  "prop and visibleProp inside a new Component, however deep, and in a copied one": lines(
    '<ComponentSet name="Badge">',
    '  <Component variant="Tone=Dark"><Frame name="Row"><Text prop="Label" visibleProp="Shown">New</Text></Frame></Component>',
    "</ComponentSet>",
    '<Component copyOf="1:1"><Text id="1:2" prop="Title">Copied</Text></Component>',
  ),
  "display on a layer without auto layout: none or block only": lines(
    '<Rectangle id="1:1" display="flex"/>',
    '<Text id="1:2" display="none"/>',
    '<Text id="1:3" display="block"/>',
    '<Ellipse id="1:4" display="grid"/>',
    '<Instance id="1:5" display="flex"/>',
    '<Slot id="1:6" display="grid"/>',
  ),
  "layout attributes on a layer that lays out nothing": lines(
    '<Rectangle id="1:1" gap="4px" padding="8px" flex-direction="column" flex-wrap="wrap" justify-content="center"',
    '  align-items="center" align-content="space-between" row-gap="1px" column-gap="2px" grid-template-columns="1fr"',
    '  grid-template-rows="auto"/>',
    '<ComponentSet id="1:2" display="flex" gap="40px"/>',
  ),
  "text attributes on a layer that is no Text": lines(
    '<Frame id="1:1" font="400 12px/normal \'Inter\'" color="#F00" textStyle="Body" letter-spacing="1px"',
    '  text-transform="uppercase" text-decoration="underline" text-underline-offset="2px" text-decoration-thickness="1px"',
    '  text-align="center" text-wrap="balance" text-overflow="ellipsis" white-space="nowrap"/>',
  ),
  "a Text has no box to paint": lines(
    '<Text id="1:1" background="#000" box-shadow="0 1px 2px 0 #000" border="1px solid #000" border-radius="4px"',
    '  outline="1px solid #000" border-top="1px solid #000" color="#FFF">x</Text>',
  ),
  "a Line has its border only, a Group no paint": lines(
    '<Line id="1:1" background="#000" border-top="1px solid #000" border-left="1px solid #000" border="1px solid #000"',
    '  border-radius="2px" box-shadow="0 0 1px 0 #000" outline="1px solid #000"/>',
    '<Group id="1:2" background="#000" border="1px solid #000" box-shadow="0 1px 2px 0 #000" opacity="0.5"/>',
  ),
  "overflow on a shape that holds no layers": lines(
    '<Rectangle id="1:1" overflow="hidden"/>',
    '<Image id="1:2" overflow="hidden"/>',
    '<Frame id="1:3" overflow="hidden"/>',
  ),
  "a Text's content: text and Spans with their run attributes": lines(
    '<Text id="1:1">Hello <Span color="#F00" font="700 16px/normal \'Inter\'" href="https://x.y" textStyle="Bold"',
    '  letter-spacing="1px" text-transform="uppercase" text-decoration="underline" text-underline-offset="2px"',
    '  text-decoration-thickness="1px">world</Span>!</Text>',
  ),
  "a Span keeps run attributes only":
    '<Text id="1:1">a<Span color="#F00" background="#000" opacity="0.5" text-align="center">b</Span></Text>',
  "another element inside a Text is dropped": '<Text id="1:1">a<Frame id="1:2">b</Frame>c<Text>d</Text></Text>',
  "a nested Span's characters join its Span, its attributes unread":
    '<Text id="1:1">a<Span color="#F00">b<Span font="700 16px/normal \'Inter\'" bogus="1">c</Span>d</Span>e</Text>',
  "no content leaves the text as it is; spaces alone on one line are content": lines(
    '<Text id="1:2" color="#F00"/>',
    '<Text id="1:3"></Text>',
    '<Text id="1:4">   </Text>',
    '<Text id="1:5">',
    "   ",
    "</Text>",
  ),
  "a text design_read shortened is left as it is": lines(
    '<Text id="1:5" $truncated="true">Lorem ipsum…</Text>',
    '<Text id="1:6" $truncated="false">Kept</Text>',
  ),
  "entities, CDATA, comments and line breaks in a text": lines(
    '<Text id="1:1">a &amp; b&#8232;c <![CDATA[<raw> & ]]><!-- note -->d',
    "  e</Text>",
  ),
  "a closing tag that does not match": '<Frame id="2:1">\n<Text>hi</Frame>',
  "a tag left open": '<Frame id="2:1">\n  <Frame id="2:2"/>',
  "a closing tag that closes nothing": '<Frame id="2:1"/>\n</Frame>',
  "a bare ampersand": '<Text id="1:1">Fish & chips</Text>',
  "an attribute given twice": '<Frame id="2:1" name="A" name="B"/>',
  "an attribute value without quotes": "<Frame id=2:1/>",
  "an attribute value holding a <": '<Frame id="2:1" name="a < b"/>',
  "a comment left open": '<Frame id="2:1"/><!-- open',
  "an empty XML": "",
  "whitespace only": "  \n\t\n  ",
};

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
const PINNED_RIGHT = {
  position: "absolute",
  right: "10px",
  top: "0",
  width: "300px",
};

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
      '<Frame id="1:2" position="absolute" left="0" right="0" width="100px"/>',
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
  "shadows bottom first, inset ones inner, blurs at Figma's double radius": {
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
    now: {
      unchanged: ["id", "gap", "padding"],
      current: { display: "flex" },
    },
  },
  "what the layer does not hold yet": {
    xml: '<Frame id="2:1" gap="8px" padding="4px"><Text name="Title">Hi</Text></Frame>',
    now: {
      unchanged: ["id", "padding"],
      text: true,
      current: { display: "flex" },
    },
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
    now: {
      visible: false,
      current: {
        display: "flex",
        "flex-direction": "column",
      },
    },
  },
  "a hidden layer shown again without auto layout": {
    xml: '<Frame id="5:1" display="block"/>',
    now: { visible: false },
  },
  "a text the layer already reads is not sent": {
    xml: '<Text id="1:1" color="#F00">Hi</Text>',
    now: {
      unchanged: ["id"],
      text: true,
    },
  },
  "a new gap keeps the direction and wrap the layer has": {
    xml: '<Frame id="1:1" column-gap="24px"/>',
    now: {
      current: {
        display: "flex",
        "flex-direction": "column",
        "flex-wrap": "wrap",
        gap: "12px",
        "column-gap": "40px",
      },
    },
  },
  "a gap shorthand resets the line gap the layer has": {
    xml: '<Frame id="1:1" gap="20px"/>',
    now: {
      current: {
        display: "flex",
        "flex-wrap": "wrap",
        gap: "12px",
        "row-gap": "30px",
      },
    },
  },
  "a new direction keeps the gap the layer has": {
    xml: '<Frame id="1:1" flex-direction="column"/>',
    now: {
      current: {
        display: "flex",
        gap: "12px",
      },
    },
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
    now: {
      unchanged: ["id"],
      current: { "text-decoration": "underline" },
    },
  },
  "a new size keeps the edge the layer is pinned to": {
    xml: '<Frame id="1:1" width="320px"/>',
    now: { current: PINNED_RIGHT },
  },
  "a new edge replaces the layer's": {
    xml: '<Frame id="1:1" left="0"/>',
    now: { current: PINNED_RIGHT },
  },
  "a new top keeps the layer absolute": {
    xml: '<Frame id="1:1" top="5px"/>',
    now: {
      current: {
        position: "absolute",
        left: "10px",
        top: "0",
      },
    },
  },
  "truncation keeps the text-overflow the layer has": {
    xml: '<Text id="1:1" overflow="hidden"/>',
    now: {
      current: {
        overflow: "hidden",
        "text-overflow": "ellipsis",
        "white-space": "nowrap",
      },
    },
  },
  "a new text style writes the text's own values and runs again": {
    xml: '<Text id="1:1" textStyle="h2" font="700 16px/24px \'Inter\'">Hi <Span color="#F00">there</Span></Text>',
    now: {
      unchanged: ["id", "font"],
      text: true,
      current: {
        font: "700 16px/24px 'Inter'",
        "letter-spacing": "0.1em",
      },
    },
  },
  "a text style the layer holds writes nothing again": {
    xml: '<Text id="1:1" textStyle="h2" font="700 16px/24px \'Inter\'">Hi <Span color="#F00">there</Span></Text>',
    now: {
      unchanged: ["id", "textStyle", "font"],
      text: true,
    },
  },
  "a new text style writes a decoration again from the element's own values, not the layer's": {
    xml: '<Text id="1:1" textStyle="h2" text-underline-offset="2px"/>',
    now: {
      unchanged: ["id", "text-underline-offset"],
      text: true,
      current: { "text-decoration": "underline" },
    },
  },
  "span problems ranked among the element's own, by the element's attribute order": {
    xml: '<Text id="1:1" color="#F00" font="huge">a<Span color="nope">b</Span><Span letter-spacing="wide">c</Span></Text>',
  },
  "problems in the element's attribute order, not the table's": {
    xml: '<Frame id="1:1" border-radius="1em" display="flex" gap="big" background="linear-gradient(90deg, #000, #FFF)"/>',
  },
};

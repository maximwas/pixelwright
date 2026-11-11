/** 0.7.0's apply-read cases, verbatim: each named for what it shows; apply-read.json pins what the reader makes of them. */

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
  "an unknown tag near none": '<Xyzzy id="2:2"/>',
  "a Figma type design_read writes, changed by id": '<Widget id="2:2"/>',
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
  "in a copy, a refused layer's new layers are not created, and its counterparts stand alone":
    '<Frame copyOf="2:1"><Fram id="2:2"><Frame name="New"/><Frame id="2:3"/></Fram></Frame>',
  "in a new instance, a refused layer's new layers are not created":
    '<Instance component="Card"><Fram id="I1:1;1:2"><Frame name="New"/></Fram></Instance>',
  "in a copy, a skipped layer's new layers are not created, and its counterparts stand alone":
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
  "shapes not drawn from XML": lines("<Vector/>", "<Star/>", "<Polygon/>", "<BooleanOperation/>", "<TransformGroup/>"),
  "a text on a path is made along d or arc, which only it takes": lines(
    "<TextPath>No path</TextPath>",
    '<TextPath d="M 0 0 L 100 0">Along</TextPath>',
    '<Frame d="M 0 0 L 100 0" start="0 0"/>',
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
  "a new layer under a skipped new one is not created, and the layers it names stand alone":
    '<Frame id="bad"><Frame name="New"><Frame id="1:5" opacity="0.5"/><Text>x</Text></Frame></Frame>',
  "a Span outside a Text: the layers in it are read, and it takes a place among its siblings":
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
  "in a copy, a counterpart under a skipped layer takes its source's id before a later one":
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
  "a nested Span's characters join its Span, and what it sets is an error":
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

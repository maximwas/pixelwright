/** The guide's layout topic. */
export const LAYOUT = {
  about:
    "design_apply layouts: when to use flex, grid or absolute placement; grid tracks, spans and cells; pinned and centred layers.",
  markdown: `# Laying out: flex, grid and absolute placement

\`design_apply\` lays out a frame's children as Figma does: auto layout as flex, grid auto layout as grid, or each
child placed on its own (absolute). Pick the one that says what should happen when the content or the frame's size
changes.

## Which one

- **Flex** (\`display="flex"\`): one direction. A row of buttons, a nav bar or toolbar, a list, a stack of sections, a
  card's content. Children follow each other; one can take the room left.
- **Grid** (\`display="grid"\`): two directions, items lined up in rows and columns at once. Card grids, bento boxes,
  galleries, forms with a label column and a field column, pricing tables, footers with link columns.
- **Absolute** (\`position="absolute"\` with \`left\`, \`right\`, \`top\`, \`bottom\`): a layer over the others or
  pinned to a corner or an edge. A badge, a close button, an overlay, a decorative shape, layered images in a hero.
  Never for content that should reflow: it stays where it is pinned when the text or the cards around it grow.
- Nest them: a grid of cards, each card a flex column with an absolute badge.

## Flex

- \`display="flex"\` is a row, \`flex-direction="column"\` a column (no reverse order); \`flex-wrap="wrap"\` wraps
  either. \`gap\` spaces the children and the wrapped lines; \`row-gap\` and \`column-gap\` set one axis each, as in
  CSS.
- \`padding\` takes 1 to 4 lengths. \`justify-content\` aligns along the direction (\`flex-start\`, \`center\`,
  \`flex-end\`, \`space-between\`, \`space-around\`, \`space-evenly\`; a spread ignores \`gap\`), \`align-items\` across
  it (\`flex-start\`, \`center\`, \`flex-end\`, \`baseline\`). Figma aligns all children alike: a child's
  \`align-self\` takes only \`stretch\` or \`auto\`.
- A child's size: \`width\`/\`height\` in px is fixed; none (or \`auto\`) hugs its content; \`flex="1"\` takes the
  room left along the direction (Figma has no other weights); \`align-self="stretch"\` fills across it; \`min-width\`,
  \`max-width\`, \`min-height\` and \`max-height\` set limits. A new frame with \`display\` hugs what it holds unless
  sized or filling.

## Grid

- \`display="grid"\` with \`grid-template-columns\` and \`grid-template-rows\`, each a list of tracks: \`200px\` is
  fixed, \`1fr\` takes a share of the room left (\`2fr\` twice as much), \`auto\` fits its content; \`repeat(3, 1fr)\`
  repeats one track.
- Give both lists: a new grid has 2 columns and 2 rows, and an empty row still takes room. \`fr\` tracks share the
  grid's own size: give the grid a \`width\` (a \`height\` for \`fr\` rows) or let it fill its parent; on an axis where
  the grid hugs, Figma turns \`fr\` into \`auto\`.
- \`gap="16px"\` spaces rows and columns alike, \`gap="12px 24px"\` rows then columns; \`row-gap\` and \`column-gap\`
  set one each (design_read writes these two). \`padding\` works as in flex. \`justify-content\` and \`align-items\`
  are refused on a grid: align each child in its cell.
- Place a child with \`grid-column\` and \`grid-row\`, lines counted from 1 as in CSS: \`grid-column="3"\` is the third
  column, \`grid-column="1 / span 2"\` (or \`"1 / 3"\`) two columns from the first, \`grid-row="2 / span 3"\` three
  rows from the second. Always give the start line.
- A child without them takes the next free cell, row by row in the XML's order, and a cell holds one child: place
  every child of a grid, or none. A child with no free cell left goes into a new row at the end, sized like the last
  one (columns are never added). A cell past the tracks, a span past the last track or a taken cell is refused with
  Figma's error, and the child stays in the next free cell.
- In its cell a child keeps its size and sits in the top left corner, or where \`justify-self\` (horizontally) and
  \`align-self\` (vertically) put it: \`start\`, \`center\`, \`end\`, or \`stretch\` to fill the cell's width or height
  instead of a size of its own. \`flex="1"\` does not fill a cell.
- A new frame with a \`display\` of its own (a card laid out inside) hugs its content in its cell even with
  \`stretch\`: send \`<Frame id="…" justify-self="stretch" align-self="stretch"/>\` again once it is made.
- Move or delete the children of a row or column before taking it out of the tracks.
- design_read writes a grid the same way: three or more equal tracks as \`repeat()\`, each child's \`grid-row\` and
  \`grid-column\` from 1, \`span\` when it spans.

## Absolute

- \`position="absolute"\` takes a layer out of its flex or grid parent's flow: the other children, the padding and the
  gap act as if it were not there. It is placed against its parent and moves with it, so nest it in the frame it
  belongs to (the card, not the grid around the cards). Later in the XML is drawn on top (there is no
  \`z-index\`). \`position="relative"\` puts it back in the flow.
- Every child of a frame without auto layout (no \`display\`, or \`display="block"\`) is placed so: give it
  \`position="absolute"\` and its edges. Without edges it lands in the top left corner, and \`left\` or \`top\`
  without \`position="absolute"\` is refused.
- Edges in px: \`left\`/\`top\` pin it to the start; \`right\`/\`bottom\` to the end, where it stays when the parent
  is resized (\`right="12px" top="12px"\` is a top right badge; \`right="-8px" top="-8px"\` hangs it over the corner
  of a parent that does not clip); \`left\` and \`right\` without a \`width\` stretch it with the parent (\`top\` and
  \`bottom\` without a \`height\` likewise).
- Centred: \`left="calc(50% - 24px)"\` puts the left edge 24 px left of the centre, which centres a layer 48 px wide
  (half its size; \`top\` likewise), and keeps it there when the parent is resized; \`left="50%"\` puts the edge on
  the centre. Scaled with the parent: \`left="5%"\` with \`width="25%"\` (\`top\` with \`height\`). Only \`left\` and
  \`top\` take \`calc()\` and percents; tokens cannot place a layer.
- On the page itself a layer is placed by \`left\` and \`top\` alone (with \`position="absolute"\`); without them a new
  one goes beside the page's layers.

## Not supported

- Grid: \`minmax()\`, \`fit-content()\`, \`auto-fill\` and \`auto-fit\`, \`repeat()\` of several tracks, named lines and
  areas (\`grid-template-areas\`, \`grid-area\`), \`span\` without a start line, negative lines, \`grid-auto-flow\`,
  \`grid-auto-rows\`, \`justify-items\` and aligning the whole grid, subgrids.
- Flex: reverse directions, grow weights other than 1, \`flex-basis\`, \`order\` (the XML's order is the order).
- Absolute: \`z-index\`, \`inset\`, \`position: fixed\` and \`sticky\`, \`calc()\` other than around 50%, percents or
  \`calc()\` on \`right\` and \`bottom\`.

## Examples (each written with design_apply and read back)

A bento grid: three equal columns, two rows of 160 px, a card across two columns, one placed on the second row
across the last two, and a dot centred in the cell left free.

\`\`\`xml
<Frame name="Bento" display="grid" width="920px" grid-template-columns="repeat(3, 1fr)" grid-template-rows="160px 160px" gap="16px">
  <Frame name="Wide" grid-row="1" grid-column="1 / span 2" justify-self="stretch" align-self="stretch" border-radius="16px" background="#FFFFFF"/>
  <Frame name="Side" grid-row="1" grid-column="3" justify-self="stretch" align-self="stretch" border-radius="16px" background="#E4E4E7"/>
  <Frame name="Row two" grid-row="2" grid-column="2 / span 2" justify-self="stretch" align-self="stretch" border-radius="16px" background="#18181B"/>
  <Frame name="Dot" grid-row="2" grid-column="1" justify-self="center" align-self="center" width="64px" height="64px" border-radius="32px" background="#A1A1AA"/>
</Frame>
\`\`\`

A form: a fixed label column and a field column that takes the rest.

\`\`\`xml
<Frame name="Form" display="grid" width="480px" grid-template-columns="120px 1fr" grid-template-rows="auto auto" gap="12px 16px" padding="24px" border-radius="16px" background="#FFFFFF">
  <Text grid-row="1" grid-column="1" justify-self="end" align-self="center" font="500 14px/20px 'Inter'" color="#18181B">Email</Text>
  <Frame name="Email field" grid-row="1" grid-column="2" justify-self="stretch" height="40px" border="1px solid #D4D4D8" border-radius="8px" background="#FFFFFF"/>
  <Text grid-row="2" grid-column="1" justify-self="end" align-self="center" font="500 14px/20px 'Inter'" color="#18181B">Password</Text>
  <Frame name="Password field" grid-row="2" grid-column="2" justify-self="stretch" height="40px" border="1px solid #D4D4D8" border-radius="8px" background="#FFFFFF"/>
</Frame>
\`\`\`

A card: a flex column with a row whose field takes the room left, and a badge pinned to the top right corner.

\`\`\`xml
<Frame name="Plan" display="flex" flex-direction="column" width="320px" padding="24px" gap="12px" border-radius="16px" background="#FFFFFF">
  <Text font="600 18px/24px 'Inter'" color="#18181B">Pro plan</Text>
  <Frame name="Actions" display="flex" align-self="stretch" align-items="center" gap="12px">
    <Frame name="Field" flex="1" height="36px" border-radius="8px" background="#F4F4F5"/>
    <Text font="500 14px/20px 'Inter'" color="#18181B">Buy</Text>
  </Frame>
  <Frame name="Badge" position="absolute" right="12px" top="12px" display="flex" padding="4px 10px" border-radius="999px" background="#E11D48">
    <Text font="600 12px/16px 'Inter'" color="#FFFFFF">New</Text>
  </Frame>
</Frame>
\`\`\`
`,
} as const;

/** The guide's topics: what each is about, and its markdown. Written against the tools as they are. */
export const GUIDE_TOPICS = {
  workflow: {
    about: "Which tool to use when, from finding a section to its files.",
    markdown: `# Pixelwright: how to work with a Figma file

Pixelwright reads the files open in Figma Desktop through its plugin; nothing goes through Figma's REST API. Every
tool takes \`file\` (a session id from \`status\`, or a file name); without it, the active file.

1. **Connection.** \`status\` lists the connected files and which one is active. None connected: the user runs the
   Pixelwright plugin in Figma Desktop and keeps its window open (the first time, they type the pairing code status
   shows into the plugin window).
2. **Find what to read.**
   - \`selection_get\`: what the user selected ("this", "the selected one").
   - \`outline\`: the layer tree with boxes, x and y relative to the outlined layer; \`node: "0:0"\` lists the pages.
     A layer with \`$children="N"\` has more children than listed: outline it on its own.
   - \`nodes_find\`: layers by name, type, text or component.
   - \`node_show\`: selects a layer and brings it into view, so the user sees which one you mean.
3. **Read one section.** \`design_read\` returns the section as XML (see \`guide xml\`), then JSON with tokens, text
   styles, fonts, assets, hints and truncated. Read sections, not whole pages: past \`maxChars\` (80 000) the deepest
   branches are left empty with \`$truncated="true"\` and their ids listed in \`truncated\`; read each on its own.
   Pass \`assetsDir\` (e.g. src/assets) to get its icons and images written as files.
4. **Look at it.** \`screenshot\` renders a layer to PNG (inline up to 2000 px a side, scaled down to fit; \`save\`
   writes a .png file full size). Compare your build with it.
5. **The design system.** \`tokens_read\`: variables with every mode (light, dark…) and styles, as CSS or JSON.
   \`components_read\`: the components a page uses, or the file defines, with variants and properties.
6. **Files.** \`assets_export\`: several layers, or every asset inside one, as PNG, JPG, SVG or PDF, or the images as
   they were placed (originals).

Build the code from the XML with the project's own components, tokens and layout conventions: the XML is the spec, not
the code to paste. Hints in design_read say what Figma left unbound (raw colours equal to tokens, unnamed layers,
frames without auto layout).
`,
  },
  xml: {
    about: "The XML design_read returns: tags, metadata, CSS attributes, read-only attributes.",
    markdown: `# Pixelwright XML

\`design_read\` writes a section as XML: one element per visible layer, Figma's layer type as the tag, CSS
properties as attributes.

## Tags

- Figma's types in PascalCase: \`Frame\`, \`Group\`, \`Section\`, \`Component\`, \`ComponentSet\`, \`Instance\`, \`Text\`,
  \`Rectangle\`, \`Ellipse\`, \`Line\`, \`Slot\`…
- \`Image\`: a true image (a photo, a layer filled with an image, a masked group, a layer with an effect CSS cannot
  draw). Its \`src\` is a PNG of what it shows.
- \`Icon\`: a vector, or a group or instance drawn only with vector shapes (a logo). Its \`src\` is one SVG.
- \`Span\`: a run inside a \`Text\` whose style differs from the text's own.
- Hidden layers and slices are left out.

## Metadata attributes, in this order

\`id\` (instance children keep \`I…;…\` ids), \`name\` (left out on a text named by its content), \`component\` and
\`variant\` ("Size=Large, State=Default") on instances, \`props\` (an instance's text and boolean properties,
"Label=Sign up, Icon=true"; a comma, = or backslash inside a name or value comes escaped with a backslash),
\`description\` (components), \`note\` (Dev Mode annotations, "Category: text", several joined with " | "), \`href\`
(a prototype link, or a text's hyperlink), \`textStyle\`, \`src\` (assets).

## CSS attributes

Ready CSS values, in this order: display, flex-direction, flex-wrap, position, left, right, top, bottom, width,
height, min/max sizes, flex, align-self, grid-row, grid-column, justify-self, padding, justify-content,
align-items, align-content, gap, column-gap, row-gap, grid-template-columns/rows, transform, opacity, overflow,
text-overflow, white-space, border-radius, border (or border-top…, outline), background, box-shadow, text-shadow,
filter, backdrop-filter, font, letter-spacing, text-transform, text-decoration (with text-underline-offset,
text-decoration-thickness), text-align, text-wrap, color.

- Auto layout is flex (or grid); defaults are left out (row, flex-start, gap 0). A gap is written only between two or
  more children.
- Sizes: fixed sizes in px; hug writes nothing; fill is \`flex: 1\` along the parent's direction and
  \`align-self: stretch\` across it. The layer you read always has its width and height.
- A child of a frame without auto layout, or an absolute child, has \`position: absolute\` and is placed against its
  parent element: give that parent \`position: relative\`. Constraints: right/bottom when pinned to the end,
  \`calc(50% ± n px)\` when centred, left and right without a width when stretched, percents when scaled.
- A turned layer has \`transform: rotate()\` and is placed by its centre; a mirrored one \`scaleX(-1)\`.
- Colours bound to a style or variable are \`var(--Name)\` (see \`guide tokens\`); values for them are in the JSON
  \`tokens\`. A text with a \`textStyle\` carries only what differs from the style; \`textStyles\` holds the style's font.
- Lengths are whole pixels; letter spacing keeps fractions.

## Read-only attributes (start with $)

- \`$css\`: what the mapping cannot write back yet, as Figma's own CSS: gradients, blend modes, line clamps, lists,
  a negative gap ("children overlap"), a mask among layers.
- \`$children="N"\`: the layer has N children and not all are listed (snapshot budget or maxChars).
- \`$truncated="true"\`: the branch was emptied, or the text shortened, to fit maxChars; its id is in \`truncated\`.

## Example (Positivus, a card)

\`\`\`xml
<Frame id="2:4870" name="Card" display="flex" width="600px" padding="50px" justify-content="space-between" align-items="center" overflow="hidden" border-radius="45px" border="1px solid var(--Dark)" background="var(--Grey)" box-shadow="0 5px 0 0 #191A23">
  <Instance id="2:4873" name="Link" component="Link" variant="Property 1=Black" display="flex" align-items="center" gap="15px">
    <Icon id="I2:4873;334:1478" name="Icon" src="assets/icon.svg" width="41px" height="41px"/>
    <Text id="I2:4873;334:1481" name="Label" font="400 20px/28px 'Space Grotesk'" color="var(--Black)">Learn more</Text>
  </Instance>
</Frame>
\`\`\`
`,
  },
  tokens: {
    about: "How tokens are named and written: styles, variables, modes, aliases, units, libraries.",
    markdown: `# Tokens

\`design_read\` writes a bound colour or length as \`var(--Name)\` and lists the values it used in \`tokens\`;
\`tokens_read\` returns the whole set.

## Names

- A style: its name with every run of other characters than letters, digits, _ and - turned into "-": "Dark" →
  \`--Dark\`, "Brand/Primary 500" → \`--Brand-Primary-500\`. Letters of any script stay.
- A variable: its Web code syntax when the designer set one (var(--surface) → \`--surface\`), else its name the same
  way ("space/4" → \`--space-4\`).
- A text style is \`--<name>-font\`, holding its font shorthand: \`font: var(--h3-font)\`.

## tokens_read

- It takes the file's own styles and variables, and those the current page (or \`within\`) uses from a team library:
  a file built on a library has its tokens there. \`used: false\` keeps only the file's own.
- format css (default): \`:root\` holds every collection's default mode and the styles; every other mode is a block
  \`[data-<collection>="<mode>"]\` with that collection's variables. Put the attribute on the element the theme applies
  to: \`<html data-brand="dark">\`.
- format json: per collection, its modes and each variable's value in every mode.
- \`collections\` keeps only the named ones; \`libraries: true\` adds the enabled libraries' variables by name and type.

## Values

- Colours as hex (rgba when see-through); a colour with an opacity variable as \`color-mix(in srgb, … N%, transparent)\`.
- Numbers in px, except opacity and font weight, which have no unit.
- Strings quoted; booleans as true/false (CSS has no booleans); easings as CSS easing functions (springs as ease);
  durations in seconds.
- An alias is \`var(--other)\`. One that points nowhere is a comment and a note.

## Not tokens yet

Paint styles with gradients or images, blur effect styles, and library variables the file does not use (Figma gives
their values only once they are imported into the file). \`notes\` names each.
`,
  },
  assets: {
    about: "What becomes a file, in which format, and how files are named.",
    markdown: `# Assets

Only true assets become files; everything else is CSS.

## What is an asset

- \`Icon\` (SVG): a vector, Figma Draw's text on a path or transform group, or a group, frame or instance without auto
  layout drawn only with vector shapes, at least one of them a true vector (a logo, an arrow in a circle). Exported with
  everything it draws, strokes outside its box included, and sized by that box.
- \`Image\` (PNG at 2x): a layer filled with an image, a mask group (its bottom layer is the mask), a layer with a
  video, pattern or shader fill or a noise, texture or glass effect. Exported as its own box: its corners, drop
  shadows and outline stay CSS around it; its opacity, blur and inner shadows are in the file.
- A layer the designer marked for export (PNG, JPG or SVG; a PDF export is not a web asset), in that format, when it
  holds no text (an export on a section with text is a preview, read as layers). A frame with an image fill and children keeps its children: the image is its
  \`background\`, written as the original image.
- Plain rectangles, ellipses, buttons, cards, shadows are CSS, never images.

## design_read vs assets_export

- \`design_read\` with \`assetsDir\` writes the assets of the section it reads, and its XML points at the files.
- \`assets_export\` writes files on their own: \`nodes\` (up to 50 layers, one file each, in the format and scale you
  give: PNG, JPG, SVG or PDF) or \`from\` (every asset inside one layer). \`original: true\` writes the images as they
  were placed, full size and in their own format, instead of renders.

## Files

Named after the layer (\`Hero photo\` → hero-photo.png, a component's variant added: company-logo-amazon.svg). The
same bytes are written once and shared; a name already taken by other bytes gets -2; a file already in the folder is
never overwritten with other bytes.
`,
  },
  email: {
    about: "Turning the XML into an HTML email that renders in Gmail, Outlook and Apple Mail.",
    markdown: `# Building an HTML email from the XML

Email clients are not browsers: Gmail strips \`<style>\` blocks it does not like, Outlook on Windows renders with Word
and ignores flex, grid, position and most of CSS. Read the section with \`design_read\` (and \`screenshot\` to compare),
then translate:

## Layout

- The design's width (usually 600 px) becomes a centred \`<table width="600">\` inside a 100%-wide wrapper table.
- Every flex column is a stack of table rows; every flex row is one row with a \`<td>\` per child; \`gap\` becomes
  padding on the cells or spacer cells; \`justify-content\`/\`align-items\` become \`align\` and \`valign\` on cells.
- \`position: absolute\` has no email equivalent: text over a picture means a background image on the cell (with a
  solid background colour as the fallback) or one image with the text in it and \`alt\`.
- Write sizes as attributes too (\`width\`, \`height\` on tables, cells and images), not only in CSS.

## Styles

- Inline every style on its element (\`style="…"\`); keep a small \`<style>\` only for media queries and dark mode.
- Colours from \`tokens\` as plain hex: email clients do not support \`var()\`.
- Fonts: the \`fonts\` list tells which families the design uses. Web fonts load in Apple Mail and some others only:
  always end the stack with a safe fallback (\`'Satoshi', Arial, sans-serif\`).
- Borders, radius, padding and background colours work on cells; \`box-shadow\`, \`filter\` and \`backdrop-filter\` do
  not render in most clients: drop them or bake them into an image.

## Images

- Export with \`assetsDir\` or \`assets_export\` at 2x (the default) and give each \`<img>\` its 1x \`width\` and
  \`height\` attributes, \`display:block\`, \`border:0\` and a real \`alt\`.
- Icons as SVG do not render in many clients: export them as PNG (\`assets_export\` with \`format: "PNG"\`).
- Host the files on a server or CDN; email clients cannot read local paths.

## Links and text

- Every button is a link (\`href\` in the XML when the design has one): a table cell with the background colour and an
  \`<a>\` with padding inside, never a \`<button>\`.
- Keep the text as text, not images, so it can be read and translated; give line heights in px.

## Dark mode

Clients invert colours on their own; check the result with a screenshot of the light design, and add
\`@media (prefers-color-scheme: dark)\` rules (supported in Apple Mail and Outlook for Mac) for logos and backgrounds
that turn unreadable.
`,
  },
} as const;

export type GuideTopic = keyof typeof GUIDE_TOPICS;

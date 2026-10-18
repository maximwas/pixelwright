/** The guide's xml topic. */
export const XML = {
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
(a prototype link, or a text's hyperlink), \`mask\` (alpha, vector or luminance: the layer masks the layers above it),
\`data-<collection>\` (a variable mode set on the layer, \`data-color-modes="dark"\`;
the read's root also has the modes it takes from above), \`textStyle\`, \`src\` (assets).

A \`data-<collection>="<mode>"\` attribute is the selector tokens_read's CSS writes for that mode: put it on the
element in the build too, and the element takes that mode's values. design_apply sets a layer's mode the same way
(the collection and mode by these slugs or their own names); \`data-<collection>=""\` clears it, so the layer takes
its parent's mode.

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
  \`tokens\`. In a Display P3 file every colour is \`color(display-p3 r g b)\` (as tokens_read writes it too): keep
  it so, it is what the designer chose. A text with a \`textStyle\` carries only what differs from the style; \`textStyles\` holds the style's font.
- Lengths are whole pixels; letter spacing keeps fractions.

## Read-only attributes (start with $)

- \`$css\`: what the mapping cannot write back yet, as Figma's own CSS: a diamond gradient, a turned radial one, blend
  modes CSS has no name for, line clamps, lists, a negative gap ("children overlap").
- \`$children="N"\`: the layer has N children and not all are listed (snapshot budget or maxChars).
- \`$truncated="true"\`: the branch was emptied, or the text shortened, to fit maxChars; its id is in \`truncated\`.
- \`$repeat="N"\`: with \`repeats: true\`, the first of N alike neighbours (list items, cards, rows) stands for all of
  them; the JSON's \`repeats\` lists the run's layers and, a row per layer, the values they hold apart (texts, src,
  variant, props, href, position). Build one component and map the rows over it. Sent back, it changes only the first.
- \`$code="Button"\`: an instance the project's Code Connect template or batch row renders, written without its
  children; its code is in \`codeComponents\`, whose \`unread\` names the properties that code leaves out: add them
  (see \`guide code-connect\`). design_apply leaves its children alone.
- \`$exposed="true"\`: a nested instance its component exposes: its properties are the component's API too.
- \`$css\` holds \`property: value\` pairs only, explained in hints: \`blur: progressive from 0px at 50% 0% to 8px at
  50% 100%\` (a blur that changes across the layer; \`filter\` holds its end radius) and \`stroke-align: center\` (half
  of the stroke paints outside the box, which a border-box border does not; \`inspect\` gives the painted box),
  \`list-spacing: 8px\` (the space between a list's items, apart from paragraph spacing) and
  \`stroke-linecap: round\` (a line's round or square ends, which a CSS border does not draw).
- \`$override="text, background"\`: what this layer of an instance changes that its component's properties do not
  say (a feature text rewritten, an icon recoloured). Code built from the component cannot show it: give the
  component a property or a variant for it, or build that instance as a one-off. A hint lists them all.
- \`$dev="ready for dev"\` on the read's root: the designer marked it (or a frame or section around it) ready for
  development (or \`completed\`).
- \`$grid-style="Desktop 12"\`: the grid style the frame's \`layout-grid\` comes from.
- \`$pins="width, padding"\`: the properties the designer pinned in the layer's Dev Mode annotations, in CSS words:
  take those values exactly.
- \`$motion="opacity 0→1, translate-y 24→0px; 0–0.6s ease-out"\`: the layer's Figma Motion, led by the animation
  style's name when one made it. The JSON's \`motion\` has it as CSS: a \`@keyframes\` per animated layer and a rule
  for the class it names (\`layers\`), keyframes placed over the timeline; what CSS cannot animate is a comment.
- \`$on-click\`, \`$on-hover\`, \`$on-press\`, \`$on-drag\`, \`$on-mouse-enter\`, \`$on-mouse-leave\`,
  \`$on-mouse-down\`, \`$on-mouse-up\`, \`$on-key\`, \`$after-timeout\`, \`$on-media-hit\`, \`$on-media-end\` (any other trigger
  as \`$on-<trigger>\`): the layer's prototype interactions, e.g. \`$on-hover="change to Type=Hover; smart animate 300ms
  ease-out"\` (a variant to switch to on hover, and how: build it as the hover state); the easing is valid CSS, a spring
  drawn as \`linear()\`. A link stays \`href\`.

## Text

- \`&#10;\` is a paragraph break (Enter), \`&#8232;\` a line break inside a paragraph (Shift+Enter, \`<br>\` in HTML):
  never spaces.
- \`line-height: normal\` is Figma's Auto line height, the font's own spacing (about 1.2× the size for most fonts):
  give it in px where the build must match; \`inspect\` shows each text's.

## Example (Orbit, a pricing card, abridged)

\`\`\`xml
<Instance id="54:268" name="Plan – Pro" component="Plan Card" props="Price=$12, Popular=true, Description=For freelancers shipping fast., Name=Pro" note="The price comes from the billing API. Show the Popular badge only on the plan the API marks popular." display="flex" flex-direction="column" width="385px" height="394px" padding="var(--space-32)" gap="var(--space-24)" border-radius="var(--radius-lg)" border="2px solid var(--color-brand)" background="var(--color-surface)" box-shadow="var(--Shadow-Card)" $on-click="go to Checkout – Desktop; dissolve 300ms ease-out">
  …
  <Instance id="I54:268;54:211" name="Button" component="Button" variant="Variant=Primary, State=Default" props="Label=Get started" display="flex" align-self="stretch" padding="var(--space-12) var(--space-24)" justify-content="center" align-items="center" border-radius="var(--radius-md)" background="var(--color-brand)">
    <Text id="I54:268;54:211;54:190" name="Label" textStyle="Button" color="var(--color-on-brand)">Get started</Text>
  </Instance>
  <Frame id="I54:268;54:213" name="Features" display="flex" flex-direction="column" align-self="stretch" gap="var(--space-12)" overflow="hidden">
    <Frame id="I54:268;54:214" name="Feature" display="flex" align-items="center" gap="var(--space-8)" overflow="hidden">
      <Icon id="I54:268;54:215" name="Icon/Check" component="Icon/Check" src="assets/icon-check.svg" width="20px" height="20px"/>
      <Text id="I54:268;54:217" name="Text" textStyle="Body Small" color="var(--color-ink)">Unlimited projects</Text>
    </Frame>
    …
  </Frame>
</Instance>
\`\`\`
`,
} as const;

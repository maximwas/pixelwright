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
7. **Write.** \`design_apply\` writes the same XML back into Figma: change layers by id, create new ones (see \`guide
   write\`); \`tokens_apply\` writes variables and styles in tokens_read's JSON shape (see \`guide tokens\`);
   \`execute\` runs plugin code for what neither can say. The user turns Allow edits on in the plugin window first.
8. **Code Connect.** Where the project has Figma Code Connect templates (\`*.figma.ts\`), \`design_read\` gives each
   connected instance as \`$code\` with its code in \`codeComponents\`: use that code as it is. \`code_connect_read\`
   shows what is connected and what is not (see \`guide code-connect\`).

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
- \`$code="Button"\`: an instance the project's Code Connect template renders, written without its children; its code
  is in \`codeComponents\` (see \`guide code-connect\`). design_apply leaves its children alone.

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
  \`[data-<collection>="<mode>"]\` with that collection's variables. Put the attribute on the html element,
  \`<html data-brand="dark">\`: a token in \`:root\` that points at another collection's token is computed in \`:root\`
  and does not follow a mode set lower in the page.
- format json: per collection, its modes and each variable's value in every mode.
- \`collections\` keeps only the named ones; \`libraries: true\` adds the enabled libraries' variables by name and type.
- Past \`maxChars\` (80 000) only the summary comes back, with the collections to read one at a time.
- An alias to a token the output leaves out (a collection you did not ask for) is named in \`notes\`.

## tokens_apply

- It takes what tokens_read returns with format json, or the same shape written by hand: \`collections\` (each with
  \`name\`, \`modes\` and \`variables\`: \`name\`, \`type\` if you like, \`values\` by mode name, \`description\`,
  \`token\`) and \`styles\` (\`paint\`, \`text\`, \`effect\`: \`name\` and \`value\`). Values are CSS, as below.
- Collections, modes and variables are found by name in the file's own collections, or made; a new collection's
  first mode renames Figma's default one. A variable's type comes from its first value when not given.
  \`var(--token)\` makes an alias, to a variable of the call (in any order) or of the file. A \`token\` other than the
  name's own becomes the variable's Web code syntax.
- A paint style's value reads as a \`background\` (colours, a colour variable), a text style's as the \`font\`
  shorthand, an effect style's as a \`box-shadow\` list.
- A value a variable or style already holds is left as it is, so sending tokens_read's own output writes nothing;
  send only what you change. Nothing is ever deleted (use \`execute\` to remove a token).
- A library's collection or style the file uses is never copied into the file: change it in the library.
- More modes than the file's Figma plan allows: that mode's error comes back and the other modes are written.
- One undo step; \`dryRun\` checks names, types, modes and aliases without writing.

## Values

- Colours as hex (rgba when see-through); a colour with an opacity variable as \`color-mix(in srgb, … N%, transparent)\`.
- Numbers in px, except opacity and font weight, which have no unit.
- Strings quoted; booleans as true/false (CSS has no booleans); easings as CSS easing functions (springs as ease);
  durations in seconds.
- An alias is \`var(--other)\`. One that points nowhere is a comment and a note.

## Not tokens yet

Paint styles with gradients or images, blur effect styles, and library variables the file does not use (Figma gives
their values only once they are imported into the file: \`libraries: true\` lists them by name and type). Paint styles
and effect styles that are left out are named in \`notes\`.
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
  shadows and outline stay CSS around it, and the rest of its look (opacity, blur, inner shadows) is left to the
  file, as Figma renders it.
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
  write: {
    about:
      "design_apply: changing, creating, copying and moving layers, components, instances and images with the same XML.",
    markdown: `# Writing with design_apply

\`design_apply\` takes the XML \`design_read\` returns. The user turns **Allow edits** on in the plugin window first;
until then every call is refused (\`dryRun: true\` checks a call without writing, switch on or off).

## Changing a layer

- An element with \`id\` changes that layer, and only the attributes it gives: \`<Frame id="2:4869" gap="48px"/>\`
  changes the gap and nothing else. Read the layer first, edit the XML, send back what you changed (sending the whole
  read back is fine: what the layer already has is not written again).
- Leaving an attribute out never removes it. To remove, write the value that means none: \`background="none"\`,
  \`border="none"\`, \`box-shadow="none"\`, \`width="auto"\` (hug), \`max-width="none"\`, \`flex="none"\`,
  \`left="auto"\`, \`transform="none"\`, \`display="block"\` (no auto layout), \`display="none"\` (hide).
- A text: \`<Text id="…">New words</Text>\` replaces the characters and keeps the look; spans style runs. A Text
  without content keeps its text, so \`<Text id="…" color="var(--Dark)"/>\` only recolours it. A text inside an
  instance changes by its \`I…;…\` id and stays an override.
- What Figma keeps together is completed from the layer: a new \`column-gap\` keeps its direction and wrap, a new
  \`filter\` keeps its shadows, a new \`border-bottom\` keeps its other sides, a new \`width\` keeps the edge it
  is pinned to. A new \`left\` or \`right\` replaces both edges.
- Moving: an element with \`id\` under another parent element moves the layer there, \`before="id"\` /
  \`after="id"\` puts it next to that layer, and listing layers in another order reorders them. A layer inside an
  instance stays where it is (only an instance's slots take new layers).
- A text \`design_read\` shortened (\`$truncated\`) is never written back: read that layer on its own to change it.
- A hidden layer comes back with \`display\` (\`flex\`, \`grid\` or \`block\`, as it was laid out).
- Each tag takes its own attributes: no \`background\` or \`gap\` on a Text (its colour is \`color\`), no text
  styles on a Frame, no auto layout on a shape; an element's id is given once (a copy has none).

## Creating

- An element without \`id\` creates a layer: \`Frame\`, \`Section\`, \`Text\`, \`Rectangle\`, \`Ellipse\`,
  \`Line\`, \`Instance\`, \`Component\`, \`ComponentSet\`, \`Image\`, \`Icon\`, \`Slot\`. It goes inside its parent
  element, after the element before it (alone: last); at the top level into \`parent\` or the current page, or next
  to a layer with \`before="id"\` / \`after="id"\`. Groups and vectors are not drawn from XML: use an \`Icon\`.
- A new layer has what its XML says and nothing more: no fill without \`background\`, no clipping without
  \`overflow\`; a new auto layout frame hugs unless sized; a new text is black unless \`color\` says otherwise.
- **A copy:** \`<Frame copyOf="2:4870" name="Card 2">\` clones that layer (everything the XML cannot show comes
  along) and then writes the element onto the copy. Inside it, elements with the source's ids write the copy's
  layers: copy a card's XML, drop the root's id, add \`copyOf\`, change the title.

## Components and instances

- \`<Instance component="Heading" variant="Property 1=Green" props="Label=Our work, Has icon=false"/>\` makes an
  instance by the names design_read and components_read write: the file's components, the ones its page uses from a
  library, or \`component="key:<key>"\` for a library one the file does not use yet. \`variant\` picks the variant
  (values left out are the set's default), \`props\` sets text and boolean properties (names without Figma's #id).
- Inside a new instance, elements with another instance's ids (of the same component and variant) or the
  component's own write the new instance's layers, as overrides; the other instance stays as it is.
  \`<Instance copyOf="id">\` copies an instance with its overrides instead.
- An existing instance: \`variant\` switches it, \`props\` changes its properties, \`component\` swaps it to
  another component. A comma or \`=\` inside a name or value is escaped with a backslash, as design_read writes it.
- \`<Component name="Badge">…</Component>\` makes a component like a frame; inside it, \`prop="Label"\` on a
  Text makes a text property bound to it and \`visibleProp="Shown"\` makes a boolean property bound to the layer's
  visibility. \`<ComponentSet name="Badge">\` holds \`<Component variant="Tone=Dark">\` variants: they are
  combined into one set (the properties defined once on it) and laid out in a grid. \`description\` describes a
  component or a set; an instance of a new component can follow later in the same XML.
- \`<Slot name="Content">\` makes a slot in a new component; in an instance, give its \`<Slot id="…">\` new layers.

## Images, icons and notes

- \`<Image src="photos/hero.jpg" width="600px" height="400px"/>\` makes an image from a file (PNG, JPG or GIF, up
  to 32 MB and 4096 px a side; convert WebP first), \`<Icon src="icons/arrow.svg" width="24px"/>\` an icon from an
  SVG; \`background: url(…)\` fills a frame with one. Paths are on the server's machine, from its folder.
- An existing \`Image\` with another file in \`src\` takes that image, keeping its fit. A file design_read or
  assets_export wrote for that layer (a render of it) changes nothing wherever it went, so a read sent back keeps
  the originals; a picture saved over it is a new image. An existing icon is replaced by deleting it and creating a
  new one.
- \`note="Behavior: opens the modal | Spacing: 8px"\` writes the layer's Dev Mode notes, the whole list (a
  category the file lacks is made; \`note=""\` removes them). A note sent back as it was keeps its formatting and
  pinned properties; notes without text, which design_read does not show, stay.

## Values

- Lengths in px; \`var(--Name)\` binds the variable or style of that name, as \`design_read\` and \`tokens_read\`
  write them (a paint style, a colour or number variable, an effect style); \`textStyle="h3"\` applies a text style.
- \`font\` is the shorthand \`[italic] weight size/line-height 'Family'\`; Figma must have the family and that
  weight, or the error lists the styles it has.
- Sizes: \`width\`/\`height\` in px or \`auto\`; \`flex="1"\` fills an auto layout parent's direction,
  \`align-self="stretch"\` fills across it. Placement: \`position="absolute"\` with \`left\`/\`right\`/\`top\`/
  \`bottom\`, \`calc(50% ± Npx)\` for the centre, percents (with the size in percents) to scale.
- Not written yet, and refused with an error: gradients, blend modes, grow weights, \`overflow: scroll\`, links on
  frames, dashed underlines.

## Errors and undo

\`nodes_delete\` deletes layers by id (not those inside an instance: hide them with \`display="none"\`).

Each element is written on its own: an error names its line and attribute, and the rest of the XML still goes in.
\`created\` lists the new layers' ids by line, \`changed\` the layers written to. One call is one undo step in Figma:
the user's Cmd+Z takes the whole call back.

Effects CSS cannot write (noise, texture, glass, hidden effects) stay when a layer's \`box-shadow\` or \`filter\`
changes, and a shadow sent back as it was keeps its colour variable and blend mode.

## Beyond the XML: execute

\`execute\` runs JavaScript in the plugin for what design_apply and tokens_apply cannot say (removing a variable,
a prototype link, a plugin data field). The code is the body of an async function given \`figma\` (the Plugin API)
and \`console\`: \`await\` works, \`return\` gives \`result\` (Figma's layers as {id, type, name}, plain data as
built), \`console.log\` lines come back as \`logs\`, and what it throws as \`error\`. What it changes during the call is
one undo step; it needs Allow edits, and the tool waits at most 25 s. Code it starts that outlives the call (timers,
listeners, work past the timeout) keeps running until the plugin window is closed, Allow edits or not; an endless loop,
synchronous or of awaits, freezes Figma until then. Read the result back with the read tools.
`,
  },
  "code-connect": {
    about: "Figma Code Connect templates: how design_read runs them, writing one, what Pixelwright supports.",
    markdown: `# Code Connect templates

Pixelwright runs the project's **Figma Code Connect templates** itself, on any Figma plan, without a token and without
publishing anything: \`design_read\` gives each instance a template connects as \`$code\` in the XML (no children) and
its code in \`codeComponents\` (\`{ ids, component, template, snippet, imports }\`: instances with the same code once),
with the read's \`imports\` once each and the failures in \`codeErrors\` (\`{ template, error, ids }\`). Nested connected
instances are inside their parent's snippet; the layer the read is of is never collapsed. The code takes at most 40% of
\`maxChars\` (the XML the rest), and all templates of a read five seconds: past either, instances are read as layers.
\`code: false\` reads every instance as layers. \`code_connect_read\` lists the templates, what each connects on the
page, the components none connects, and errors.

## Where templates are

The project folder is \`CLAUDE_PROJECT_DIR\`, else the server's working directory (never the home folder or the disk's
root). Templates are the files ending in \`.figma.ts\`, \`.figma.js\`, \`.figma.template.ts\` or \`.figma.template.js\`
among those \`figma.config.json\`'s \`codeConnect.include\` globs name (minus \`exclude\`; its
\`documentUrlSubstitutions\` are applied to urls), else all such files; dependency and build folders are never
searched.

## Writing one

Write it as Figma documents it, with types from the npm package \`@figma/code-connect\` (in tsconfig:
\`"types": ["@figma/code-connect/figma-types"]\`):

\`\`\`ts
// url=https://www.figma.com/design/<fileKey>/Kit?node-id=1-2
// component=Button
// source=src/components/Button.tsx
import figma from 'figma'

const button = figma.selectedInstance
const size = button.getEnum('Size', { Small: 'sm', Large: 'lg' })
const icon = button.getInstanceSwap('Icon')

export default {
  example: figma.tsx\`<Button size="\${size}"\${figma.helpers.react.renderProp('disabled', button.getBoolean('Disabled'))}>\${button.getString('Label')}\${icon?.executeTemplate().example}</Button>\`,
  imports: ['import { Button } from "@/components/Button"'],
  id: 'button',
}
\`\`\`

- \`url\` (required): the component's or component set's link (Copy link in Figma). \`component\`: the code component's
  name, as Figma has it (\`$code\` shows it). \`source\`: the code component's file.
- **Matching:** the url's node-id is the instance's component or set when that lives in the file read; a library's
  component matches by name: the Figma name's last part against \`component\` (else the file name before \`.figma.\`),
  case, spaces and punctuation aside (\`Buttons/Primary Button\` matches \`PrimaryButton\`). Check with
  \`code_connect_read\`.
- **Imports:** \`figma\` and the template's own relative helpers (\`import { sizes } from './helpers'\`, TypeScript or
  JavaScript); nothing else.
- **The API:** \`figma.selectedInstance\` (alias \`currentLayer\`) with \`getString\`, \`getBoolean(name, mapping?)\`,
  \`getEnum\`, \`getPropertyValue\`, \`getInstanceSwap\`, \`getSlot\` (the slot layer named after the property,
  \`connectedInstances\`), \`findInstance\`, \`findText\`, \`findLayers\`, \`findConnectedInstance(s)\` (with \`path\` and
  \`traverseInstances\`), \`executeTemplate\`, \`hasCodeConnect\`, \`codeConnectId\`, \`id\`, \`properties\`;
  \`figma.code\`, \`tsx\`, \`html\`, \`swift\`, \`kotlin\`, \`figma.helpers.react.*\`, \`figma.properties.*\`. Property names
  are as Figma shows them (without the #id suffix). Hidden layers are not found.
- **Errors** are the instance's alone: \`PROPERTY_NOT_FOUND\`, \`CHILD_LAYER_NOT_FOUND\` (when the missing layer is
  rendered), \`TEMPLATE_TIMEOUT\` (one second per instance, nested templates included; the template is not run again
  in that read), \`TEMPLATE_BUDGET\`, \`TEMPLATE_IMPORT\`, \`TEMPLATE_CYCLE\`, \`TEMPLATE_CUT\` (the read left out layers
  the code needs: read the instance on its own). Such an instance is read as usual, with its children.
- Old \`figma.connect(...)\` files are not run: \`npx figma connect migrate\` turns them into templates.

Templates run on this computer as the project's own code, in a separate context without \`require\`, \`process\` or
files, but that context is no protection against a hostile template: run Pixelwright only in projects you trust, as
you would their build scripts.
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

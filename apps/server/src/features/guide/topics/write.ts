/** The guide's write topic. */
export const WRITE = {
  about:
    "design_apply: changing, creating, copying and moving layers, components, instances and images with the same XML.",
  markdown: `# Writing with design_apply

\`design_apply\` takes the XML \`design_read\` returns. The user turns **Allow edits** on in the plugin window first;
until then every call is refused (\`dryRun: true\` checks a call without writing, switch on or off). Before a write
that changes many layers, pass \`version: "Before the hero rewrite"\`: a named version is saved in the file's history
first (not in a dry run), and the designer can go back to it; if it cannot be saved, nothing is written
(\`version_save\` saves one on its own, when the user asks). In a
Display P3 file, \`color(display-p3 …)\` (as design_read writes it) is written as it is, and hex, rgb() or hsl() are
taken as sRGB and converted to P3.

## Changing a layer

- An element with \`id\` changes that layer, and only the attributes it gives: \`<Frame id="54:243" gap="48px"/>\`
  changes the gap and nothing else. Read the layer first, edit the XML, send back what you changed (sending the whole
  read back is fine: what the layer already has is not written again).
- Leaving an attribute out never removes it. To remove, write the value that means none: \`background="none"\`,
  \`border="none"\`, \`box-shadow="none"\`, \`width="auto"\` (hug), \`max-width="none"\`, \`flex="none"\`,
  \`left="auto"\`, \`transform="none"\`, \`display="block"\` (no auto layout), \`display="none"\` (hide).
- A text: \`<Text id="…">New words</Text>\` replaces the characters and keeps the look; a \`<Span>\` (HTML's
  \`<span>\` too) styles a run of them. A Text
  without content keeps its text, so \`<Text id="…" color="var(--Dark)"/>\` only recolours it. A text inside an
  instance changes by its \`I…;…\` id and stays an override.
- What Figma keeps together is completed from the layer: a new \`column-gap\` keeps its direction and wrap, a new
  \`filter\` keeps its shadows, a new \`border-bottom\` or \`padding-top\` keeps its other sides, a new \`width\` keeps the edge it
  is pinned to. A new \`left\` or \`right\` replaces both edges.
- Moving: an element with \`id\` under another parent element moves the layer there, \`before="id"\` /
  \`after="id"\` puts it next to that layer, and listing layers in another order reorders them. A layer inside an
  instance stays where it is (only an instance's slots take new layers). An element alone (\`<Frame id="…"/>\`)
  moves its layer with everything inside it: leave out the layers inside that stay as they are, since each layer
  named is read before the write and a call reads only so many.
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
- **A copy:** \`<Frame copyOf="54:268" name="Card 2">\` clones that layer (everything the XML cannot show comes
  along) and then writes the element onto the copy. Inside it, elements with the source's ids write the copy's
  layers, and \`before\`/\`after\` with a source's id put a layer next to the copy's: copy a card's XML, drop the
  root's id, add \`copyOf\`, change the title, add a new layer in the same call.

## Components and instances

- \`<Instance component="Heading" variant="Property 1=Green" props="Label=Our work, Has icon=false"/>\` makes an
  instance by the names design_read and components_read write: the file's components, the ones its page uses from a
  library, or \`component="key:<key>"\` for a library one the file does not use yet (\`library_search\` finds those
  keys in the libraries saved with it). \`variant\` picks the variant
  (values left out are the set's default), \`props\` sets text and boolean properties (names without Figma's #id).
- Inside a new instance, elements with another instance's ids (of the same component and variant) or the
  component's own write the new instance's layers, as overrides; the other instance stays as it is.
  \`<Instance copyOf="id">\` copies an instance with its overrides instead.
- An existing instance: \`variant\` switches it, \`props\` changes its properties, \`component\` swaps it to
  another component. A comma or \`=\` inside a name or value is escaped with a backslash, as design_read writes it.
- \`<Component name="Badge">…</Component>\` makes a component like a frame; inside it, \`prop="Label"\` on a
  Text makes a text property bound to it and \`visibleProp="Shown"\` makes a boolean property bound to the layer's
  visibility. \`<ComponentSet name="Badge">\` holds \`<Component variant="Tone=Dark">\` variants: they are
  combined into one set (the properties defined once on it) and laid out in a grid; a set given \`display="flex"\`
  or \`"grid"\` lays them out itself, each variant placed by its own \`grid-row\`/\`grid-column\`, \`align-self\`
  or \`flex\`. \`description\` describes a
  component or a set; an instance of a new component can follow later in the same XML.
- \`<Slot name="Content">\` makes a slot in a new component; in an instance, give its \`<Slot id="…">\` new layers.

## Images, icons and notes

- \`<Image src="photos/hero.jpg" width="600px" height="400px"/>\` makes an image from a file (PNG, JPG or GIF, up
  to 32 MB and 4096 px a side; convert WebP first), \`<Icon src="icons/arrow.svg" width="24px"/>\` an icon from an
  SVG; \`background="url(…)"\` fills any layer that takes a background with one, a new or an existing frame,
  rectangle or ellipse (an avatar). Paths are on the server's machine, from its folder. \`icons_insert\` finds an
  open-source icon (Lucide, Material Symbols, Tabler…) and inserts it at a size, in a colour or bound to a token.
- An existing \`Image\` with another file in \`src\` takes that image, keeping its fit. A file design_read or
  assets_export wrote for that layer (a render of it) changes nothing wherever it went, so a read sent back keeps
  the originals; a picture saved over it is a new image. An existing icon is replaced by deleting it and creating a
  new one.
- \`note="Behavior: opens the modal | Spacing: 8px"\` writes the layer's Dev Mode notes, the whole list, as
  design_read writes it (\`note=""\` removes them). \`Behavior: \` files a note under the file's annotation category of
  that name; a name the file has no category for stays part of the text (no category is made). \` | \` separates the
  layer's own notes sent back and comes before a note a category starts; elsewhere it is text, so
  \`note="Tabs: Days | Weeks"\` is one note (two new notes without a category take two calls).
  A note sent back as it was keeps its category, formatting and pinned properties; notes without text, which
  design_read does not show, stay.

## Values

- Lengths in px (a bare number in a size, a place, a gap, a padding or a radius is taken as px; a bare line height
  is a multiple of the font size, as in CSS); \`var(--Name)\` binds the variable or style of that name, as \`design_read\` and \`tokens_read\`
  write them (a paint style, a colour or number variable, an effect style, on \`box-shadow\` or on a blur:
  \`backdrop-filter="var(--Blur-Backdrop)"\`); \`textStyle="h3"\` applies a text style.
- \`font\` is the shorthand \`[italic] weight size/line-height 'Family'\`; Figma must have the family and that
  weight, or the error lists the styles it has.
- Sizes: \`width\`/\`height\` in px or \`auto\`; \`flex="1"\` fills an auto layout parent's direction,
  \`align-self="stretch"\` fills across it. Placement: \`position="absolute"\` with \`left\`/\`right\`/\`top\`/
  \`bottom\`, \`calc(50% ± Npx)\` for the centre, percents (with the size in percents) to scale. When to use flex,
  grid or absolute placement, grid tracks and cells, with examples: see \`guide layout\`.
- Gradients: \`background\` takes \`linear-gradient(<angle>, <stops>)\` (or \`to right\`…), \`radial-gradient(<rx> <ry>
  at <x> <y>, <stops>)\` and \`conic-gradient(from <angle> at <x> <y>, <stops>)\`, a stop a colour or a token
  (\`var(--brand) 0%\`) and its place in percent; a text's colour and borders take colours and tokens only. Figma's
  diamond gradient and repeating gradients stay read-only.
- \`mix-blend-mode\` sets how a layer blends (multiply, screen, overlay…; normal is Figma's pass through on a frame);
  \`mask="alpha"\` (or vector, luminance) makes a layer the mask of the layers above it in its parent, \`mask="none"\`
  makes it a layer again.
- Not written yet, and refused with an error: grow weights, \`overflow: scroll\`, links on frames, dashed underlines.

## Errors and undo

\`nodes_delete\` deletes layers by id (not those inside an instance: hide them with \`display="none"\`; what an
instance's slot holds is its own and is deleted).

Each element is written on its own: an error names its line and attribute, and the rest of the XML still goes in.
The XML may hold several top-level elements; a \`<Root>\` wrapped around them is left out.
\`created\` lists the new layers' ids and names by line, \`changed\` the layers written to (inside a copy or a new
instance, by their ids there); a dry run lists the same, the new layers without ids or names (and no layers inside
a copy, which do not exist yet), as what it would do. One call is one undo step in Figma:
the user's Cmd+Z takes the whole call back.

Effects CSS cannot write (noise, texture, glass, hidden effects) stay when a layer's \`box-shadow\` or \`filter\`
changes, and a shadow sent back as it was keeps its colour variable and blend mode. \`effects_apply\` puts Figma's own
noise, texture and glass on layers: a ready look (grain, film, risograph, frosted or clear glass) or its own values.

## Beyond the XML: execute

\`execute\` runs JavaScript in the plugin for what design_apply and tokens_apply cannot say (removing a variable,
a prototype link, a plugin data field). The code is the body of an async function given \`figma\` (the Plugin API),
\`console\` and \`pw\`: \`await\` works, \`return\` gives \`result\` (Figma's layers as {id, type, name}, plain data as
built), \`console.log\` lines come back as \`logs\`, and what it throws as \`error\`. What it changes during the call is
one undo step, and \`version\` saves a named version in the file's history first; it needs Allow edits. The tool
waits 10 s by default and up to 300 s (\`timeout\`) for a long task. Code it starts that outlives the call (timers,
listeners, work past the timeout) keeps running until the plugin window is closed, Allow edits or not; an endless loop,
synchronous or of awaits, freezes Figma until then. Read the result back with the read tools.

The plugin runs with documentAccess "dynamic-page": the synchronous lookups throw, so use the Async calls
(\`getNodeByIdAsync\`, \`getMainComponentAsync\`, \`getLocalPaintStylesAsync\`, \`setFillStyleIdAsync\`…), and
\`await page.loadAsync()\` before reading another page. \`figma.skipInvisibleInstanceChildren\` is true: \`findAll\`,
\`findOne\` and \`children\` skip hidden layers inside instances, and \`getNodeByIdAsync\` gives null for them; set it
to false in the code to reach them (execute sets it back after the call). An error names the line and column in
the code it came from.

A long script goes in a file on the server's disk, passed as \`script\` instead of \`code\` (an absolute path, or one
from the server's folder): it is read at every call, so the file as it is now runs, after a plugin restart too.

\`pw\` stays from one call to the next while the plugin window is open:

- \`pw.state\` holds your data, and functions you add to \`pw\` stay for later calls, as they were when added: after
  a change to their script, run the script again;
- \`await pw.node(id)\`: the layer, or an error naming the id;
- \`await pw.fonts(layer)\`: loads every font the texts in the layer use, mixed runs too, before you change their
  characters or sizes; it returns their names;
- \`pw.paint(css)\`: a CSS colour as a solid paint in the file's colours, its alpha as the opacity;
- \`await pw.variable("--token")\`: the variable design_read names so, a library's imported into the file.

\`\`\`js
const card = await pw.node("54:243");
await pw.fonts(card);
for (const text of card.findAllWithCriteria({ types: ["TEXT"] })) text.textCase = "UPPER";
card.fills = [figma.variables.setBoundVariableForPaint(pw.paint("#FFF"), "color", await pw.variable("--color-surface"))];
pw.state.card = card.id;
\`\`\`
`,
} as const;

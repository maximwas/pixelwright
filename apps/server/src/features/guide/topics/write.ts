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
- **A copy:** \`<Frame copyOf="54:268" name="Card 2">\` clones that layer (everything the XML cannot show comes
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
} as const;

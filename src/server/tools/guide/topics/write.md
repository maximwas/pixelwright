# Writing with design_apply

`design_apply` writes the XML `design_read` returns back into Figma, in the same dialect (`guide xml`); `guide layout`
says how it lays out a frame's children. `nodes_delete` deletes layers and `version_save` saves a named version.
The plugin's **Allow edits** switch, which the user turns on in the plugin window, gates every write: while it is
off, a write is refused. `dryRun: true` runs the same checks in the plugin without writing, with the switch on or
off, and lists what the call would create and change, and every refusal. `version: "<name>"` saves a named version in
the file's history first, when the user wants to be able to go back (not in a dry run, nor when nothing would
change); when it cannot be saved, nothing is written.

## Changing a layer

- An element with `id` changes that layer, and only the attributes it gives: `<Frame id="54:243" gap="48px"/>`
  changes the gap and nothing else. Read the layer first, edit the XML, send back what you changed. What a layer
  already has is not written again, so a read sent back unchanged changes nothing.
- An attribute left out stays as it is. To remove one, write the value that means none: `background="none"`,
  `border="none"`, `box-shadow="none"`, `width="auto"` (hug), `max-width="none"`, `flex="none"`, `left="auto"`,
  `transform="none"`, `display="block"` (no auto layout), `display="none"` (hide). A hidden layer shows again with
  the `display` it is laid out with: `flex`, `grid` or `block`.
- A text: `<Text id="…">New words</Text>` replaces the characters, and they keep the look of the text's longest run;
  a `<Span>` (HTML's `<span>` too) styles a run of them. A Text without content keeps its characters, so
  `<Text id="…" color="var(--Dark)"/>` only recolours it. CSS on the Text restyles the runs that had the text's own
  look, as CSS inherits; its Spans then set theirs. A text inside an instance changes by its `I…;…` id; when the
  instance binds its characters to a text property, the new characters go to that property.
- What Figma keeps together is completed from the layer: a new `column-gap` keeps its direction and wrap, a new
  `filter` keeps its shadows, a new `border-bottom` or `padding-top` keeps the other sides, a new `width` keeps the
  edge the layer is pinned to. A new `left` or `right` replaces both edges.
- Moving: an element with `id` under another parent element moves the layer there, `before="id"` / `after="id"`
  puts it next to that layer, and listing layers in another order reorders them. A top-level element moves only by
  `before` or `after`. A layer inside an instance comes from its component and stays where it is (an instance takes
  new layers only through its slots). An element alone (`<Frame id="…"/>`) moves its layer with everything inside it.
- design_apply first reads every layer the call names, with everything inside it. Send only the layers you change,
  nested as design_read writes them (a deep one may also stand alone at the top level:
  `<Text id="54:250">New words</Text>`); a call that names more layers than one read can take fails with an error:
  split it.
- A text design_read shortened (`$truncated`) keeps its characters: read that layer on its own to change them.
- Each tag takes its own attributes: no `background` or `gap` on a Text (its colour is `color`), no text styles on a
  Frame, no auto layout on a shape; an element's id is given once (a copy has none).

## Creating

- An element without `id` creates a layer: `Frame`, `Section`, `Text`, `TextPath` (below), `Rectangle`, `Ellipse`,
  `Line`, `Image`, `Icon`, and `Component`, `ComponentSet`, `Instance` and `Slot` (below). It goes inside its parent
  element, after the element before it (alone: last); at the top level into `parent` or the current page beside its
  layers, next to a layer with `before="id"` / `after="id"`, or onto a page (below). Groups and vectors come from an
  SVG, as an `Icon`.
- **A page:** a top-level `<Page name="Screens">…</Page>` makes a new page, last in the file, and creates the layers
  inside it there in the XML's order, each placed by its `left` and `top` (without them, beside the ones before it);
  a layer named by its id inside it moves onto the new page. A dry run lists the page it would make.
  `<Page id="…">` (an id from `file_map`) is a page the file has: `name` renames it, the layers inside it are written
  where they are, new ones go on it. A page takes only a name, stands only at the top level, and stays where it is
  in the file. Figma's Starter plan allows 3 pages: past that the error names the limit, and nothing inside that page
  is made.
- A new layer has what its XML says and nothing more: no fill without `background`, no clipping without `overflow`;
  a new auto layout frame hugs unless sized; a new text is Inter Regular in black unless `font` and `color` say
  otherwise.
- **A copy:** `<Frame copyOf="54:268" name="Card 2">` clones that layer (everything the XML cannot show comes along)
  and then writes the element onto the copy. Inside it, elements with the source's ids write the copy's layers, and
  `before`/`after` with a source's id put a layer next to the copy's: copy a card's XML, drop the root's id, add
  `copyOf`, change the title, add a new layer in the same call.

## Components and instances

- `<Instance component="Heading" variant="Property 1=Green" props="Label=Our work, Has icon=false"/>` makes an
  instance by the names design_read and components_read write: the file's components, the ones its page uses from a
  library, or `component="key:<key>"` for a library one the file does not use yet (`library_search` finds those keys
  in the libraries saved with it). `variant` picks the variant (values left out are the set's default), `props` sets
  its properties by their names without Figma's #id: a text, `true` or `false` for a boolean, and for an instance
  swap the component to show, by the name a `component` takes (a set's name shows its default variant) or
  `key:<key>` (`props="Icon=Heart"`).
- Inside a new instance, elements with another instance's ids (of the same component and variant) or the
  component's own write the new instance's layers, as overrides; the other instance stays as it is.
  `<Instance copyOf="id">` copies an instance with its overrides instead.
- An existing instance: `variant` switches it, `props` changes its properties, `component` swaps it to another
  component. A comma or `=` inside a name or value is escaped with a backslash, as design_read writes it. A switch or
  a swap gives the instance's layers new ids, so a call that switches an instance (or a copy, or one nested in a new
  instance) refuses edits of its layers by their old ids: switch first, read it again, then edit.
- `<Component name="Badge">…</Component>` makes a component like a frame; inside it, `prop="Label"` on a Text makes
  a text property bound to it, `visibleProp="Shown"` a boolean property bound to the layer's visibility, and
  `swapProp="Icon"` on an Instance an instance swap property whose default is that instance's component (instances
  then take `props="Icon=Heart"`). `<ComponentSet name="Badge">` holds `<Component variant="Tone=Dark">` variants:
  they are combined into one set (the properties defined once on it) and laid out in a grid; a set given
  `display="flex"` or `"grid"` lays them out itself, each variant placed by its own `grid-row`/`grid-column`,
  `align-self` or `flex`. `description` describes a component or a set; an instance of a new component can follow
  later in the same XML.
- An existing component takes properties the same way, so it is extended where it is: `prop`, `visibleProp` and
  `swapProp` on its layers by their ids (`<Instance id="54:12" swapProp="Icon"/>`), or on new layers inside its
  `<Component id="…">`, bind each layer to the property of that name the component has (a variant's: its set's), or
  add the property once when it has none, its default the layer's value now (the text, whether it shows, the
  instance's component). A name a property of another kind holds is an error; a layer no component holds, or one
  inside an instance, is refused. `properties` in the answer lists what was added to components there before the
  call (a dry run's: what would be).
- `<Slot name="Content">` makes a slot directly inside a component; in an instance, give its `<Slot id="…">` new
  layers.

## Images, icons and notes

- `<Image src="photos/hero.jpg" width="600px" height="400px"/>` makes an image from a file (PNG, JPG or GIF, up to
  32 MB and 4096 px a side; convert WebP first), `<Icon src="icons/arrow.svg" width="24px"/>` an icon from an SVG
  (up to 2 MB); `background="url(…)"` fills any layer that takes a background with one, a new or an existing frame,
  rectangle or ellipse (an avatar). Paths are on the server's machine; a relative one starts in the project folder
  (the MCP client's root, else `CLAUDE_PROJECT_DIR`, else the server's working directory).
- An existing `Image` with another file in `src` takes that image, keeping how it fits and is cropped. A file
  design_read or assets_export wrote for that layer (a render of it) changes nothing wherever it went, so a read sent
  back keeps the originals; a picture saved over it is a new image. An existing icon keeps its drawing: to draw
  another, delete the icon and create a new one from the file.
- An `Icon`'s `width` or `height`, new or existing, scales it whole as Figma's scale tool does: its lines and corners
  grow with it (a 24px icon with a 2px line at 48px has a 4px line). The drawing keeps its ratio: the width decides
  when both are given, else the height. The size is the one design_read writes (what the icon draws past its box
  included); a `Frame` with the same id only resizes, its lines staying as they are.
- `note="Behavior: opens the modal | Spacing: 8px"` writes the layer's Dev Mode notes, the whole list, as design_read
  writes it (`note=""` removes them). `Behavior: ` files a note under the file's annotation category of that name; a
  name the file has no category for stays part of the text (no category is made). A `|` with a space on each side
  separates the layer's own notes sent back and comes before a note a category starts; elsewhere it is text, so
  `note="Tabs: Days | Weeks"` is one note (two new notes without a category take two calls). A note sent back as it
  was keeps its category, formatting and pinned properties; notes without text, which design_read does not show,
  stay.

## Text on a path

- `<TextPath id="…">New words</TextPath>` changes the characters of a text on a path and keeps its look, as a Text's
  do; its spans and text CSS (`font`, `letter-spacing`, `text-transform`, `color`, `textStyle`) are written as on a
  Text. It has no line height, underline, wrapping or truncation. `start="1 0.25"` moves where its text begins: the
  path's segment (from 0) and the place along it (0 to 1). Its path stays as Figma made it: a changed `d` is refused,
  so delete the layer and make it again. The characters go in the TextPath itself, as its content.
- A new one is made along `d`, an SVG path in its own box that `left` and `top` place (relative commands and arcs are
  taken, and written as Figma's lines and curves), or along `arc="<cx> <cy> <r> <from> <to>"`, an arc of a circle in
  the parent: its centre and radius in px, its ends in degrees as CSS turns (0 at the top, clockwise). An arc places
  the layer itself, absolutely, so it takes no `left` or `top`. A `to` smaller than `from` runs back,
  counter-clockwise: below the centre, `arc="200 200 160 225 135"` runs left to right.
- `text-align` is anchored at `start`: `left` begins there, `center` centres the text on it, `right` ends it there,
  and letters that would fall before the path's beginning are not drawn. So `text-align="center"` or `"right"` given
  without `start` also puts the start in the middle of the path (by length) or at its end, on a new one or an
  existing one; give `start` with it to anchor the text elsewhere.

```xml
<Frame id="12:30" name="Round menu">
  <TextPath id="12:41" start="0 0.25">Share</TextPath>
  <TextPath name="Label" arc="200 200 160 -40 40" font="500 14px 'Inter'" color="var(--color-ink)">Settings</TextPath>
</Frame>
```

## Values

- Lengths in px: a bare number in a size, a place, a gap, a padding or a radius is taken as px; a bare line height is
  a multiple of the font size, as in CSS. Sizes, edges and centring: `guide layout`.
- `font` is the shorthand `[italic] weight size/line-height 'Family'`. The family is found in any case, the weight is
  the nearest one within 50, the plain style before the others; a family this Figma lacks is refused with the near
  ones ("Did you mean Inter?"), on a dry run too. A text whose font this Figma cannot load keeps its characters until
  it gets a font this Figma has.
- Colours: hex, `rgb()`, `hsl()` or `color(display-p3 …)`. In a Display P3 file, `color(display-p3 …)` (as
  design_read writes it) is written as it is, and hex, `rgb()` or `hsl()` are taken as sRGB and converted to P3.
- `var(--Name)` binds the token of that name, as design_read and tokens_read write it: a colour variable or a paint
  style on `background`, `color`, a border or a shadow's colour, inset and in `text-shadow` too
  (`box-shadow="0 4px 12px 0 var(--shadow)"`); an effect style on `box-shadow`, `filter` or `backdrop-filter`
  (`backdrop-filter="var(--Blur-Backdrop)"`), which is then the layer's whole list of effects. `textStyle="h3"`
  applies a text style. A shadow's colour variable is its whole colour, its alpha too: write it alone, or a colour.
  A number variable binds a size, a min or max size, a gap, a padding side or a radius (`gap="var(--space-md)"`); a
  number over a bound one takes the variable off. A section is sized in px only.
- design_apply binds the tokens the file and the libraries it uses have: tokens_read lists them. A `var()` that names
  none is refused with the near names; a token the design lacks is the designer's to make in Figma.
- `data-<collection>="<mode>"` sets the layer's mode of that variable collection (by name or slug, as design_read
  writes it), and `""` clears it.
- Gradients: `background` takes `linear-gradient(<angle>, <stops>)` (or `to right`…), `radial-gradient(<rx> <ry> at
  <x> <y>, <stops>)` and `conic-gradient(from <angle> at <x> <y>, <stops>)`, a stop a colour or a token
  (`var(--brand) 0%`) and its place in percent. A text's colour and borders take colours and tokens; a repeating
  gradient is refused.
- `filter="blur(8.6px)"` and `backdrop-filter="blur(…)"` are written as Figma's radius v / 0.43, the rule design_read
  reads them by (`guide xml`).
- `mix-blend-mode` sets how a layer blends (multiply, screen, overlay…; `normal` is Figma's pass through on a frame);
  `mask="alpha"` (or vector, luminance) makes a layer the mask of the layers above it in its parent, `mask="none"`
  makes it a layer again. `href` links a Text or a Span.
- Refused with an error: `overflow: scroll` (scrolling is a prototype setting), links on frames, dashed underlines
  (grow weights: `guide layout`). Read but not written yet, listed in an element's `notWritten`:
  `background-blend-mode`, `-webkit-text-stroke`, `paint-order`.

## Errors and undo

`nodes_delete` deletes up to 500 layers by id, each on its own: a layer inside an instance comes from its component
and stays, with why (hide it with `display="none"`); what an instance's slot holds is its own and is deleted. It takes
`dryRun` and `version` as design_apply does.

The XML is strict: an unclosed or wrongly closed tag, a duplicate attribute, a bare `&` or a `<` in a value refuses
the whole call as `INVALID_XML`, with its line and column. HTML entities like `&mdash;` are read, CDATA is text as
written, and names may hold `$` (`$css`).

Each element is written on its own: an error names its line, column and attribute, and the rest of the XML still
goes in; the layers inside a refused element are not made. The XML may hold several top-level elements; a bare
`<Root>` wrapped around them is left out. `created` lists the new layers' ids and names by line, `changed` the layers
written to (inside a copy or a new instance, by their ids there); a dry run lists the same as what it would do, its
new layers without ids or names. One call is one undo step in Figma: the user's Cmd+Z takes the whole call back.

Effects CSS cannot write (noise, texture, glass, hidden effects) stay when a layer's `box-shadow` or `filter`
changes, and a shadow sent back as it was keeps its colour variable and blend mode.

A change the XML cannot say (removing a variable, a prototype link, a plugin data field) is `execute`'s plugin code,
the last resort: it needs Allow edits too, has no dry run, and is one undo step.

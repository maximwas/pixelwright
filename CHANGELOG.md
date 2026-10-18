# Changelog

Every release of Pixelwright, newest first: the version, the day it was released, and what changed for the people who
use it. The npm package `pixelwright` and the Figma plugin share one version.

<!--
How to write this file (people and agents alike):

- One section per released version, newest first: `## <version> — <YYYY-MM-DD>`, the date the tag was pushed. The
  release workflow refuses a tag without its section here, and the section becomes the GitHub release's notes.
- Changes waiting for a release go under `## Unreleased` at the top. At release time rename it to the version and date.
  The website leaves Unreleased out.
- Inside a section, the groups that apply, in this order: `### Added`, `### Changed`, `### Fixed`, `### Removed`.
- One bullet per change, as the user meets it: what they can do now or what works now. Present tense, plain English,
  tool names in backticks (`design_read`). No file paths, commit hashes or internal names.
- After editing, run `pnpm build:docs` to rewrite the website's page (docs/changelog/index.html).
-->

## Unreleased

### Fixed

- `tokens_apply` with `dryRun` no longer promises a mode the file's Figma plan refuses: once Figma has refused a
  mode in that file, a dry run refuses the same, and before that it warns when a collection would have more modes than
  any collection the file already has (a Starter plan allows one).
- `design_apply` with `dryRun` lists the layers it would create (without ids) and the layers it would change, as the
  write does.
- `design_lint` no longer flags layers a clipping frame cuts on purpose, such as a ticker's or a carousel's cards;
  only a text cut off that way is flagged.

## 0.4.0 — 2026-10-18

### Added

- `effects_apply` puts Figma's own noise, texture and glass on layers: a ready look (grain, film, risograph,
  frosted glass, clear glass) or the effect's own values; a new effect replaces the layer's one of its type, shadows
  and blurs stay, and `remove` takes them off.
- `design_lint` checks a layer, a page or the whole file against the rules a design should keep before it is
  built: text contrast below WCAG AA, colours, texts and effects bound to no token or style, frames detached from
  components, stacks placed by hand, layers reaching past their parent's flow, grid cell or clip, touch targets under
  24 or 44 px, interactive components without hover, focus or disabled states, raw values a token holds, spacing off
  the 4 px grid, instance overrides of a component's look, default names, hidden and empty leftovers. Each finding
  names its layer and how to fix it.
- `a11y_read` says what a screen's markup needs for accessibility: heading levels (from text style names or sizes),
  controls with their roles and the labels a screen reader says (an aria-label suggested for an icon-only control, a
  field's label found beside it), pictures with an alt from their names, controls nested in controls, and layers
  placed by hand that read in another order than they show.
- `states_find` lists the states interactive components are drawn in (hover, focus, pressed, disabled; error for a
  field, selected for a toggle or tab) and the ones they lack, and the empty, loading, error or success frames a
  list's or a form's screens lack.
- `tokens_bind` binds raw colours, gaps, padding, radii, border widths, opacity, texts and shadows to the variables
  and styles that hold them exactly, in each layer's mode and within the variables' scopes. A value several tokens
  hold is listed with its candidates for a pick, a value none holds is listed for `tokens_apply`, `choose` snaps a
  near value to a token, and `remap` moves every use of one token to another.
- `instances_reattach` puts frames detached from a component back as instances of it, where they stood and at
  their size, with their texts, images and hidden layers carried over; `swap` makes instances of one component
  instances of another (a set's variant with the same values), and `reset` takes instances' overrides off, their
  look only or all of them.
- `design_read` writes gradients as CSS (`linear-gradient`, `radial-gradient`, `conic-gradient`, as Figma's own CSS
  gives them), and `design_apply` paints them back from the same CSS, a stop's token bound to its colour variable;
  `tokens_apply` writes gradient paint styles. `mix-blend-mode` and `mask="alpha|vector|luminance|none"` are read and
  written too.
- `texts_replace` finds and replaces text under a layer, a page or the whole file: one pair or a list (copy edits,
  a translation), plain or a regular expression with groups, whole words when asked, all pairs at once against the
  text as it was. Each match is replaced where it stands, so its run keeps its font, colour and link, and a text an
  instance shows from a component property changes through the property.
- `design_read` writes a variable mode set on a layer as `data-<collection>="<mode>"` (`data-color-modes="dark"`),
  the selector `tokens_read`'s CSS uses, so a dark section reads as dark and the build sets the same attribute; a
  frame read alone also carries the mode it takes from the page or frame above. `design_apply` sets a layer's mode
  the same way, and `data-<collection>=""` clears it.
- `guide layout` tells when to lay a frame out as flex, as grid or by absolute placement, with the grid's tracks,
  spans and cells, pinned and centred layers, what is not supported, and examples checked in Figma.
- `icons_insert` finds icons in Iconify's open sets (Lucide, Material Symbols, Tabler, Phosphor and more; no key)
  and inserts one as an Icon layer at a size, into a frame, in a colour or bound to a colour token; a search lists
  icons with each set's licence and writes nothing.
- `execute` gives the code `pw`, which stays from one call to the next while the plugin window is open: `pw.state`
  for your data and your own functions, and helpers for a layer by id, the fonts its texts use loaded, a CSS colour
  as a paint and a variable by its CSS name. `version` saves a named version first, and `timeout` waits up to five
  minutes for a long task.
- `image_compare` compares a layer `against` another layer, rendered the same way, with no PNG on disk: a variant
  against its default, a rebuilt frame against the original.
- `styles_compare` checks a build's computed styles against the design, layer by layer: give each layer with what
  `getComputedStyle` returns for the element that draws it, and it lists every property that differs with both values
  and the token or text style behind it, and the properties the build's styles left out. Shorthands, tokens and text
  styles are spread out the way the browser computes them; sizes and places may be off by a pixel.
- `tokens_apply` sets a variable's `scopes`, the fields Figma's pickers offer it for (`["FONT_WEIGHT"]`, `[]` to
  hide it), and its `codeSyntax` on the web, Android and iOS; scopes a type cannot take are refused before anything
  is written. `tokens_read`'s JSON lists both, so tokens copied into another file keep them.
- `design_read` with `repeats: true` reads a list of alike items (features, cards, rows) once: the first stands for
  all, marked `$repeat="3"`, and `repeats` gives each item's own texts, files and variants as rows, so a long list
  costs a fraction of the read. With `nearby: 400` it also lists the designer's notes on the canvas around the screen
  (texts, stickies and small frames of text beside it or over it), nearest first.
- `library_search` finds components in your team's libraries from any file: save each library once from its own
  file, then search by words in any order (a typo still finds) and insert what it finds with `design_apply`.

### Changed

- `design_apply` reads a `rotate()` and a gradient's angles in any CSS angle unit (deg, grad, rad, turn), and lengths
  and percentages as the CSS tokenizer reads them, any case and sign.
- Pixelwright is open source under the MIT license, which was the license each version would have become two years
  after its release under FSL-1.1-MIT.
- `tokens_read`'s CSS gives the default mode of a collection with several modes a `[data-<collection>="<mode>"]`
  block too, so an element in the default mode inside another mode's element takes the default values back.

### Fixed

- `design_apply` makes an instance of a lone library component by `component="key:…"`, and gives up on a key Figma
  cannot import (an unpublished library) within 10 seconds, saying why, instead of waiting until the request timed out.
- `tokens_bind` and `design_lint` match a layer's opacity with the variables Figma's opacity fields take, kept as
  percents (50 for 0.5): an opacity variable of 50 was never offered, and a plain 0.5 one bound the layer at 0.5 %.
- `texts_replace` walks a page or the whole file within the plugin's time limit and says `more` when it stops,
  instead of reading every text first, which on a big file could outlast the request.
- `tokens_read` writes a number that font weights or opacities point at without px, as they read it (a hidden
  `weight/700` primitive is `700`, not `700px`), and a number shown as text too. `tokens_apply` keeps a new opacity
  as the percent Figma's opacity fields take (0.4 is stored as 40), and its `notes` say when a number written
  without a unit and given no scopes will read back in px.
- `design_read` and `design_apply` work while Figma Desktop has lost its connection: the file's own variables and
  styles are read from its lists, which Figma gives offline, instead of one by one, which Figma gives up on after ten
  seconds; a library's it cannot reach is left out. The same goes for every write that finds a token by id:
  `design_apply` binding a token, `tokens_apply`, `tokens_bind`, a text's look kept after new characters,
  `execute`'s `pw.variable`, and `tokens_read` and screenshots in modes.
- `changes_since` counts `effects_apply`'s writes as Pixelwright's, and the plugin window names them.
- A new frame laid out inside (a card) fills its grid cell with `justify-self`/`align-self="stretch"`: it used to
  hug its content.
- `design_read` writes a grid's child that fills its cell as `stretch`, apart from one that hugs, and a grid's padding.
- Changing a grid's columns leaves its rows alone: rows read earlier and sent back could delete one Figma had added
  for children that did not fit, which Figma refused.
- A grid's child moved to another cell narrows its span before it moves, so it no longer runs into a taken cell.
- `justify-content` and `align-items` on a grid, and `flex` on a grid's child, say what to write instead of passing
  Figma's raw error.

## 0.3.2 — 2026-10-17

### Added

- The plugin's window says when a newer Pixelwright is out, with links to what is new and to the steps to update.
  Closed, it stays closed until the next version. The server asks npm once a day; `PIXELWRIGHT_NO_UPDATE_CHECK=1`
  turns that off.

### Fixed

- `design_apply` answers `x` and `y` with `left` and `top`, and Figma's own names (`fill`, `stroke`, `rotation`,
  `corner-radius`) with the CSS that writes them, where it used to suggest the nearest spelling (`id`).
- `design_apply` takes a bare number as px in sizes, places, gaps, paddings and radii (`width="363"`).
- A new text that fills its row (`flex="1"`, `align-self="stretch"`) takes the row's width: it used to stay 0 wide,
  a letter a line.
- `border-top` and the other single sides draw on a new frame: the line used to come out 0 px wide.
- `src` on a shape or a frame now points to `background="url(…)"`, which fills any layer with a picture, an existing
  ellipse too; the hint used to speak of frames only.
- `screenshot` with a `clip` on a layer too big to render whole renders the smallest opaque layer that holds the
  region alone, such as a page's section, and cuts it there; it used to fail with `RESULT_TOO_LARGE`.
- A colour variable with transparency (a hairline at 14%) reads as the token alone, where `design_read` wrote
  `color-mix(… 14%, transparent)` on top of the variable's own alpha; `design_apply` writes `color-mix()` over such a
  variable at the opacity it says (Figma had replaced it with the variable's alpha), and a bound paint takes the
  variable's colour rather than a black placeholder where Figma does not resolve it.
- `tokens_apply` says a mode past the file's Figma plan limit in plain words (how many modes the plan allows, which
  mode is left out) instead of Figma's raw error.

## 0.3.1 — 2026-10-15

### Added

- The website links the Orbit demo file in Figma, a small pricing site to try every tool on.

### Fixed

- The npm page's homepage is the website, not the GitHub readme.

## 0.3.0 — 2026-10-15

### Added

- `design_read` shows what an instance changed outside its component's properties (`$override`: a rewritten text, a
  recoloured icon), so the code knows which instances need a new property, a variant or a one-off.
- `outline`, `file_map` and `design_read` show what the designer marked ready for dev (or completed) in Dev Mode.
- `design_read` names the token Figma itself matches a raw spacing, radius, stroke or opacity to.
- `design_apply` and `tokens_apply` take a `version`: a named version is saved in Figma's history before they change
  anything, for the designer to go back to.
- `pixelwright logs` follows the logs of every running Pixelwright server on the computer in real time: tool calls,
  plugins connecting, errors. The bug report form asks for its output.
- `design_read` keeps a list's item spacing, a line's round or square ends and a frame's grid style.
- `baseline_save` keeps a screen or section as your code was built from it, in the project beside the code
  (`.pixelwright/baselines/`), with the files you built from it. Nothing is written to Figma.
- `baseline_diff` tells what the designer changed since then, in `design_read`'s terms: layers changed, added (with
  their XML), removed, hidden, moved or reordered; a change made in a component, once, with the instances it reached;
  token values in every mode; icons and images to export again. It sees edits made while the plugin was closed, library
  updates and variable values. Without a name it checks every baseline in the project. Accept what you built with
  `baseline_save` and the `accept` the diff gives.
- `version_save` saves a named version in Figma's history when you ask for one, so the designer can open the design
  your code was built from; the baselines it names remember it. It needs edit access and Allow edits.
- `components_read` tells which of the project's components builds each Figma component, from its Code Connect files,
  with the code's file. `mapped: false` lists only the components still without code, with the key a new mapping
  needs.
- Code Connect batch files (`*.figma.batch.json`, Figma's own format) connect many components through one shared
  template, one row each. The guide gives a ready template whose rows map Figma properties to code props, so a
  component needs no template of its own.
- A Code Connect template (`// key=`) or batch row (`"key"`) can name the component's key. It then connects exactly
  that component in every file, a library's included, whatever it is called there.
- `components_read` lists the nested instances a component exposes, with their properties: in code they are the
  component's own props. `design_read` marks them `$exposed`.
- `design_read` and `code_connect_read` name the properties an instance's code never reads (`unread`), and
  `code_connect_read` names the variant values a template's mapping misses (`values`), so no value is lost to a
  snippet.
- `components_read` with `links: true` gives the links people attached to components in Dev Mode, with the project file
  a code link points at, on Figma plans that have them.

### Changed

- Every easing is valid CSS: `tokens_read`, the prototype interactions `design_read` shows and Figma Motion write a
  keyword or `cubic-bezier()`, and a spring as `linear()` drawn from the spring itself (it used to be `ease` or a word).
- In a Display P3 file, colours are written as `color(display-p3 …)` by `design_read`, `tokens_read` (in CSS and in
  DTCG files) and the checks, and colours written to it are converted to P3: they show as the designer chose them.
- A version saved before a `design_apply` or `tokens_apply` write says in Figma that Pixelwright saved it, and waits a
  moment so Pixelwright's previous change is in it.
- `code_connect_read` and `design_read` give each Code Connect file's `source` and say when that file no longer exists.
  `code_connect_read` says how each file matched (by key, by the component's link, or by name), and gives the id and
  key of each component none connects.
- `design_read` names the components it shows that have no code yet, when the project has Code Connect files.

### Fixed

- `design_apply` writes a text of only no-break or em spaces as it is written, and a plain space typed between two
  styled parts of a text as one space: it used to add a space to both.
- In a Display P3 file, `design_read`'s own XML sent back to `design_apply` no longer changes a name or a note that
  holds a word like `#FFF`.
- `design_read`'s hints no longer take a text's own words, or a colour in a layer's name, note or link, for CSS that
  should use a token.
- `design_apply` and `tokens_apply` save their version, check and write in the file the call started on, even when
  another Figma file comes to the front while they run.
- `inspect`, `measure`, `contrast_check`, `design_audit` and `fonts_check` read the selection and then the layers from
  the same file, even when another Figma file comes to the front between the two.
- `design_apply` no longer writes a new layer into the original when a mistyped tag inside a copy or a new instance
  holds it: the new layer is refused, and the copy's own layers named there are still written.
- `design_apply` reads the layers named by id inside an element it does not create, or inside a `<Span>` outside a
  text, instead of dropping them, and says so when a `<Span>` inside a `<Span>` sets something (runs do not nest).
- `design_apply` says when the XML holds no element, instead of answering as if it had written something.
- `design_apply` changes layers of every Figma type `design_read` writes by their id (widgets, stickies, connectors,
  slides…), instead of refusing their tags: each takes what Figma gives its type (a sticky's fill and opacity, a
  connector's stroke, a stamp's size), and the rest is refused in plain words.
- `design_apply` says when an existing `<Icon>` names another SVG instead of ignoring it: an icon cannot be redrawn in
  place, so delete it and create it again from the file.
- `design_read`'s XML sent back to `design_apply` no longer reports its own image and icon files as missing when
  several layers share a name and the read numbered their files (`photo-2.png`).
- `design_apply` writes a background's new image: a `url()` naming another file, or another fit, was reported as
  changed but left the old image in place.
- `design_apply` refuses a dashed underline without writing a solid one in its place, and gives one error, not two,
  for a link on a frame.
- `design_apply` places a new component set made on the page beside the page's layers, as it places any new layer,
  instead of on top of them at the page's corner.
- A `design_apply` dry run refuses what the real run refuses for a layer's type (a description on a frame, a dashed
  underline, a fill on a group) and a paint style inside a list of paints, and a property with several unknown tokens
  gives one error, not one per token.
- An attribute `design_apply` cannot write leaves its layer as it was: a padding, corner radius or size with an
  unknown token, or a border per side on a layer without one, no longer writes half of itself, and what a call writes
  is always one undo step.
- `pixelwright logs` keeps showing every server's lines: the shared log is set aside by whichever server writes past
  its size, at any time, and a server whose log another one set aside writes to the new file instead of the old one.
  Two servers starting at once no longer leave one of them logging to stderr alone.
- The log names a tool call the client cancelled, instead of keeping it as waiting for an answer forever.
- The plugin counts a piece of an image file sent to it twice only once, so `design_apply` never takes a file with a
  missing part as whole; a piece past the end of a file gets a clear error instead of a bare `RangeError`.
- The plugin window names a saved version in plain words, not its internal operation name.
- `code_connect_read` no longer counts the instances inside a connected instance as unconnected.
- `nodes_diff` no longer calls an icon or image drawn anew when only its notes, link, prototype or animation differ.
- `screenshot` says a bad `save` path before it looks for the file to shoot, so that error comes first.
- The shared log keeps being written when its folder is deleted while servers run, and a full log that cannot be set
  aside is written on instead of being tried again on every line.
- A Code Connect template's `findInstance`, `findText` and `findLayers` take `null` options as none.
- `design_apply` refuses a corner radius on a `<Line>`, which has none, before anything is written, and says it has no
  properties when `props` is given to a layer that is no instance, instead of counting that as a write.
- `design_apply` places an error for text outside a `<Text>` where its words start, not at the end of the line before.
- The Orbit example names its code component as Figma's Code Connect defines it (`component=PlanCard`) and passes the
  card's description.

## 0.2.0 — 2026-10-14

### Added

- `tokens_read` writes Design Tokens Format (DTCG) files: one per mode of each collection, and one for the styles,
  ready for Style Dictionary and other DTCG tools.
- `design_read` shows the properties a designer pinned in a Dev Mode annotation (`$pins`), and gives the Dev Mode
  measurements between layers in pixels.
- `design_read` reads Figma Motion: each animated layer gets a short `$motion` summary, and the read gives the animation
  as CSS `@keyframes` placed over the timeline.

### Changed

- The plugin and the server speak a new version of their connection: run `npx -y pixelwright@latest` so both update
  together. An older server tells a newer plugin to update instead of failing on its reads.

### Fixed

- A component with a slot, and its instances, read again in `design_read` and `components_read`.

## 0.1.1 — 2026-10-13

### Added

- A changelog: every release with its date and what changed, in CHANGELOG.md and on the website.
- Feedback has a home: GitHub Discussions for questions, ideas and what you built, and issue forms for bugs and feature
  requests. The plugin window, the READMEs and the website link there.
- A Code Connect example for a button and a pricing card, the card showing its button through the button's own
  template.

### Changed

- Pixelwright's licence is FSL-1.1-MIT: use it for anything, at work and for clients, and change it for your own use,
  but not to build a competing product or service. Each version becomes MIT two years after its release.
- The plugin stays a development plugin you import once from its manifest (`npx -y pixelwright@latest` puts it in
  place and keeps it current): Figma does not list plugins that overlap its own MCP server on the Community.
- The README, the guide and the examples read Orbit, a demo pricing page made for Pixelwright, instead of a
  third-party design.

### Fixed

- A text in a variable font (Inter, for one) no longer carries `font-variation-settings` for axes a browser draws
  anyway: upright, normal width, optical size at the text's size.
- The hint about layers left with Figma's default names reads right for a single layer.

## 0.1.0 — 2026-10-13

The first release: an MCP server and a Figma plugin that let AI agents (Claude Code, Cursor, Codex and other MCP
clients) read and edit the Figma file you have open, through the Plugin API: no token, no API rate limits, any plan.
Withdrawn from npm the same day in favour of 0.1.1.

### Added

- `npx -y pixelwright@latest` sets up Claude Code and Cursor, shows what to paste for other clients, and puts the
  plugin in place. The plugin pairs with the server once, with a code.
- Reading: `design_read` gives a section as XML with CSS, tokens as `var(--Name)` and assets as files; `inspect` and
  `measure` give layers as Figma has them; `outline`, `file_map` and `nodes_find` find your way around a file.
- Comparing and checking: `nodes_diff`, `variants_read` and `breakpoints_find` show how layers, states and screen
  sizes differ; `screenshot` and `image_compare` hold your build against the design; `design_audit`,
  `contrast_check` and `fonts_check` check the scale, contrast and fonts.
- Tokens and components: `tokens_read` (CSS or JSON, every mode), `tokens_usage`, `components_read`, and
  `code_connect_read` with your Figma Code Connect templates, run locally on any plan.
- Prototype, selection and changes: `flow_read`, `selection_get`, `selection_wait`, `viewport_get`, `node_show`
  and `changes_since`.
- Writing, when you switch on Allow edits in the plugin: `design_apply` writes the same XML back (new layers,
  instances, components and variants, images), `tokens_apply` writes variables and styles, `nodes_delete` and
  `execute`. Each write is one undo step.
- Several files and several MCP clients at once, sharing one bridge.

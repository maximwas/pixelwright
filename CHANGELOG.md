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
- `design_apply` takes the tags of every Figma type `design_read` writes (widgets, stickies, connectors, slides…) and
  changes those layers by their id, instead of refusing their tags; the paints of FigJam and Slides layers are not
  written yet.
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
- A `design_apply` dry run refuses a paint style inside a list of paints, as the real run does, and a property with
  several unknown tokens gives one error, not one per token.
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
- `screenshot` says a bad `save` path before it looks for the file to shoot, so that error comes first.
- The shared log keeps being written when its folder is deleted while servers run, and a full log that cannot be set
  aside is written on instead of being tried again on every line.
- A Code Connect template's `findInstance`, `findText` and `findLayers` take `null` options as none.
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

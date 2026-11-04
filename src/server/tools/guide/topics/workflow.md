# Pixelwright: how to work with a Figma file

Pixelwright reads the files open in Figma Desktop through its plugin; nothing goes through Figma's REST API. This
version reads only: no tool changes the file. Every tool that reads a file takes `file` (a session id from `status`,
or a file name); without it, the active file, except baseline_diff, which compares a baseline in the file it was
saved from.

1. **Connection.** `status` lists the connected files and which one is active. None connected: the user runs the
   Pixelwright plugin in Figma Desktop and keeps its window open (the first time, they type the pairing code `status`
   shows into the plugin window; never type or send it yourself).
2. **Find what to read.**
   - `file_map`: every page with its frames, sections and components, in one call: where to start in a big file.
   - `selection_get`: what the user selected ("this", "the selected one"). `selection_wait`: ask the user to select
     something, then wait for it. `viewport_get`: what the user is looking at, when "this" comes with no selection.
   - `outline`: the layer tree with boxes, x and y relative to the outlined layer; `node: "0:0"` lists the pages. A
     layer with `$children="N"` has more children than listed: outline it on its own. An instance names its
     `component` and `variant`, so repeated cards show without a read; `dev` marks what the designer handed over for
     development: build those first, not drafts.
   - `nodes_find`: layers by name, type, text, component or an instance's `variant` ("State=Hover, Size=L"), on the
     current page, inside a layer or across the file (`within: "file"`). `counts: true` counts every instance found
     by component and variant: which variants the layers use.
   - `node_show`: brings layers into view and selects them, so the user sees which you mean.
   - `changes_since`: what the designer changed since you last looked (a cursor), to read again only that.
3. **Read one section.** `design_read` returns the section as XML (`guide xml` explains every tag and attribute),
   then JSON with tokens, text styles, fonts, assets, hints and truncated, plus `measurements` (the designer's Dev
   Mode measurements, in px) when the section has them. Read sections, not whole pages: past `maxChars` (80 000) the
   deepest branches are left empty with `$truncated="true"` and their ids listed in `truncated`; read each on its own.
   Pass `assetsDir` (e.g. src/assets) to get its icons and images written as files (`guide assets`).
   `repeats: true` reads a list of alike items once (`$repeat`), with their data as rows: shorter, and the list's
   shape plain. `nearby: 400` adds the designer's notes on the canvas around the screen (texts and stickies beside
   it, nearest first): read them, they often say what the layers cannot (states, motion, copy to change).
4. **Look at it.** `screenshot` renders a layer to PNG (inline up to 2000 px a side, scaled down to fit; `save`
   writes a .png file full size; `clip` takes a region of it, in px from its box). Compare your build with it:
   `image_compare` renders a layer the same way and compares it with a PNG of your build, or with another layer
   (`against`): rmse, the share of pixels that differ, the box around them, edges off by N px; `diff` writes the
   difference as a PNG. `styles_compare` checks the build's computed styles (getComputedStyle) against each layer,
   property by property: the values that differ with the token or text style behind them, and the properties the
   build left out.
   **Measure it.** `inspect` reads layers as Figma has them, without code: the layout box and the painted box (a
   centred stroke, shadows and blur reach past it), the blend mode of the layer and of each fill, the fill with the
   style or variables behind it (what a `var()` resolves to) and every fill's type (a video's too), how strokes
   paint, every effect's parameters (a progressive blur's start and end), a text's lines and line heights, overflow,
   interactions with their transitions, a component's variant, and each layer's centre. Items set around a circle (a
   round menu, labels on a dial): `around` (the circle's id, or a point) gives each centre's distance from it and its
   angle as CSS `rotate()` turns, 0 at the top, clockwise. `measure` gives the distances between layers, each from
   the one before (gaps, aligned edges, insets).
   **Compare.** `nodes_diff` says how one layer differs from another (A/B screens, a card and its copy): the layers
   only one has, the attributes that differ, and icons whose drawing differs. `variants_read` gives a component's
   states as differences from its default (build :hover, :active, :disabled from them). `breakpoints_find` finds a
   screen at the page's other widths, for the media queries. `flow_read` maps the prototype: screens and the links
   between them.
5. **The design system.** `tokens_read`: variables with every mode (light, dark…) and styles, as CSS, JSON or DTCG
   token files (`guide tokens`). `tokens_usage`: the layers a token is used on. `components_read`: the components a
   page uses, or the file defines, with variants and properties. `library_search`: components of the team's
   libraries, saved once from each library file. `fonts_check`: the fonts used and where the build gets each (Google
   Fonts links).
6. **Files.** `assets_export`: several layers, or every asset inside one, as PNG, JPG, WebP, SVG or PDF, or the
   images as they were placed (`original: true`); `width` sizes a render by the CSS width the build shows it at (110
   at scale 2: 220 px). When a file gets another name than design_read planned (`planned`), use the path it gives.
7. **Keep the code in step with the design.** Right after the `design_read` you build a screen or section from,
   `baseline_save {node, name, code}` keeps it in the project (`.pixelwright/baselines/`: commit it to share, or leave
   it out of git, since it holds the design's texts). When a session starts, or the user says the design changed,
   `baseline_diff` says which baselines changed; with `name` it lists the changes in the XML's terms. Change only the
   code they name: export again what is marked `drawing`; build added layers from their `xml` (or `design_read` when
   it is left out). Then `baseline_save {name, accept}` with the `accept` the diff gave. `changes_since` stays the
   live view while the plugin is open.
8. **Code, the exception.** `execute` runs JavaScript in the plugin, for what no read tool shows: try the read tools
   first (`design_read`, `inspect`, `measure`, `nodes_find`), which need no code. It reads too: this version does not
   support editing. If the user explicitly asks for an edit through it, warn that editing is not supported or stable
   in this version and go on only when the user says so; the plugin's Allow edits switch still gates every write.

## Reading a design like a web developer

A design shows the look, not the build. `design_read`'s hints say where the two part; read them before you write
code.

1. **Workarounds.** Children placed absolutely inside an auto layout parent, empty layers that only make space, and
   texts broken into lines by hand are often how the design tool got the look: build a flow with that gap, use the
   parent's gap or padding, and let the text wrap in its width.
2. **Gaps and components.** Children spaced evenly in a frame without auto layout are a flex or grid with that gap.
   A structure built three times or more without a component (cards, rows, tabs) is one component with instances
   (`repeats: true` reads them once, their data as rows).
3. **Fixed sizes.** A text or content frame of fixed width narrower than its column fills it with a max-width; a
   frame of fixed height that clips its content grows with it, unless the build means to cut it.
4. **Baked fades.** A fade baked into an image (a gradient over a photo, often at a section's edge) stretches with
   the box once exported flat: export the raw image (`assets_export` with `original: true`) and build the gradient
   in CSS (`guide assets`).
5. **Tiled textures.** A frame filled with a tiled texture renders coarser or finer at another scale: the hint gives
   the scale; export one tile at it and repeat it.
6. **Blend modes and video.** They change the look completely: `inspect` gives the layer's and each fill's blend
   mode and each fill's type; `design_read` writes `mix-blend-mode`, and lists a video fill as an asset no file holds
   (`guide assets`).
7. **States.** Top-level frames of one size that share most of their layers (a section and its copy with another tab
   active) are states of one component: build it once, with variants; `nodes_diff` lists what differs.
8. **Missing fonts.** A text whose font is not installed here was laid out with a fallback, and the hints name it:
   its spacing may differ only for that reason, so do not "fix" it. `fonts_check` says where the build gets each font.

Build the code from the XML with the project's own components, tokens and layout conventions: the XML is the spec,
not the code to paste. Hints in design_read also say what Figma left unbound (raw colours equal to tokens, raw
spacing, radii and strokes Figma itself matches to a token, unnamed layers, frames without auto layout) and what
instances changed outside their component's properties.

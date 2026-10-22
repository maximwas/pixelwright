/** The guide's workflow topic. */
export const WORKFLOW = {
  about: "Which tool to use when, from finding a section to its files.",
  markdown: `# Pixelwright: how to work with a Figma file

Pixelwright reads the files open in Figma Desktop through its plugin; nothing goes through Figma's REST API. Every
tool takes \`file\` (a session id from \`status\`, or a file name); without it, the active file.

1. **Connection.** \`status\` lists the connected files and which one is active. None connected: the user runs the
   Pixelwright plugin in Figma Desktop and keeps its window open (the first time, they type the pairing code status
   shows into the plugin window).
2. **Find what to read.**
   - \`file_map\`: every page with its frames, sections and components, in one call: where to start in a big file.
     \`devStatus\` says what the designer marked ready for dev (or completed): build those first, not drafts.
   - \`selection_get\`: what the user selected ("this", "the selected one"). \`selection_wait\`: ask the user to select
     something, then wait for it. \`viewport_get\`: what the user is looking at, when "this" comes with no selection.
   - \`outline\`: the layer tree with boxes, x and y relative to the outlined layer; \`node: "0:0"\` lists the pages.
     A layer with \`$children="N"\` has more children than listed: outline it on its own. An instance names its
     \`component\` and \`variant\`, so repeated cards show without a read; \`dev="ready"\` marks what the designer
     handed over for development.
   - \`nodes_find\`: layers by name, type, text or component.
   - \`node_show\`: brings layers into view (fitted or at a zoom) and selects them, so the user sees which you mean.
   - \`changes_since\`: what the designer changed since you last looked (a cursor), to read again only that.
3. **Read one section.** \`design_read\` returns the section as XML (see \`guide xml\`), then JSON with tokens, text
   styles, fonts, assets, hints and truncated, plus \`measurements\` (the designer's Dev Mode measurements, in px) and
   \`motion\` (Figma Motion as CSS \`@keyframes\`) when the section has them. Read sections, not whole pages: past \`maxChars\` (80 000) the deepest
   branches are left empty with \`$truncated="true"\` and their ids listed in \`truncated\`; read each on its own.
   Pass \`assetsDir\` (e.g. src/assets) to get its icons and images written as files.
   \`repeats: true\` reads a list of alike items once (\`$repeat\`), with their data as rows: shorter, and the
   list's shape plain. \`nearby: 400\` adds the designer's notes on the canvas around the screen (texts and stickies
   beside it, nearest first): read them, they often say what the layers cannot (states, motion, copy to change).
4. **Look at it.** \`screenshot\` renders a layer to PNG (inline up to 2000 px a side, scaled down to fit; \`save\`
   writes a .png file full size; \`clip\` takes a region of it, in px from its box). Compare your build with it:
   \`image_compare\` renders a layer the same way and compares it with a PNG of your build (rmse, the share of pixels
   that differ, the box around them, edges off by N px; \`diff\` writes the difference as a PNG).
   \`styles_compare\` checks the build's computed styles (getComputedStyle) against each layer, property by property:
   the values that differ with the token or text style behind them, and the properties the build left out.
   **Measure it.** \`inspect\` reads layers as Figma has them, without code and with Allow edits off: the layout box
   and the painted box (a centred stroke, shadows and blur reach past it), the fill with the style or variables behind
   it (what a \`var()\` resolves to), how strokes paint, every effect's parameters (a progressive blur's start and
   end), a text's lines and line heights, overflow, interactions with their transitions, a component's variant, and
   each layer's centre. Items set around a circle (a round menu, labels on a dial): \`around\` (the circle's id, or a
   point) gives each centre's distance from it and its angle as CSS \`rotate()\` turns, 0 at the top, clockwise.
   \`measure\` gives the distances between layers, each from the one before (gaps, aligned edges, insets).
   **Compare variants.** \`nodes_diff\` says how one layer differs from another (A/B screens): the layers only one
   has, the attributes that differ, and icons whose drawing differs. \`variants_read\` gives a component's states as
   differences from its default (build :hover, :active, :disabled from them). \`breakpoints_find\` finds a screen at the
   page's other widths, for the media queries. \`flow_read\` maps the prototype: screens and the links between them.
   A screenshot in another variable mode (\`modes: {"Theme": "Dark"}\`) shows a theme without switching it in Figma.
5. **The design system.** \`tokens_read\`: variables with every mode (light, dark…) and styles, as CSS, JSON or DTCG token files.
   \`tokens_usage\`: the layers a token is used on. \`components_read\`: the components a page uses, or the file
   defines, with variants and properties. \`design_audit\`: the scale a design uses (spacing, radii, font sizes,
   colours) and what is off it, for a file without tokens. \`contrast_check\`: every text's WCAG contrast.
   \`fonts_check\`: the fonts used and where the build gets each (Google Fonts links). \`design_lint\`: a layer, a
   page or the file checked against the general rules (contrast, raw values, detached components, overflow, touch
   targets, states, leftovers), each finding with its fix; \`tokens_bind\` then binds the raw values to the tokens
   that hold them (\`dryRun\` first, \`choose\` where several tokens hold a value). \`a11y_read\`: a screen's heading
   levels, control roles and labels, alts and reading order, for the markup. \`states_find\`: the hover, focus,
   disabled, empty, loading or error states the build will need and the design lacks.
6. **Files.** \`assets_export\`: several layers, or every asset inside one, as PNG, JPG, WebP, SVG or PDF, or the
   images as they were placed (originals); \`width\` sizes a render by the CSS width the build shows it at (110 at
   scale 2: 220 px). When a file gets another name than design_read planned (\`planned\`), use the path it gives.
7. **Write.** \`design_apply\` writes the same XML back into Figma: change layers by id, create new ones (see \`guide
   write\`, and \`guide layout\` for flex, grid and absolute placement); \`tokens_apply\` writes variables and styles in
   tokens_read's JSON shape (see \`guide tokens\`); \`effects_apply\` puts noise, texture or glass on layers;
   \`texts_replace\` changes copy across a page or the file (a dictionary at once, styles kept); \`instances_reattach\`
   puts detached frames back as instances, swaps components and takes overrides off;
   \`execute\` runs plugin code for what none of them can say. The user turns Allow edits on in the plugin window first.
8. **Code Connect.** Where the project has Figma Code Connect templates (\`*.figma.ts\`) or batch files
   (\`*.figma.batch.json\`), \`design_read\` gives each connected instance as \`$code\` with its code in
   \`codeComponents\`: use that code, adding what \`unread\` names. \`components_read\` gives each component's \`code\`, and
   \`mapped: false\` the ones still without: map them once with a batch row each; \`code_connect_read\` checks the files
   (see \`guide code-connect\`).
9. **Keep the code in step with the design.** Right after the \`design_read\` you build a screen or section from,
   \`baseline_save {node, name, code}\` keeps it in the project (\`.pixelwright/baselines/\`: commit it to share, or
   leave it out of git, since it holds the design's texts). When a session starts, or the user says the design
   changed, \`baseline_diff\` without a name says which baselines changed; with \`name\` it lists the changes in the
   XML's terms. Change only the code they name: a \`components\` entry whose \`instances\` cover \`of\` goes into the
   component's code once; export again what is marked \`drawing\`; build added layers from their \`xml\` (or
   \`design_read\` when it is left out). Then \`baseline_save {name, accept}\` with the \`accept\` the diff gave. Your own
   \`design_apply\` writes show up too: accept them once the code follows. \`version_save\` leaves the designer a named
   version, only when the user asks. \`changes_since\` stays the live view while the plugin is open.

Build the code from the XML with the project's own components, tokens and layout conventions: the XML is the spec, not
the code to paste. Hints in design_read say what Figma left unbound (raw colours equal to tokens, raw spacing, radii
and strokes Figma itself matches to a token, unnamed layers, frames without auto layout) and what instances changed
outside their component's properties.
`,
} as const;

# Architecture

Pixelwright is an MCP server for Figma that works through the Plugin API only. A plugin running in Figma Desktop
connects to the server over a local WebSocket; there is no REST API and no token. One npm package holds the server, the
plugin's main thread and the plugin's window.

## Codemap

The source lives in `src/`, one folder per layer, one folder per topic inside it. Imports go one way, top to bottom.

- `shared/`: the vocabulary both sides speak, with no runtime of its own.
  - `protocol/`: the handshake frames, the proof, the close codes and reasons, the RPC function types, the channel
    (dev or release), the message socket and its in-memory twin for tests.
  - `ops/`: one folder per op with its contract (`OpContract`: name, input and output schemas, meta), the op catalog.
    `read/` is the read op: a read model per layer asked, the ids Figma did not give, and the cuts (A§9.4).
  - `read-model/`: the versioned read model (A§7.1, D-05): `ReadModelSchema`, a header (`model`, `profile`) around
    0.7.0's snapshot field names (`LayerSchema`, K-084), which baselines v1 store and the Orbit fixtures hold. A
    snapshot without a header (a baseline v1) reads as a design model. Strict, loose where 0.7.0 was (paints, effects,
    reactions, `mixed`).
  - `envelope/`, `errors/`, `limits/`, `version/`, `window/`: the op result envelope, `PixelwrightError` and the error
    codes, numbers with their reason, the build's version, the messages between the plugin's window and its main thread.
- `core/`: the pure domain and its ports.
  - `kernel/`: the floor of core, importing no other domain: `numbers/` holds the D-15 precision table (`PRECISION`,
    the places each class of value keeps) and `NumberFormat`, which every reader rounds with; `lists/` holds
    `NameValueList`, the `Name=Value, Other=Value` lists with `,` `=` `\` escaped (a variant, a component's properties); `geometry/` holds the value objects `Area` (a box's centre) and
    `Turn` (a rotation, or a mirror matrix's angle with the flip taken out, K-068; a line's flat or standing snap);
    `color/` holds `Color`, the colour value object (K-063: any CSS colour through culori/fn with its modes registered
    by hand, P3 kept P3, Dev Mode's CSS forms, the wire form with `space` only for P3, equals within 0.0005, contrast);
    `names/` holds `TokenNames` (T-163: a style's or variable's `--Name`, Unicode letters and digits kept, a name with
    none `--token-<fnv1a>`, K-070; a variable's WEB code syntax wins; a same-named style `--Black-2`, its XML name
    `h1-2`; the variable an alias binds to a field; a collection's or mode's data attribute slug, C-135) and `Slug` (K-075: an asset file name, slugify with Ukrainian
    transliteration, 60 characters, `asset` when empty); `easing/` holds `EasingCss`, the one easing writer (D-64, K-066: a
    CSS keyword, else `cubic-bezier()` to 3 decimals, a hold as `step-end`; a spring writes nothing until the Motion
    item, its preset numbers unverified, D-24).
  - `tokens/`: `names/` holds `StyleNumbers`, the one numbering of same-named styles (the file's own by id, then library
    ones, D-29: library numbers depend on the page read, a known quirk); the plugin's `References` numbers with it.
    `model/` holds `TokenModel` (T-160: the variables op's raw tokens as collections with their modes and
    `[data-<collection>="<mode>"]` selectors, variables as CSS, styles and notes; the collections asked for, a var()
    target the output leaves out noted from the aliases themselves, K-005), `VariableCss` (T-164: hex or rgba,
    `color-mix()` for a composed colour, px but for opacities and weights, quoted strings, easings, seconds, `var()`),
    `NumberUnits` (K-003: a FLOAT's unit from its scopes, else its alias group's by union-find, else px) and
    `StyleTokens` (K-006 through design_read's own mapping: `PaintList` on a square for paint styles, so gradients
    come from the paints, C-022; `--Name-font` with letter spacing and case for text; shadows, and blurs as
    `--Name-filter` / `--Name-backdrop-filter`, D-26, for effects); `formats/css/` holds `TokensCss`, the CSS format
    (`:root` with each default mode and the styles, a block per mode of a collection with several).
  - `xml/`: light XML: `XmlEscape`, the tag vocabulary (`TAG`; `NodeTag`, a Figma type's tag), the layout constants,
    and `XmlWriter`, the one writer of an `XmlElement` tree (an element per line, two spaces a level, a Text with its
    Spans on one line, C-1.1); `outline/` holds `OutlineXml`, which writes the outline op's tree through it on the
    server (the plugin never imports `core/xml`).
  - `design/`: design_read's tree over the read model, on the server (C-140: the tree first, the string last).
    `DesignReader` is the entry (T-050): it plans the assets once for the XML and the JSON block, plans the fit once
    and writes the read with that plan. `DesignXml` builds the tree, folds runs when asked and writes it with
    `XmlWriter.written` (the lines and each element's span); `fit/` holds `DesignFit` and `FitRound` (T-054: in up to
    8 rounds, each checked by a real render, branches emptied deepest first and largest first at one depth with
    `$truncated="true"`, then the widest lists cut to their first children with `$children`, then the longest texts
    shortened with `…`; a folded run is cut whole, never inside); `repeats/` holds `RepeatFold` (T-059: each run of
    three or more alike neighbours read as its first with `$repeat="N"`, the JSON `repeats` rows holding each one's
    own values); `tree/` holds `LayerTree` (an element per layer, a hidden layer as a stub with
    `display="none"` and the property that shows it, D-18; a slice left out; `$children` where the read cut; an
    asset with no children); `assets/` holds `AssetClassifier` (C-142: Icon only from shapes with a true vector, Image
    for mask groups, image, pattern or shader fills and noise, texture or glass effects; the designer's export settings
    win except a PDF, text or the root; a video fill is a video, B-001, D-23), `AssetCss` (C-143: placement only,
    images also radius, outer shadows and outline; an icon placed by its render bounds, a turned asset without its
    transform) and `AssetPlanner` (C-144: one `AssetPlan` per read, names `-2`, `-3` per full file name, one
    `<layer>-background.png` per image hash, a video listed with no file), which `LayerTree` and `ReadCatalogue` (the
    JSON block's `assets`) share;
    `builder/` holds `DesignBuilder` (a layer's tag and its attributes in C-1.3 order: metadata, a Text's `textStyle`
    and a TextPath's `d` and `start`, the CSS from `CssReader`, then the `$` ones, `$css` among them). `text/` holds
    `TextContent` (a Text's characters with the runs that differ from its main one as Spans: only the differences and
    the resets, C-120; a character limit cuts with `…`) and `ReadCatalogue` (the JSON block's `tokens`, `textStyles` and
    `fonts`, C-123), its tokens from `ReadTokens` (each variable and paint or effect style the read uses, by name, with
    its value as written, T-163). Every bound value is written as `var(--name)`: `CssLength.bound` for lengths (padding,
    gap, radius, sizes), `SolidPaint` for colours, `PaintList` and `EffectsGroup` for styles. `component/` holds
    `ComponentAttributes` (an instance's `component`, `variant` and `props` with `#id` cut and `\`, `,`, `=` escaped;
    `$override`, the CSS words of what an instance changed, C-133; the `$prop` / `$visibleProp` / `$swapProp` bindings;
    variable modes as `data-<collection>="<mode>"`, C-135), which `DesignBuilder` calls in C-1.3 order.
    `interactions/` holds `InteractionAttributes` (prototype interactions as `$on-*` sentences, one per trigger, C-154),
    which `LayerTree` adds last, before `$children`. `ReadJson` (beside `DesignReader`) builds the JSON block:
    `ReadCatalogue`, the measurements (`core/inspect`) and `hints/`: `DesignHints` over the shown layers (visible, no
    asset) gives `TokenHints` (raw colours equal to a token, read only from CSS attributes, never a text's characters,
    C-152; numbered and valueless styles), `LayerHints` (one per kind with a count and three examples, C-151; a frame
    placed by hand with Figma's guess from `LayoutGuess`) and `InferredHints` (Figma's own variable matches, C-153); `hints/structure/` adds the guide's structure rules,
    read on structure and never on names (Q-001..Q-007): `StructureHints` (absolute children in a flow, spacers, texts
    broken by hand, even gaps without auto layout, fixed widths and clipping heights, its kinds joining `LayerHints`'
    table), `AlikeStructures` (built alike 3+ times: a component), `SharedLayers` (top-level frames as states),
    `BakedPaints` (fades baked into images, tiled textures) and `LayerShape` (a layer's structure as a key); the
    words frozen by `every-hint.hints.json`. `css/fonts/AutoLineHeights` turns a read model's Auto line heights into
    the px a hugging text shows (`autoLineHeight: "px"`, T-060), before the read is written.
  - `inspect/`: `NearbyNotes` (the notes within a distance of a screen, nearest first, the side each is on, 20 plus
    `more`, T-058; the plugin's nearby op calls it) and `Measurements` (Dev Mode measurements with the px between
    their sides, the JSON's `measurements`, T-061); `InspectView` turns the inspect op's layers into inspect's answer
    (boxes and centres, `around` distance and CSS angle rounded after the modulo, overflow, text lines, interactions,
    variant) with `InspectFills` (blend modes with their CSS names, strokes, fills with their style and variables,
    every fill type, bound fields by design_read's token, O-026); `Measure` measures each layer from the one before
    (gaps, edges and centres aligned within 0.01, insets, painted boxes, a sentence per pair).
  - `diff/`: `DesignDiff` compares two reads as design_read's tree (`LayerTree`): layers matched by their path of
    tags and names below the roots (same-named siblings in order), attributes and text as [A, B], a text's spans as
    its children, ids and the roots' own names and places left out (T-085, K-051); `Fingerprint` compares an icon's
    or image's drawing without what names or places it (es-toolkit `isEqual`, K-052); `VariantDiff` holds each
    variant of a set against the default or the variant one property away, with the pseudo-class a state suggests
    (T-086, K-053; names parsed by `NameValueList`); `Breakpoints` scores the page's screens against the asked one by
    names without size words and children's names, weights as data (T-087, K-054).
  - `checks/`: `build-styles/` is styles_compare's engine (T-090). `BuildStyles` finds each pair's layer in the reads
    (in its parent when another pair's read holds it, else as its own read's root: the read op gives no parent) and
    takes its CSS as design_read writes it (`DesignBuilder`, the asset plan, `ReadCatalogue`'s tokens and text
    styles), never through a second mapping; `StyleCheck` holds the build's computed styles against it: `Shorthands`
    spreads design_read's shorthands into longhands (a nowrap flex's gap on its main axis only), `StyleMatch`
    compares by kind (sizes and places within the tolerance, K-049, K-050), `ShapeMatch` colours, shadows,
    gradients and transforms, `Dimension` reads one CSS number.
  - `css/`: the Figma-to-CSS mapping table, on the server (the plugin never imports `core/css`; it sends raw fields).
    `CssReader` is the facade: a layer, its parent and the read give its declarations in `CSS_ORDER` and its `$css`
    notes. `registry/` holds `GroupRegistry` (the `PROPERTY_GROUPS` in order, each owning its CSS attribute names and
    naming its read-model `sources`) and `CssDeclarations` (one builder per layer, sorted by `CSS_ORDER`). `values/`
    holds `CssLength` (whole px, the box shorthand, bare numbers as px, D-22), `CssSplit` (top-level splitting with the
    @csstools tokenizer), `CssVar` (`var()` fallbacks) and `CssUrl` (`url()` written bare or quoted, an unquoted bad one
    refused with a hint). `paints/` holds `SolidPaint` (a solid paint as its colour, its bound variable's `var()`, or
    `color-mix()` past the variable's alpha, C-020) and `PaintList` (a layer's paints top first, a paint style as its
    token, an unmapped paint marked; gradients and images on a background only), and `ImagePaint` (an image fill as
    its `url()` and the scale mode's size and repeat, C-082). `fonts/` holds `FontShorthand` (`[italic] weight
    size/line-height 'Family'` with the family escaped, O-021; letter spacing in em = percent / 100, C-112, C-114). `gradients/` holds `GradientGeometry` (Figma's transform
    and CSS's gradient line, measured in px so a non-square box keeps its angle, FX-020), `GradientCss` (linear, an
    axis-aligned radial, conic; stops bound to variables as tokens) and `GradientParser` (CSS gradients back to a spec,
    radial sizes, `color-mix()` and P3 stops included, for the write side). `groups/<group>/` holds one group each, in this order: `layout/` reads auto layout as flex and
    a grid as its tracks; `geometry/` reads where a layer is and how big (`Placement`: position and edges from the
    constraints, a turned layer by its bounds' centre; `GeometryGroup`: transform, size, FILL as flex or stretch,
    limits; a flat or standing line unturned along its length); `appearance/` reads opacity, blend mode, clipping, a
    text's truncation, the radius and layout grids; `paint/` reads fills (`FillsGroup`: background top first, a text's
    colour, the fixed D-20 note for what it cannot write) and strokes (`StrokesGroup`: border, outline, per-side
    borders, dashed, a line as one border); `effects/` reads shadows top first (`box-shadow`, a text's
    `text-shadow`, an effect style as its token) and blurs as `filter` / `backdrop-filter` at 0.43 R (C-100); `text/` reads a text: `TextRun` (a run's font,
    spacing, case, decoration and colour, left out where its text style sets them the same; features and the axes a
    browser would not draw as notes, FX-066), `TextGroup` (alignment, the longest run as the text's own, wrap and the
    block's notes, C-110, C-116) and `TextPathData` (a TextPath's `d` through svg-path-commander, and its start).
  - `images/`: `Crop`, a region of an image's pixels as an image of its own, transparent where the image does not
    reach (T-073), and `IMAGE_FORMAT`, the format names a sniffer gives; `Rgba`, any PNG's pixels as 8-bit RGBA and
    laid over white; image_compare's numbers (T-089): `Rmse`, `EdgeDiff` (S-094, edges paired by the pixels on them,
    B-007) and `ImageComparison`, which compares the part both images cover through the `PixelDiff` port.
  - `ports/`: the interfaces the outer layers implement (`PluginLink`, `Logger`, `Clock`, `JsonFile`, `KeyValueStore`,
    `DocumentEvents`, `ServerEvents`, `WindowEvents`, `EditsSwitch`, `ClientRoots`, `ImageCodec`, `ImageSniffer`,
    `PngFiles`, `PixelDiff`, `FontDirectory`), each with its token.
- `server/app/`: the services a tool call runs through.
  - `tool-runner/`: `ToolRunner`, its steps, the `Tool` base class, the tool manifest and the call id.
  - `sessions/`: `PluginSessions` and `PluginSession` (one call's file), the op steps, `TargetResolver`.
  - `project/`: `ProjectFolder`, where every relative path a tool takes starts (the client's first file root, else
    CLAUDE_PROJECT_DIR, else cwd; never home or `/`).
  - `scope/`: `WithinScope`, where a tool works: the layer or page `within` names, every page for "file" (listed
    unloaded through file_map, so the ops stay page-scoped), else the current page. `SelectedLayer`: the one selected
    layer a tool defaults to, NODE_NOT_FOUND with advice when none or several are (D-64).
  - `renders/`: a layer rendered to PNG. `ExportPull` (the export op renders under a random stream, the chunk op hands
    it out in 2 MiB parts; a changed total or an empty part is an error, T-075), `PngRender` (full size, or a clip cut
    from the whole render, measured by the cover op; past 64 Mpx the cover layer alone, O-014), `RenderToFit` (inline
    images: 2000 px, which the plugin fits, and 3.5 MiB, up to three renders at 0.9 of the estimated scale, T-071),
    `Screenshots` (the screenshot tool's engine and design_read's: saved through `PngFiles`, or inline) and `Shot`, the
    answer's image and text blocks; `ExportPull.original` pulls an image fill's original bytes the same way (image op).
  - `assets/`: asset files (T-055, T-194, T-195). `AssetFiles` fetches each planned file (an original by its hash, else
    a render in its format: rasters at 2x, vectors at their size, icons with their effects; WebP encoded on the server
    through the `WebpEncoder` port) and `AssetWriter` writes them: the same bytes once, `-2` for a name holding other
    bytes, never over another file, an original with the extension its bytes have.
  - `stores/`: `UpdateState` (latest.json) and `WrittenFiles` (written-files.json: the SHA-1 of every asset file
    written, its layers, the newest 5000) and `LibraryStore` (`libraries/<slug of the file name>.json`, the catalogue
    library_search saved for a library file, an unreadable one noted), all through the `JsonFile` port in the
    channel's home.
- `server/tools/`: one folder per tool (manifest, schema, tool class) and `ToolCatalog`; `execute/` also holds
  `SyntaxCheck` (node:vm) and `ReadsOnlyCheck` (acorn); `inspect/` and `measure/` read through the inspect op (an
  `around` layer is a second inspect of it in the same origin; a selection past 100 is cut and counted in `left`).
  `nodes-diff/` reads both layers with one read op and cuts each list to 200; `variants-read/` finds the set with the
  set_of op and reads it whole; `breakpoints-find/` scores the screens op's answer; `flow-read/` also holds
  `FlowLinks`, which turns the flows op's layers with interactions into links in design_read's words (T-088).
  `components-read/` also holds `LinkPaths` (a Dev Mode link to a GitHub, GitLab or Bitbucket file, or a vscode://file
  link, as the project file it points at, the longest existing end for a branch with slashes); `library-search/` saves
  a file's own published components through the components op and searches every saved catalogue with Fuse.js, which
  stays on the server. `tokens-read/` makes the variables op's raw tokens into core's token model and writes it as
  CSS (format css; json and dtcg come with their items).
- `server/adapters/`: the port implementations on Node.
  - `bridge/`: `PluginBridge` (the role switch), `NoBridge`, the status hints, and the bridge's topics:
    `listener/` (the port, the upgrade guard, `bridge.json`, the ws socket), `plugin/` (one plugin socket's handshake,
    pairing codes, the RPC peer), `sessions/` (`SessionRegistry`, `BridgeSession`), `owner/` (the owner's side of
    the peers), `peer/` (a peer's side of its owner), `hints/` (`StatusHints`).
  - `logging/`, `files/`, `clock/`, `mcp/`: pino and the shared log file, atomic JSON files and `NodePngFiles` (screenshots,
    only to `.png` paths and never over a file that is not a PNG, T-072), the system clock, the
    stdout guard and `McpRoots` (the client's roots, asked once and again on list_changed).
  - `images/`: `FastPngCodec` (fast-png: PNG to pixels and back, an indexed PNG as its colours) and
    `ImageSizeSniffer` (image-size: what bytes really are, whatever their file is called), `JsquashWebp`
    (@jsquash/webp 1.5.0: PNG to WebP, its wasm read from the package, the alpha kept exactly), `PixelmatchDiff`
    (pixelmatch 8.0.0: the differing pixels, their box and the difference image, A§15.7).
  - `process/`: `ExecFileRunner`, the `ProcessRunner` port on execFile; `http/`: `NpmRegistry`, npm's newest release;
    `FontsourceDirectory` (Fontsource's API, A§15.5) with `GoogleMetadataDirectory` (Google's catalogue) as its
    fallback, what Google Fonts serves for fonts_check, read once for the server.
- `server/main/`: `ServerMain`, the server's composition root, its providers, `ContainerToolFactory`, the config
  reader, `McpEndpoint`, the shutdown hooks.
- `cli/`: the `pixelwright` binary: `bin.ts` (the Node gate, then a dynamic import) and `CliMain`, the CLI's
  composition root. `main/`: `CommandLine` (parseArgs; one `CliCommand` per command), `ServeCommand`, `NodeGate`,
  `CommandProviders`. `setup/`: `SetupWizard` (@clack/prompts), `SetupPrint`, `McpClients` (Claude Code and Codex
  through their commands, Cursor's mcp.json merged with a .bak, the blocks to paste), `PluginCopy` (the one copy
  path, `pnpm plugin:install`'s too). `logs/`: `LogFollower`, the shared log polled across the .1 hand-over.
  Everything the setup writes is named by `CHANNEL`; every process goes through the `ProcessRunner` port.
- `plugin/app/`: the op runtime in Figma's main thread: `OperationRunner`, its steps, the `Operation` base class,
  `OpReport`, `OperationTurns` (the read/write turn lock), `BusyOps` (what runs past its answer, as the window shows
  it); `journal/` holds `ChangeJournal`, what changed while the
  window is open and whose hand it was; `streams/` holds `ChunkStreams`, the renders the server pulls in chunks, one
  per stream, four at most, each dropped once read whole (T-075).
- `plugin/adapters/`: `figma/` reads the document (`CodeFigma`, execute's figma and pw helpers; `CurrentSelection`,
  which also selects and hears selection changes; `LayerRefs`, a layer as lists name it, its Dev Mode status too; `CanvasView`, the current
  page and the view, the one place either changes; `FigmaBase64`, bytes as base64 for the bridge; `lookup/`: `NodeLookup`, the only by-id lookups and a node's page, `PageLoader`, the
  pages and their loading, a page Figma cannot load noted, and `LayerWalk`, the walk with a deadline; `dev-resources/`:
  `DevResources`, Dev Mode links from Figma's servers within 5 s, a refusal (403 without Dev Mode) in Figma's words; `layer-read/`:
  `LayerReader`, a layer as the read model, its header and the field readers in 0.7.0's order, `BoxFieldReader` the
  first, a hidden layer a stub; `PaintFieldReader` and `StrokeFieldReader` the paints and how strokes are drawn, `EffectFieldReader` the effects
  and their style; `TextFieldReader` a text's characters, runs (the newer run fields asked first, FX-012) and
  paragraph fields, a TextPath's path and start; `VariableFieldReader` the variables bound to the layer's fields; the paint,
  stroke, effect and text readers send the style ids; `References` the styles and variables the read uses, each looked
  up once by id (`NodeLookup`), same-named styles numbered by `StyleNumbers` over the file's own and the page's; the
  file's colour profile and the Dev Mode status of the root or the nearest layer above it for the read's header);
  `layer-meta/`: what a layer is rather than how it looks, under the same `FIELD_READERS` (a reader may answer a
  promise, so `LayerReader.entry` and `ReadRun` are async): `ComponentFieldReader` (an instance's main component, set
  and properties without a slot's, a component's description and bindings, the overrides of the instances around it),
  `NoteFieldReader` (Dev Mode annotations with their category), `ModeFieldReader` (explicit variable modes by name) and
  `ReactionFieldReader` (reactions, `actions ?? [action]`, each destination named once, P-089; the URL as href); `variables/` holds `FileTokens` (the file's collections, variables and styles, and those
  the layers under `within` or on the current page use, every variable an alias points at in turn; styles numbered
  by `References`; no style CSS asked of Figma, D-20), `UsedTokens` (the style ids and bound variables of the layers,
  within the op's deadline) and `LibraryCatalogue` (the enabled libraries' variables by name, 500 at most); `host/`
  holds the
  window channel (`UiChannel`; `WindowHost`, main's side of the window: the handover, the switch, the activity and busy
  events, the allowed links, the height), the RPC peer of the server
  (`ServerRpc`), the document events with the page's layer changes, and clientStorage (pairing key, Allow edits, file
  id).
- `plugin/operations/`: one folder per op, one `Operation` subclass each; `read/` also holds `ReadRun`, the
  breadth-first read under the JSON budget with its cuts; `nearby/` also holds `NoteCandidates` (what around a screen
  is a note: a text, a small holder of texts and plain shapes, a layer named like a note); `execute/` also holds `CodeRuns` (the code's run past its answer) and `CodeScope` (pw, kept
  while the window is open) and the code's console, value printer and error text. `export/` renders a layer with
  exportAsync (PNG, JPG, SVG or PDF) into `ChunkStreams`, `image/` holds an image fill's original bytes there by its
  hash, `chunk/` hands a part of either out as base64, `cover/` also holds `ClipCover`, the
  smallest opaque layer that shows a clip's region alone, over the layer's tree as plain values (T-073). `inspect/`
  reads each layer's entry on its own (`LayerReader.at`, boxes from `relativeTo` or the page) with its parent, layout
  and painted boxes and its parent's room, and what its paints use (`LayerReader.shared`); it never needs Allow edits.
  `set-of/` gives the component set a layer is, holds or comes from (P-116); `screens/` the screen a layer is on and
  the page's other screens with their children's names (P-123); `flows/` the page's flow starts, screens and layers
  with interactions (`ReactionFieldReader`, 500 at most within the op's budget, P-121); screens are
  `PageLoader.screens`: frames, components and instances at the page's top or in its sections.
  `components/` also holds `ComponentFinder` (local: the sets and lone components of every page or of `within`; used:
  the mains of the instances, a batch at a time, counted), `ComponentEntries` (properties from the set or a lone
  component only, FX-028), `ExposedInstances` and `ComponentLinks` (the file asked first, then each component's).
  `variables/` returns the raw tokens through `FileTokens` and `LibraryCatalogue`: the server builds the model, the
  plugin carries no `core/tokens`.
- `plugin/main/`: `PluginMain`, the plugin's composition root, its providers, `ContainerOperationFactory`, the Figma
  manifest.
- `plugin-ui/`: the plugin's window: `link/` (`SocketLink`, the handshake and reconnects; `WindowLink`, its window side;
  `Backoff`), `adapters/` (the browser socket, the channel to main), `view/` (`PluginWindow`, the DOM; `StatusLine`,
  its words; `RecentActions`, the last five answers; `BusyState`, what runs past its answer), `main/` and `UiMain`.

`test/` holds the contract, golden, guard and live tests; `scripts/` the build, install and name checks; `old/` the
0.7.0 source, kept for reference and imported by nothing.

## Invariants

- Imports go one way: `shared` imports nothing from `src`; `core` imports `shared`; `server/app` imports `core` and
  `shared`; tools import `server/app`, `core` and `shared`; `server/adapters` import `core` and `shared`; the plugin
  never imports the server and the server never imports the plugin; the window imports `shared` only. Each tool and
  each op is apart from the others. `core/kernel` imports no other core domain. `pnpm check:deps` (dependency-cruiser)
  enforces all of this, cycles included, and that `shared`, `core`, `plugin` and `plugin-ui` use no Node module and no
  server-only package.
- No barrels: a class is imported from its own file; the project-structure lint refuses an `index.ts`.
- Only composition roots and the `main/` folders see the DI `Container`. Everything else asks for its dependencies as
  constructor defaults, `inject(TOKEN)`, by token, never by class.
- Every import of `src` goes through the `@/` alias from the root of `src/`; no `../` anywhere.
- No strings in code outside `.constants.ts` files: names, states, reasons and texts are `as const` objects there.
- Everything in `src/` is a class; inheritance is one level deep, from `Tool`, `Operation` or `Error` only.
- The server's stdout is MCP only; logs go to stderr and the shared log file through the `Logger` port.
- Data crossing a trust boundary (MCP, the bridge, files, the network) is parsed by its zod schema first.
- Each CSS attribute belongs to one property group (`GroupRegistry` refuses two owners), and a layer's CSS is written in
  `CSS_ORDER` whatever order the groups set it in.

## Where is the thing that...

**Runs a tool call.** The MCP SDK hands the call to `McpEndpoint`, which gives it to `ToolRunner`. The runner's chain,
outermost first: `ErrorTextStep`, `CallLogStep`, `TargetStep` (binds the call to a `PluginSession` when the tool takes
`file`), `OutputCheckStep`. `ContainerToolFactory` builds the tool in a child container per call, and the tool's
`execute` asks its session for ops. Each op passes the session's chain, `OpLogStep`, `OpTimerStep`, `OpResultStep`, and
reaches `PluginLink`, which is `PluginBridge`. On the owner, the request goes to the file's `BridgeSession` and out
through `PluginRpc` (birpc) on its socket. The window relays the frame: `SocketLink` to `WindowLink` to `MainChannel`,
then main's `UiChannel` to `ServerRpc`. `OperationRunner` runs the op through its chain, outermost first:
`ActivityStep` (each answer to the window's activity list, quiet ops left out), `ContractStep`, `EditsStep` (Allow
edits), `FrameSizeStep`, `TurnStep` (the read/write turn), `JournalStep` (a write's touched ids for the change
journal), `WatchdogStep` (TIMEOUT at the op's timeout; the window shows the op busy until its handler ends).
`ContainerOperationFactory` builds the op in a child container; `Operation.run` calls the op's `execute` and wraps what
it returns or throws in the envelope through `OpReport`. The envelope goes back the same way.

**Runs code.** `ExecuteTool` reads `script` through `ProjectFolder` at every call, refuses code that does not parse
(`SyntaxCheck`), and runs the execute op; the op's meta makes every deadline max(30 s, timeout + 5 s). In the plugin,
`ExecuteOperation` runs the code as an async function of `CodeFigma`'s figma proxy, `CodeConsole` and `CodeScope`'s pw,
answers at the code's own timeout while the code runs on. `CodeRuns` keeps `ChangeJournal`'s execute window open until
the code itself ends, a second more, so what Figma reports meanwhile is Pixelwright's, and shows code past its time
busy in the window through `BusyOps`. Back on the server, `ReadsOnlyCheck` adds the "only reads" note from the code.

**Searches the file.** `NodesFindTool` asks `WithinScope` for its roots: the id given, the current page, or for "file"
every page from file_map's unloaded list. It runs the find op once per root, page by page, in one 20 s budget, and stops
past the limit unless it counts; it adds the counts up and rounds the boxes. In the plugin, `FindOperation` gets the root's layers from
`PageLoader` (a page other than the current one loaded first), walks them with `LayerWalk` until the op's deadline (the
clock read every 500 layers, since findAll cannot be stopped), then looks main components up in batches (`LayerWalk.lookUp`: the first batch even past the deadline).

**Pairs a plugin.** The window says hello through `SocketLink`. On the owner, `BridgeListener` takes the upgrade
`UpgradeGuard` allows, and `PluginConnection` runs the handshake as a state machine. A window with a known key gets a
challenge and must answer it with its `Proof`. A window without one waits for the code: `PairingCodes` holds the one
code in force, which only the status tool mints; the user types it in the window; the server stores the key in
`bridge.json` through `BridgeConfig`, and the window keeps it through `PairingStore`. A paired window becomes a
`BridgeSession` in `SessionRegistry`.

**Reconnects.** On a close, `SocketLink` decides from its close table whether to stop or try again, waiting as
`Backoff` says. On the server, a new socket from the same window replaces its older session in `SessionRegistry`;
`ServerRpc` tells sockets apart by the epoch the window stamps on each frame.

**Tells of an update.** `ServerMain` starts `UpdateFeed`: `UpdateState` (`server/app/stores/`) keeps `latest.json` in
the channel's home and asks npm through `NpmRegistry` at most once a day (off with `PIXELWRIGHT_NO_UPDATE_CHECK`). A
version newer than this server and than the one dismissed goes to `SessionRegistry.announce`, which sends each window
an `update` frame beside the RPC, now and at each connect. `SocketLink` takes that frame before main's RPC and
`UpdateBanner` shows it; closing it sends a `dismiss_update` frame the registry hands back to the feed.

**Is the owner, and is a peer.** The first server of a channel takes the port and becomes the owner (`OwnerBridge`,
with `OwnerPeers`, `PeerConnection` and `OwnerRouter` serving the owner's contract over oRPC). A server that finds the
port taken joins the owner as a peer (`PeerBridge`, `PeerJoin`, `OwnerClient`), shows the owner's files, asks it for
the pairing code on each status, and runs its ops through it. A newer server takes the bridge over and the older one is handed over for good. With neither,
`PluginBridge` stays unavailable and retries. `PIXELWRIGHT_PLUGIN_BRIDGE=off` binds `NoBridge`.

**Holds the tokens.** A class's token sits at the bottom of the class's own file; a port's token in its `x.port.ts`;
tokens of config values and multi-provider lists that belong to no class in a topic's or a root's `x.tokens.ts`
(`BRIDGE_SETTINGS`, `LOG_SETTINGS`, `LOG_DESTINATIONS`).

**Reads a layer as design XML.** `DesignReadTool` takes the node given, or the one `SelectedLayer` finds, and runs
the read op. In the plugin, `ReadOperation` looks each id up once (one Figma cannot give is missing), and `ReadRun`
reads the layers breadth first under `LIMITS.readJsonChars` through `LayerReader`, a hidden layer as a stub, with a cut
wherever children were not all read. Back on the server a hidden root is refused and the read model goes to
`DesignReader` (after `AutoLineHeights` with `autoLineHeight: "px"`), which fits it to `maxChars` (`DesignFit`), has `DesignXml` write it and `ReadJson` add the JSON block with its measurements and hints; with `nearby` the tool also runs the nearby op: `LayerTree` walks it, `DesignBuilder` gives each layer its tag and attributes, `XmlWriter` writes the
tree. The answer is two text blocks, the XML and the JSON, with no structuredContent. `pnpm dev:read <fixture>` does
the server's half offline for an Orbit fixture in `test/golden/fixtures/`.

**Maps Figma layout to CSS.** In the plugin, `LayoutFieldReader` (one of `FIELD_READERS`) copies a layer's raw auto
layout, grid, grid-cell and sizing fields into the read model. On the server, `DesignBuilder` asks `CssReader`, which
runs the property groups; `LayoutGroup` (`core/css/groups/layout/`) writes display, direction, wrap, padding,
alignment, the gaps and the grid tracks, and a negative spacing as a `$css` note; `GeometryGroup` and `AppearanceGroup`
(their fields from the plugin's `BoxFieldReader` and `AppearanceFieldReader`) write the place, size, transform and
look. `test/golden/design.golden.test.ts` holds the four Orbit XML goldens, `*.read.json` and `*.fit.json` byte for
byte (C-191, C-192, D-21): a golden moves only in its own commit with its decision (D-18 stubs, D-20 notes, a D-15
value); any other move is a bug. `test/live/read/read-model.live.test.ts` checks the live Orbit roots against them.

**Renders a layer.** `screenshot` (and design_read with `screenshot: true`) asks `Screenshots`. Inline, `RenderToFit`
asks `ExportPull.start`: the export op renders with `maxSide` 2000 and holds the bytes under the call's random stream;
an answer over 3.5 MiB is rendered again smaller before a byte moves, else `ExportPull.bytes` reads it with the chunk
op, 2 MiB a frame. A clip first asks the cover op (the box, what the render covers, the cover layer), then `PngRender`
crops the whole render with `Crop` through the `ImageCodec` port; `save` writes the full PNG through `PngFiles`.
`image_compare` renders through `PngRender` the same way (`ComparedImages`), reads its reference through `PngFiles`,
and `ImageComparison` gives rmse, the differing pixels (`PixelDiff`) and the edges (`EdgeDiff`).

**Adds a tool.** A folder under `server/tools/` with the manifest (name, description, schemas, annotations, `load()`),
the schema and the tool class on `Tool`; one line in `ToolCatalog`. The `tools.json` golden changes with it.

**Adds an op.** A folder under `shared/ops/` with the manifest (`new OpContract(...)`, its meta), its name in
`OP_NAME`, one line in the op catalog; a folder under `plugin/operations/` with the `Operation` subclass; one line in
`OperationProviders`. The operations golden changes with it.

## The dev channel

Until the release, every build is the dev channel `pixelwright-new`, a separate product beside the 0.7.0 used every
day: bridge port 18721, home folder `~/.pixelwright-new`, Figma plugin "Pixelwright New" with its own id. The release
channel is `pixelwright` on port 18720 with `~/.pixelwright`. The channel constants in `shared/protocol` decide which
one a build is.

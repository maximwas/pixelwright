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
    `NameValueList`, the `Name=Value, Other=Value` lists with `,` `=` `\` escaped (a variant, a component's properties).
  - `xml/`: light XML: `XmlEscape`, the tag vocabulary (`TAG`; `NodeTag`, a Figma type's tag), the layout constants,
    and `XmlWriter`, the one writer of an `XmlElement` tree (an element per line, two spaces a level, a Text with its
    Spans on one line, C-1.1); `outline/` holds `OutlineXml`, which writes the outline op's tree through it on the
    server (the plugin never imports `core/xml`).
  - `design/`: design_read's tree over the read model, on the server (C-140: the tree first, the string last).
    `DesignXml` is the entry; `tree/` holds `LayerTree` (an element per layer, a hidden layer as a stub with
    `display="none"` and the property that shows it, D-18; a slice left out; `$children` where the read cut);
    `builder/` holds `DesignBuilder` (a layer's tag and its attributes in C-1.3 order: metadata, the CSS from
    `CssReader`, then the `$` ones, `$css` among them).
  - `css/`: the Figma-to-CSS mapping table, on the server (the plugin never imports `core/css`; it sends raw fields).
    `CssReader` is the facade: a layer, its parent and the read give its declarations in `CSS_ORDER` and its `$css`
    notes. `registry/` holds `GroupRegistry` (the `PROPERTY_GROUPS` in order, each owning its CSS attribute names and
    naming its read-model `sources`) and `CssDeclarations` (one builder per layer, sorted by `CSS_ORDER`). `values/`
    holds `CssLength` (whole px, the box shorthand, bare numbers as px, D-22), `CssSplit` (top-level splitting with the
    @csstools tokenizer) and `CssVar` (`var()` fallbacks). `groups/<group>/` holds one group each: `layout/` reads
    auto layout as flex and a grid as its tracks.
  - `ports/`: the interfaces the outer layers implement (`PluginLink`, `Logger`, `Clock`, `JsonFile`, `KeyValueStore`,
    `DocumentEvents`, `ServerEvents`, `WindowEvents`, `EditsSwitch`, `ClientRoots`), each with its token.
- `server/app/`: the services a tool call runs through.
  - `tool-runner/`: `ToolRunner`, its steps, the `Tool` base class, the tool manifest and the call id.
  - `sessions/`: `PluginSessions` and `PluginSession` (one call's file), the op steps, `TargetResolver`.
  - `project/`: `ProjectFolder`, where every relative path a tool takes starts (the client's first file root, else
    CLAUDE_PROJECT_DIR, else cwd; never home or `/`).
  - `scope/`: `WithinScope`, where a tool works: the layer or page `within` names, every page for "file" (listed
    unloaded through file_map, so the ops stay page-scoped), else the current page. `SelectedLayer`: the one selected
    layer a tool defaults to, NODE_NOT_FOUND with advice when none or several are (D-64).
- `server/tools/`: one folder per tool (manifest, schema, tool class) and `ToolCatalog`; `execute/` also holds
  `SyntaxCheck` (node:vm) and `ReadsOnlyCheck` (acorn).
- `server/adapters/`: the port implementations on Node.
  - `bridge/`: `PluginBridge` (the role switch), `NoBridge`, the status hints, and the bridge's topics:
    `listener/` (the port, the upgrade guard, `bridge.json`, the ws socket), `plugin/` (one plugin socket's handshake,
    pairing codes, the RPC peer), `sessions/` (`SessionRegistry`, `BridgeSession`), `owner/` (the owner's side of
    the peers), `peer/` (a peer's side of its owner), `hints/` (`StatusHints`).
  - `logging/`, `files/`, `clock/`, `mcp/`: pino and the shared log file, atomic JSON files, the system clock, the
    stdout guard and `McpRoots` (the client's roots, asked once and again on list_changed).
- `server/main/`: `ServerMain`, the server's composition root, its providers, `ContainerToolFactory`, the config
  reader, `McpEndpoint`, the shutdown hooks.
- `cli/`: the `pixelwright` binary and `CliMain`.
- `plugin/app/`: the op runtime in Figma's main thread: `OperationRunner`, its steps, the `Operation` base class,
  `OpReport`, `OperationTurns` (the read/write turn lock), `BusyOps` (what runs past its answer, as the window shows
  it); `journal/` holds `ChangeJournal`, what changed while the
  window is open and whose hand it was.
- `plugin/adapters/`: `figma/` reads the document (`CodeFigma`, execute's figma and pw helpers; `CurrentSelection`,
  which also selects and hears selection changes; `LayerRefs`, a layer as lists name it, its Dev Mode status too; `CanvasView`, the current
  page and the view, the one place either changes; `lookup/`: `NodeLookup`, the only by-id lookups and a node's page, `PageLoader`, the
  pages and their loading, a page Figma cannot load noted, and `LayerWalk`, the walk with a deadline; `layer-read/`:
  `LayerReader`, a layer as the read model, its header and the field readers in 0.7.0's order, `BoxFieldReader` the
  first, a hidden layer a stub); `host/` holds the
  window channel (`UiChannel`; `WindowHost`, main's side of the window: the handover, the switch, the activity and busy
  events, the allowed links, the height), the RPC peer of the server
  (`ServerRpc`), the document events with the page's layer changes, and clientStorage (pairing key, Allow edits, file
  id).
- `plugin/operations/`: one folder per op, one `Operation` subclass each; `read/` also holds `ReadRun`, the
  breadth-first read under the JSON budget with its cuts; `execute/` also holds `CodeRuns` (the code's run past its answer) and `CodeScope` (pw, kept
  while the window is open) and the code's console, value printer and error text.
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
`DesignXml`: `LayerTree` walks it, `DesignBuilder` gives each layer its tag and attributes, `XmlWriter` writes the
tree. The answer is two text blocks, the XML and the JSON, with no structuredContent. `pnpm dev:read <fixture>` does
the server's half offline for an Orbit fixture in `test/golden/fixtures/`.

**Maps Figma layout to CSS.** In the plugin, `LayoutFieldReader` (one of `FIELD_READERS`) copies a layer's raw auto
layout, grid, grid-cell and sizing fields into the read model. On the server, `DesignBuilder` asks `CssReader`, which
runs the property groups; `LayoutGroup` (`core/css/groups/layout/`) writes display, direction, wrap, padding,
alignment, the gaps and the grid tracks, and a negative spacing as a `$css` note. `test/golden/design-attributes.golden.test.ts`
compares each owned attribute with the 0.7.0 XML goldens.

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

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
  - `envelope/`, `errors/`, `limits/`, `version/`, `window/`: the op result envelope, `PixelwrightError` and the error
    codes, numbers with their reason, the build's version, the messages between the plugin's window and its main thread.
- `core/`: the pure domain and its ports.
  - `ports/`: the interfaces the outer layers implement (`PluginLink`, `Logger`, `Clock`, `JsonFile`, `KeyValueStore`,
    `DocumentEvents`, `ServerEvents`, `EditsSwitch`), each with its token.
- `server/app/`: the services a tool call runs through.
  - `tool-runner/`: `ToolRunner`, its steps, the `Tool` base class, the tool manifest and the call id.
  - `sessions/`: `PluginSessions` and `PluginSession` (one call's file), the op steps, `TargetResolver`.
- `server/tools/`: one folder per tool (manifest, schema, tool class) and `ToolCatalog`.
- `server/adapters/`: the port implementations on Node.
  - `bridge/`: `PluginBridge` (the role switch), `NoBridge`, the status hints, and the bridge's topics:
    `listener/` (the port, the upgrade guard, `bridge.json`, the ws socket), `plugin/` (one plugin socket's handshake,
    pairing codes, the RPC peer), `sessions/` (`SessionRegistry`, `BridgeSession`), `owner/` (the owner's side of
    the peers), `peer/` (a peer's side of its owner), `hints/` (`StatusHints`).
  - `logging/`, `files/`, `clock/`, `mcp/`: pino and the shared log file, atomic JSON files, the system clock, the
    stdout guard.
- `server/main/`: `ServerMain`, the server's composition root, its providers, `ContainerToolFactory`, the config
  reader, `McpEndpoint`, the shutdown hooks.
- `cli/`: the `pixelwright` binary and `CliMain`.
- `plugin/app/`: the op runtime in Figma's main thread: `OperationRunner`, its steps, the `Operation` base class,
  `OpReport`, `OperationTurns` (the read/write turn lock).
- `plugin/adapters/`: `figma/` reads the document; `host/` holds the window channel (`UiChannel`, `WindowHost`), the RPC
  peer of the server (`ServerRpc`), the document events, and clientStorage (pairing key, Allow edits, file id).
- `plugin/operations/`: one folder per op, one `Operation` subclass each.
- `plugin/main/`: `PluginMain`, the plugin's composition root, its providers, `ContainerOperationFactory`, the Figma
  manifest.
- `plugin-ui/`: the plugin's window: `link/` (`SocketLink`, the handshake and reconnects; `WindowLink`, its window side;
  `Backoff`), `adapters/` (the browser socket, the channel to main), `view/` (`PluginWindow`), `main/` and `UiMain`.

`test/` holds the contract, golden, guard and live tests; `scripts/` the build, install and name checks; `old/` the
0.7.0 source, kept for reference and imported by nothing.

## Invariants

- Imports go one way: `shared` imports nothing from `src`; `core` imports `shared`; `server/app` imports `core` and
  `shared`; tools import `server/app`, `core` and `shared`; `server/adapters` import `core` and `shared`; the plugin
  never imports the server and the server never imports the plugin; the window imports `shared` only. Each tool and
  each op is apart from the others. `core/kernel` imports no other core domain. `pnpm check:deps` (dependency-cruiser)
  enforces all of this, cycles included, and that `shared`, `core`, `plugin` and `plugin-ui` use no Node module and no
  server-only package.
- No barrels: a class is imported from its own file.
- Only composition roots and the `main/` folders see the DI `Container`. Everything else asks for its dependencies as
  constructor defaults, `inject(TOKEN)`, by token, never by class.
- Every import of `src` goes through the `@/` alias from the root of `src/`; no `../` anywhere.
- No strings in code outside `.constants.ts` files: names, states, reasons and texts are `as const` objects there.
- Everything in `src/` is a class; inheritance is one level deep, from `Tool`, `Operation` or `Error` only.
- The server's stdout is MCP only; logs go to stderr and the shared log file through the `Logger` port.
- Data crossing a trust boundary (MCP, the bridge, files, the network) is parsed by its zod schema first.

## Where is the thing that...

**Runs a tool call.** The MCP SDK hands the call to `McpEndpoint`, which gives it to `ToolRunner`. The runner's chain,
outermost first: `ErrorTextStep`, `CallLogStep`, `TargetStep` (binds the call to a `PluginSession` when the tool takes
`file`), `OutputCheckStep`. `ContainerToolFactory` builds the tool in a child container per call, and the tool's
`execute` asks its session for ops. Each op passes the session's chain, `OpLogStep`, `OpTimerStep`, `OpResultStep`, and
reaches `PluginLink`, which is `PluginBridge`. On the owner, the request goes to the file's `BridgeSession` and out
through `PluginRpc` (birpc) on its socket. The window relays the frame: `SocketLink` to `WindowLink` to `MainChannel`,
then main's `UiChannel` to `ServerRpc`. `OperationRunner` runs the op through its chain, outermost first:
`ContractStep`, `EditsStep` (Allow edits), `FrameSizeStep`, `TurnStep` (the read/write turn), `WatchdogStep`.
`ContainerOperationFactory` builds the op in a child container; `Operation.run` calls the op's `execute` and wraps what
it returns or throws in the envelope through `OpReport`. The envelope goes back the same way.

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
port taken joins the owner as a peer (`PeerBridge`, `PeerJoin`, `OwnerClient`), shows the owner's files and runs its
ops through it. A newer server takes the bridge over and the older one is handed over for good. With neither,
`PluginBridge` stays unavailable and retries. `PIXELWRIGHT_PLUGIN_BRIDGE=off` binds `NoBridge`.

**Holds the tokens.** A class's token sits at the bottom of the class's own file; a port's token in its `x.port.ts`;
tokens of config values and multi-provider lists that belong to no class in a topic's or a root's `x.tokens.ts`
(`BRIDGE_SETTINGS`, `LOG_SETTINGS`, `LOG_DESTINATIONS`).

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

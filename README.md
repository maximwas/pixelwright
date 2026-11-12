# Pixelwright

An open-source MCP server that lets AI agents (Claude Code, Cursor, Codex) read the Figma files you have open in Figma
Desktop, through a Figma plugin, to build code from them: no REST API, no access token, no API rate limits, any Figma
plan. Its code is open under the MIT license. This version reads; editing comes back in 0.9.0.

[Docs](https://maximwas.github.io/pixelwright/) · [Changelog](https://maximwas.github.io/pixelwright/changelog/) · [npm](https://www.npmjs.com/package/pixelwright)

[![npm version](https://img.shields.io/npm/v/pixelwright)](https://www.npmjs.com/package/pixelwright)
[![npm downloads](https://img.shields.io/npm/dm/pixelwright)](https://www.npmjs.com/package/pixelwright)
[![License](https://img.shields.io/npm/l/pixelwright)](LICENSE)

> Unofficial. Not affiliated with or endorsed by Figma. "Figma" is a trademark of Figma, Inc.

## Quick start

Requires Node.js 24.11 or newer and Figma Desktop. Run the setup in a terminal:

```bash
npx -y pixelwright@latest setup
```

It connects Claude Code and Cursor, shows what to paste for Codex and other MCP clients, and puts the Figma plugin in
`~/.pixelwright/plugin`. Then, in Figma Desktop:

1. **Plugins → Development → Import plugin from manifest…** and pick `~/.pixelwright/plugin/manifest.json`, once.
   Figma loads the plugin from there every time you run it, and the setup puts the new one there on every update.
2. Open your file and run **Plugins → Development → Pixelwright**. Keep its small window open while you work.
3. The first time, the window asks for a pairing code: your agent shows it (from `status`); type it in.
4. Select a section in Figma and ask your agent to build it.

`npx -y pixelwright@latest setup --print` asks nothing: it puts the plugin in place and prints the commands and config
blocks, for scripts.

## Try it on the demo

[Open the Orbit demo in Figma](https://www.figma.com/design/JHfoyeEnpNChVEtjBGwhIo/Test-MCP?node-id=81-1541): a small
pricing site made for Pixelwright. Duplicate it to your drafts, run the plugin in your copy and ask your agent to read
it: three breakpoints, an A/B hero, a prototype flow, Dev Mode notes and measurements, variables and styles, and
components with variants, an exposed instance and a slot.

## How it works

```text
Claude Code ──stdio──► pixelwright ──ws://localhost:18720──► Pixelwright plugin ──Plugin API──► your Figma file
```

The plugin runs inside the file and answers the server on your computer. Every read goes through the Figma Plugin API,
so nothing reaches api.figma.com and no seat or plan limits the number of calls. Several files can be connected at
once; tools work on the one whose plugin window was in front last, or on the file you name.

## What it does

| Tool | What it is for |
| --- | --- |
| `status` | The connected files, which one tools use, and what to do when none is |
| `file_map`, `outline`, `nodes_find` | Every page with its frames and sections in one call; a frame's layer tree (instances name their component); layers by name, type, text, component or variant |
| `selection_get`, `selection_wait`, `viewport_get`, `node_show` | What the user picked, or waiting for them to pick; what they are looking at; showing layers, fitted or at a zoom |
| `changes_since` | What changed in the file since the plugin started watching, and by whom |
| `design_read` | A section as XML: Figma's layer types as tags, CSS as attributes, tokens as `var(--Name)`, assets as files; the designer's Dev Mode notes and measurements; prototype interactions; what an instance changed; what is ready for dev |
| `inspect`, `measure` | Layers as Figma has them, without code: layout and painted boxes, fills with their styles or variables, strokes, effects, a text's lines, overflow, interactions; the distances between layers |
| `nodes_diff`, `variants_read`, `breakpoints_find` | How one layer differs from another (A/B variants); a component's states as differences from its default; a screen at its other widths |
| `baseline_save`, `baseline_diff` | Keep a section as your code was built from it, in the project; later, what the designer changed since, in the XML's terms: layers, a component's change once, tokens in every mode |
| `flow_read` | The prototype as screens and the links between them, for an app's routes |
| `screenshot`, `image_compare`, `styles_compare` | A layer, or a region of it, as PNG; the same render compared with a PNG of your build; your build's computed styles against the design's, property by property |
| `assets_export` | Icons and images as files, originals included |
| `tokens_read`, `tokens_usage` | Variables with every mode, and styles, as token files; the layers a token is used on |
| `components_read`, `library_search` | The components a page uses or the file defines, with variants and properties; components in your team's libraries |
| `fonts_check` | The fonts a layer uses and where the build gets each |
| `execute` | Plugin code the agent writes (`code`, or `codePath`, a file of it), for what no tool here shows; or a `script` on the server that calls the read tools and joins their answers. It reads too (see Safety) |
| `types_read` | Each read's answer as TypeScript, for the agent's scripts |
| `guide` | What the agent reads before it starts: the workflow, the XML, tokens, assets and scripts |

A read of the Pro card from Orbit, abridged:

```xml
<Instance id="54:268" name="Plan – Pro" component="Plan Card" props="Price=$12, Popular=true, Description=For freelancers shipping fast., Name=Pro" note="The price comes from the billing API. Show the Popular badge only on the plan the API marks popular." display="flex" flex-direction="column" flex="1" padding="var(--space-32)" gap="var(--space-24)" border-radius="var(--radius-lg)" border="2px solid var(--color-brand)" background="var(--color-surface)" box-shadow="var(--Shadow-Card)" $on-click="go to Checkout – Desktop; dissolve 300ms ease-out">
  <Frame id="I54:268;54:203" name="Header" display="flex" align-self="stretch" justify-content="space-between" align-items="center" overflow="hidden">
    <Text id="I54:268;54:204" name="Name" textStyle="Heading/H3" color="var(--color-ink)">Pro</Text>
    <Instance id="I54:268;54:205" name="Badge" component="Badge" props="Label=Popular" display="flex" padding="var(--space-4) var(--space-12)" align-items="center" border-radius="var(--radius-pill)" background="var(--color-accent)">…</Instance>
  </Frame>
  …
  <Instance id="I54:268;54:211" name="Button" component="Button" variant="Variant=Primary, State=Default" props="Label=Get started" display="flex" align-self="stretch" padding="var(--space-12) var(--space-24)" justify-content="center" align-items="center" border-radius="var(--radius-md)" background="var(--color-brand)">
    <Text id="I54:268;54:211;54:190" name="Label" textStyle="Button" color="var(--color-on-brand)">Get started</Text>
  </Instance>
  <Frame id="I54:268;54:213" name="Features" display="flex" flex-direction="column" align-self="stretch" gap="var(--space-12)" overflow="hidden">
    <Frame id="I54:268;54:214" name="Feature" display="flex" align-items="center" gap="var(--space-8)" overflow="hidden">
      <Icon id="I54:268;54:215" name="Icon/Check" component="Icon/Check" src="assets/icon-check-4.svg" width="20px" height="20px"/>
      <Text id="I54:268;54:217" name="Text" textStyle="Body Small" color="var(--color-ink)">Unlimited projects</Text>
    </Frame>
    …
  </Frame>
</Instance>
```

## The guide

The agent reads `guide` before it starts: which tool to use when, the XML's tags, attributes and values, how tokens
are named, and what becomes a file. The [docs](https://maximwas.github.io/pixelwright/) show every topic in full, and
every tool with its arguments, as the server lists them.

## Safety

- **No REST API, no token.** The plugin reads the file through Figma's Plugin API, on your computer. The server
  listens on localhost only, and a plugin pairs once with a code you type in; unpaired windows get nothing.
- **This version reads.** Every tool reads, except `execute`, which runs plugin code the agent writes (or a script over the reads, which never writes), to read what no
  tool shows. **Allow edits** in the plugin window is off until you turn it on for a file; while it is off, the plugin
  refuses every write that code tries. Your choice is remembered per file on your computer. Ask for an edit, and your
  agent warns that editing is not supported in this version and goes on only when you say so.
- `execute` runs code the agent writes: use Pixelwright with agents you trust, as you would with their build scripts.
- **What is stored where.** `~/.pixelwright/` holds the plugin, the bridge's state (`bridge.json`), the shared log in
  `logs/`, npm's newest version (`latest.json`), the asset files written (`written-files.json`) and the library
  catalogues `library_search` saved (`libraries/`). Baselines go into the project's `.pixelwright/baselines/`. The
  plugin keeps its pairing key and your Allow edits choice in Figma's storage on your computer.
- **What goes online.** The server asks npm for the newest version once a day, and `fonts_check` asks Fontsource and
  Google Fonts which fonts they serve. The plugin's only network access is the server on localhost.

## Limits

- The file must be open in Figma Desktop with the plugin's window open. Figma slows plugins in background tabs: keep
  the file's tab in front during a long read.
- This version reads only. The tools that write to the file, and the design checks, come back in 0.9.0 and 0.10.0.
- Tested on macOS. On Windows the setup gives Claude Code `cmd /c npx …`, as its documentation asks; Windows itself is
  not tested yet.

## Commands

```text
pixelwright                 in a terminal: the setup; started by an MCP client: the MCP server on stdio
pixelwright setup           the setup: connects your MCP clients and puts the Figma plugin in place
pixelwright setup --print   no questions: the plugin put in place, the commands and config blocks printed
pixelwright serve           the MCP server, however it is started
pixelwright logs            follow the logs of every running server on this machine: tool calls, plugins, errors
pixelwright --version
```

`PIXELWRIGHT_HOME` moves `~/.pixelwright`; `CLAUDE_PROJECT_DIR` names the project (baselines, and relative paths when
the client gives no root); `PIXELWRIGHT_PLUGIN_BRIDGE=off` starts the server without the bridge;
`PIXELWRIGHT_NO_UPDATE_CHECK=1` stops asking npm for a newer version (see Updating); `PIXELWRIGHT_LOG_LEVEL=debug`
adds the bridge's details to the log.

## Updating

MCP clients start `pixelwright@latest`, so a client started again runs the newest server. The plugin is a copy on your
computer: run `npx -y pixelwright@latest setup` again (or `setup --print`) to put the matching one in
`~/.pixelwright/plugin`. Figma Desktop loads it the next time you run the plugin. When the plugin's window says the
protocol versions differ, this is the fix.

When a newer version is out, the plugin's window says so at the top. Close it, and it stays closed until the next
version. The server asks npm for the newest version once a day (the answer kept in `~/.pixelwright/latest.json`);
`PIXELWRIGHT_NO_UPDATE_CHECK=1` turns that off.

Every MCP client session runs its own server. The first one holds the bridge port and the others work through it, so
every client sees every connected file. A newer server takes the bridge over; the older one then asks you to restart
Pixelwright in its client (`/mcp` in Claude Code).

### From 0.7.0 to 0.8.0

- **Put the new plugin in place.** Run `npx -y pixelwright@latest setup` and run the plugin again: a 0.7.0 plugin
  cannot connect to 0.8.0, whose protocol changed. The plugin's path is the same, so you import nothing again.
- **Restart Pixelwright in every MCP client still open** (`/mcp` in Claude Code): a 0.7.0 server that keeps running
  keeps 0.7.0's answers.
- **0.8.0 reads.** The tools that wrote to the file, and the design checks, are gone until 0.9.0 and 0.10.0; `execute`
  stays, to read. Code Connect is gone too: the XML no longer carries your project's code for an instance.
- **An argument a tool does not name is an error now**, which names it; 0.7.0 ignored it.
- Baselines 0.7.0 saved still read: `baseline_diff` compares against them as they are.

## Development

```bash
pnpm install && pnpm build
pnpm -s gates          # lint, typecheck, test, build, size
pnpm plugin:install    # puts this build's plugin in its home folder, for Import plugin from manifest
pnpm build:docs        # the docs site in docs/, from this README, the tools, the guide and CHANGELOG.md
pnpm check:pack        # packs the package, installs it in an empty folder and runs it there
pnpm test:live         # the live tests (below)
```

Figma Desktop is not allowed to read the folders macOS protects (Desktop, Documents, Downloads) unless you grant it
access, and it loads a development plugin's code from disk on every run. `plugin:install` puts the plugin outside them,
so the repository can live anywhere. Run it again after every change to the plugin.

Until a release, every build is the dev channel `pixelwright-new`: port 18721, `~/.pixelwright-new` and a plugin named
Pixelwright New, so it runs beside the released Pixelwright without touching it.

### Live tests

The live tests in `test/live/` are in git and run against Figma itself: a copy of the Orbit demo named Test MCP, open
in Figma Desktop with this build's plugin running, its tab in front and Allow edits on. Each test makes its layers in
the Live tests section of the Start here page and deletes them; a change to Orbit's own layers goes through a copy.
CI cannot run them: `pnpm test:live` is part of done for every change to code that touches Figma.

### Releasing

`main` takes changes only through pull requests, with CI's `check` job passing. The version lives in `package.json`
alone. On a branch, set it, rename `## Unreleased` in `CHANGELOG.md` to `## 1.2.3 — <date>` and run `pnpm build:docs`;
open a pull request into `main`, merge it, then tag the merge commit:

```bash
git switch main && git pull
git tag -a v1.2.3 -m "Pixelwright 1.2.3" && git push origin v1.2.3
```

The Release workflow checks that the tag is `package.json`'s version, that `CHANGELOG.md` has its section and that the
build is the release channel, runs the gates and `check:pack`, and packs the package and the plugin zip with a
read-only token. A second job, which runs none of the project's code, publishes that package to npm (trusted
publishing, with provenance) and creates the GitHub release with the plugin zip and the section as its notes. A rerun
is safe: it skips npm when `npm view pixelwright@1.2.3 version` already answers, and the release when it exists.

npm shows a new version a minute or two after the run: check once with `npm view pixelwright version` rather than
polling. A 503 from npm while publishing is an npm outage: check status.npmjs.org, then rerun the failed job. npm
trusts the workflow as `maximwas/pixelwright`, `release.yml`, no environment; the repository URL in `package.json` must
match it exactly.

## Changelog

Every release, with its date and what changed: [CHANGELOG.md](CHANGELOG.md), also on the
[website](https://maximwas.github.io/pixelwright/changelog/).

## Feedback

Questions, ideas and what you built with Pixelwright go to
[GitHub Discussions](https://github.com/maximwas/pixelwright/discussions); bugs to
[issues](https://github.com/maximwas/pixelwright/issues/new/choose), whose form asks for the version, the MCP client, the
system and the lines `npx -y pixelwright@latest logs` shows around the problem.

## Support

Pixelwright is free and open source. If it saves you time, donate on [Ko-fi](https://ko-fi.com/maksymvasianin) or to a
[monobank jar](https://send.monobank.ua/jar/7o9oMrbXTj).

## License

[MIT](LICENSE): use it, change it and share it for anything, keeping the copyright and licence notice. The plugin's
bundles end with the licences of the packages they hold code of; the server bundles none (its dependencies install
from npm with their own).

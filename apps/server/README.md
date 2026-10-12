# Pixelwright

An MCP server that lets AI agents (Claude Code, Cursor, Codex) read and edit the Figma files you have open in Figma
Desktop, through a Figma plugin: no REST API, no access token, no API rate limits, any Figma plan.

[Website](https://maximwas.github.io/pixelwright/) · [Docs](https://maximwas.github.io/pixelwright/docs/) · [npm](https://www.npmjs.com/package/pixelwright)

> Unofficial. Not affiliated with or endorsed by Figma. "Figma" is a trademark of Figma, Inc.

## Quick start

Requires Node.js 24.11 or newer and Figma Desktop. Run the setup in a terminal:

```bash
npx -y pixelwright@latest
```

It adds Pixelwright to Claude Code, Cursor or Codex, and puts the Figma plugin in `~/.pixelwright/plugin`. Then, in
Figma Desktop:

1. **Plugins → Development → Import plugin from manifest…** and pick `~/.pixelwright/plugin/manifest.json` (once; the
   Community listing will replace this step).
2. Open your file and run **Plugins → Development → Pixelwright**. Keep its small window open while you work.
3. The first time, the window asks for a pairing code: your agent shows it (from `status`); type it in.
4. Ask your agent to read a section, or turn on **Allow edits** in the window and ask it to change something.

`npx pixelwright setup --print` prints the commands and config blocks instead, for scripts and CI.

## How it works

```text
Claude Code ──stdio──► pixelwright ──ws://localhost:18720──► Pixelwright plugin ──Plugin API──► your Figma file
```

The plugin runs inside the file and answers the server on your computer. Every read and write goes through the Figma
Plugin API, so nothing reaches api.figma.com and no seat or plan limits the number of calls. Several files can be
connected at once; tools work on the one whose plugin window was in front last, or on the file you name.

## What it does

| Tool | What it is for |
| --- | --- |
| `status` | The connected files, which one tools use, and what to do when none is |
| `selection_get`, `node_show`, `nodes_find`, `outline` | What the user picked, showing a layer, finding layers, a frame's layer tree |
| `design_read` | A section as XML: Figma's layer types as tags, CSS as attributes, tokens as `var(--Name)`, assets as files |
| `screenshot`, `assets_export` | A layer as PNG to compare with; icons and images as SVG, PNG, JPG or PDF, originals included |
| `tokens_read`, `components_read` | Variables with every mode and styles, as CSS or JSON; the components a page uses, with variants and properties |
| `code_connect_read` | The project's Figma Code Connect templates, what each connects, what has none |
| `design_apply` | The same XML written back: change layers by id, create new ones, instances, components and variants, images |
| `tokens_apply` | Variables (collections, modes, aliases) and styles, in `tokens_read`'s shape |
| `nodes_delete`, `execute` | Delete layers; run plugin code for what the XML cannot say |
| `guide` | The XML format, writing, tokens, assets, Code Connect and HTML email, for the agent |

A read of the Positivus template's card, abridged:

```xml
<Frame id="2:4870" name="Card" display="flex" width="600px" padding="50px" justify-content="space-between" align-items="center" overflow="hidden" border-radius="45px" border="1px solid var(--Dark)" background="var(--Grey)" box-shadow="0 5px 0 0 #191A23">
  <Frame id="2:4871" name="Heading and link" display="flex" flex-direction="column" justify-content="center" gap="93px">
    <Instance id="2:4872" name="Heading" component="Heading" variant="Property 1=Green" display="flex" flex-direction="column">
      <Frame id="I2:4872;330:291" name="Label" display="flex" flex-direction="column" padding="0 7px" border-radius="7px" background="var(--Green)">
        <Text id="I2:4872;330:292" name="Label" textStyle="h3" color="#000">Search engine</Text>
      </Frame>
      …
    </Instance>
    …
  </Frame>
  <Frame id="2:4874" name="Illustration" width="210px" height="170px">
    <Image id="2:4875" name="tokyo-magnifier-web-search-with-elements 2" src="assets/tokyo-magnifier-web-search-with-elements-2.png" position="absolute" left="0" top="2px" width="210px" height="166px"/>
  </Frame>
</Frame>
```

Sending that XML back changes nothing; changing an attribute changes exactly that, in one undo step.

## Code Connect

Pixelwright runs your project's [Figma Code Connect](https://www.figma.com/developers/code-connect) templates
(`*.figma.ts`, written as Figma documents them) itself, on any plan, without publishing anything. `design_read` then
gives each connected instance as `$code` in the XML with its code and imports:

```json
{ "ids": ["2:4872"], "component": "Heading", "snippet": "<Heading tone=\"green\">Search engine optimization</Heading>",
  "imports": ["import { Heading } from \"@/components/Heading\""] }
```

See [examples/positivus](https://github.com/maximwas/pixelwright/tree/main/examples/positivus) in the repository for two templates and
how they match. The project folder is `CLAUDE_PROJECT_DIR`, else the folder your MCP client starts the server in.

## Safety

- **Allow edits** in the plugin window is off until you turn it on for a file; while it is off, the plugin refuses
  every write, whatever the agent asks. Your choice is remembered per file on your computer.
- Each tool call that writes is one undo step in Figma (⌘Z / Ctrl+Z). `design_apply` and `tokens_apply` take
  `dryRun` to check a change without writing it.
- The server listens on localhost only, and a plugin pairs once with a code you type in; unpaired windows get nothing.
- `execute` runs plugin code the agent writes, and Code Connect templates run as your project's code: use Pixelwright
  in projects and with agents you trust, as you would their build scripts.

## Limits

- The file must be open in Figma Desktop with the plugin's window open; writing needs edit access to it.
- Figma takes images up to 4096 px a side, in PNG, JPG or GIF.
- A library's component the file does not use yet is placed by its key (`component="key:…"`): the Plugin API cannot
  search a library's components.

## Commands

```text
pixelwright                 in a terminal: the setup; started by an MCP client: the MCP server on stdio
pixelwright setup --print   the commands and config blocks, for scripts and CI
pixelwright serve           the MCP server, however it is started
pixelwright --version
```

`PIXELWRIGHT_HOME` moves `~/.pixelwright` (the plugin, pairing keys, written-files.json); `CLAUDE_PROJECT_DIR` names the
project for Code Connect.

## License

FSL-1.1-MIT. The bundled third-party packages' licences ship in the npm package (`dist/THIRD-PARTY-NOTICES.md`, and
`*.LICENSE.txt` beside the plugin's bundles).

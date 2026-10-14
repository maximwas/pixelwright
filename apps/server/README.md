# Pixelwright

An MCP server that lets AI agents (Claude Code, Cursor, Codex) read and edit the Figma files you have open in Figma
Desktop, through a Figma plugin: no REST API, no access token, no API rate limits, any Figma plan.

[Website](https://maximwas.github.io/pixelwright/) · [Docs](https://maximwas.github.io/pixelwright/docs/) · [Changelog](https://maximwas.github.io/pixelwright/changelog/) · [npm](https://www.npmjs.com/package/pixelwright)

> Unofficial. Not affiliated with or endorsed by Figma. "Figma" is a trademark of Figma, Inc.

## Quick start

Requires Node.js 24.11 or newer and Figma Desktop. Run the setup in a terminal:

```bash
npx -y pixelwright@latest
```

It connects Claude Code and Cursor, shows what to paste for Codex and other MCP clients, and puts the Figma plugin in
`~/.pixelwright/plugin`. Then, in Figma Desktop:

1. **Plugins → Development → Import plugin from manifest…** and pick `~/.pixelwright/plugin/manifest.json`, once.
   Figma loads the plugin from there every time you run it, and the setup puts the new one there on every update. (The
   plugin is not on the Figma Community: Figma does not list plugins that overlap its own MCP server.)
2. Open your file and run **Plugins → Development → Pixelwright**. Keep its small window open while you work.
3. The first time, the window asks for a pairing code: your agent shows it (from `status`); type it in.
4. Ask your agent to read a section, or turn on **Allow edits** in the window and ask it to change something.

`npx -y pixelwright@latest setup --print` asks nothing: it puts the plugin in place and prints the commands and config
blocks, for scripts.

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
| `file_map`, `outline`, `nodes_find` | Every page with its frames and sections in one call; a frame's layer tree (instances name their component); layers by name, type, text or component |
| `selection_get`, `selection_wait`, `viewport_get`, `node_show` | What the user picked, or waiting for them to pick; what they are looking at; showing layers, fitted or at a zoom |
| `changes_since` | What the designer changed since the agent last looked, by whom |
| `design_read` | A section as XML: Figma's layer types as tags, CSS as attributes, tokens as `var(--Name)`, assets as files; the designer's Dev Mode notes, pinned properties and measurements; Figma Motion as CSS keyframes; what an instance changed outside its component's properties; what is ready for dev |
| `inspect`, `measure` | Layers as Figma has them, without code: layout and painted boxes, the fill with its style or variables, how strokes paint, every effect's parameters, a text's lines and line heights, overflow, interactions; the distances between layers |
| `nodes_diff`, `variants_read`, `breakpoints_find` | How one layer differs from another (A/B variants); a component's states as differences from its default; a screen at its other widths |
| `baseline_save`, `baseline_diff` | Keep a section as your code was built from it, in the project; later, what the designer changed since, in the XML's terms: layers, a component's change once, tokens in every mode, icons to export again |
| `flow_read` | The prototype as screens and the links between them, for an app's routes |
| `screenshot`, `image_compare` | A layer, or a region of it, as PNG, in a variable mode if you like; the same render compared with a PNG of your build (rmse, differing pixels, edges off by N px) |
| `assets_export` | Icons and images as SVG, PNG, JPG, WebP or PDF, sized by a CSS width if you like, originals included |
| `tokens_read`, `tokens_usage`, `components_read` | Variables with every mode and styles, as CSS, JSON or DTCG token files; the layers a token is used on; the components a page uses, with variants and properties |
| `design_audit`, `contrast_check`, `fonts_check` | The scale a design uses and what is off it; every text's WCAG contrast; where the build gets each font |
| `code_connect_read` | The project's Figma Code Connect templates, what each connects, what has none |
| `design_apply` | The same XML written back: change layers by id, create new ones, instances, components and variants, images; a named version in Figma's history first, when asked |
| `tokens_apply` | Variables (collections, modes, aliases) and styles, in `tokens_read`'s shape |
| `version_save` | A named version in Figma's history, with the baselines it goes with, when you ask for one |
| `nodes_delete`, `execute` | Delete layers; run plugin code for what the XML cannot say |
| `guide` | The XML format, writing, tokens, assets, Code Connect and HTML email, for the agent |

A read of the Pro card from Orbit, the demo the tests run on, abridged:

```xml
<Instance id="54:268" name="Plan – Pro" component="Plan Card" props="Price=$12, Popular=true, Description=For freelancers shipping fast., Name=Pro" note="The price comes from the billing API. Show the Popular badge only on the plan the API marks popular." display="flex" flex-direction="column" width="385px" height="394px" padding="var(--space-32)" gap="var(--space-24)" border-radius="var(--radius-lg)" border="2px solid var(--color-brand)" background="var(--color-surface)" box-shadow="var(--Shadow-Card)" $on-click="go to Checkout – Desktop; dissolve 300ms ease-out">
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
      <Icon id="I54:268;54:215" name="Icon/Check" component="Icon/Check" src="assets/icon-check.svg" width="20px" height="20px"/>
      <Text id="I54:268;54:217" name="Text" textStyle="Body Small" color="var(--color-ink)">Unlimited projects</Text>
    </Frame>
    …
  </Frame>
</Instance>
```

Sending that XML back changes nothing; changing an attribute changes exactly that, in one undo step.

## Code Connect

Pixelwright runs your project's [Figma Code Connect](https://www.figma.com/developers/code-connect) templates
(`*.figma.ts`, written as Figma documents them) itself, on any plan, without publishing anything. `design_read` then
gives each connected instance as `$code` in the XML with its code and imports:

```json
{ "ids": ["54:268"], "component": "Plan Card",
  "snippet": "<PlanCard name=\"Pro\" price=\"$12\" popular>\n  <Button variant=\"primary\">Get started</Button>\n</PlanCard>",
  "imports": ["import { PlanCard } from \"@/components/PlanCard\"", "import { Button } from \"@/components/Button\""] }
```

See [examples/orbit](https://github.com/maximwas/pixelwright/tree/main/examples/orbit) in the repository for two
templates, one rendering the other inside it, and how they match. The project folder is `CLAUDE_PROJECT_DIR`, else the folder your MCP client starts the server in.

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
- Tested on macOS. On Windows the setup gives Claude Code `cmd /c npx …`, as its documentation asks; Windows itself is
  not tested yet.

## Commands

```text
pixelwright                 in a terminal: the setup; started by an MCP client: the MCP server on stdio
pixelwright setup --print   no questions: the plugin put in place, the commands and config blocks printed
pixelwright serve           the MCP server, however it is started
pixelwright logs            follow the logs of every running server on this machine: tool calls, plugins, errors
pixelwright --version
```

`PIXELWRIGHT_HOME` moves `~/.pixelwright` (the plugin, pairing keys, written-files.json, the shared log in `logs/`);
`CLAUDE_PROJECT_DIR` names the project for Code Connect; `PIXELWRIGHT_SUPPORT_REMINDERS=off` turns off the weekly
support note (see Support); `PIXELWRIGHT_LOG_LEVEL=debug` adds the bridge's details to the log.

## Updating

MCP clients start `pixelwright@latest`, so a client started again runs the newest server. The plugin is a copy on your
computer: run `npx -y pixelwright@latest` again (or `setup --print`) to put the matching one in `~/.pixelwright/plugin`.
Figma Desktop loads it the next time you run the plugin. When the plugin's window says the protocol versions differ,
this is the fix.

Every MCP client session runs its own server, and they share one bridge port. When a newer server starts while an older
one (another client's, still open) holds the port, the older one hands the port over and switches its bridge off: its
status then asks you to restart Pixelwright in that client (`/mcp` in Claude Code). A plugin turned away by an older
server keeps trying, and connects once the newer one holds the port.

## Changelog

Every release, with its date and what changed: [CHANGELOG.md](https://github.com/maximwas/pixelwright/blob/main/CHANGELOG.md),
also on the [website](https://maximwas.github.io/pixelwright/changelog/).

## Feedback

Questions, ideas and what you built with Pixelwright go to
[GitHub Discussions](https://github.com/maximwas/pixelwright/discussions); bugs to
[issues](https://github.com/maximwas/pixelwright/issues/new/choose), whose form asks for the version, the MCP client, the
system and the lines `npx -y pixelwright@latest logs` shows around the problem. The plugin's window links there too.

## Support

Pixelwright is free, and its code is public. If it saves you time, donate on [Ko-fi](https://ko-fi.com/maksymvasianin) or to a
[monobank jar](https://send.monobank.ua/jar/7o9oMrbXTj). At most once a week, after a change that worked, your agent may
mention it; turn that off with `PIXELWRIGHT_SUPPORT_REMINDERS=off`.

## License

[FSL-1.1-MIT](https://github.com/maximwas/pixelwright/blob/main/LICENSE), the Functional Source License with an MIT
future license. Use Pixelwright for anything, at work and for clients, and change it for your own use; do not build a
competing product or service from its code. Each version becomes MIT two years after its release. The bundled
third-party packages' licences ship in the package (`dist/THIRD-PARTY-NOTICES.md`) and at the end of the plugin's
bundles.

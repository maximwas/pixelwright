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

### Added

- A changelog: every release with its date and what changed, in CHANGELOG.md and on the website.
- Feedback has a home: GitHub Discussions for questions, ideas and what you built, and issue forms for bugs and feature
  requests. The plugin window, the READMEs and the website link there.
- A Code Connect example for a button and a pricing card, the card showing its button through the button's own
  template.

### Changed

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

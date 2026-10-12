# Publishing the plugin to the Figma Community

The plugin is published by hand, from Figma Desktop (Plugins → Development → Pixelwright → Publish), with the build
the release workflow attaches to the GitHub release (or `pnpm --filter @pixelwright/plugin build`). Until the listing
exists, people import `~/.pixelwright/plugin/manifest.json`, which `npx pixelwright` puts there.

## Before the first publish

- [ ] The listing's name, tagline and description below, checked against the README.
- [ ] An icon (128 × 128) and a cover (1920 × 960) made for Pixelwright, not taken from a test file.
- [ ] Figma gives the plugin a numeric id on publish: put it in `package.json` → `figma-plugin.id` (it is `pixelwright`
      for development imports), rebuild, and release so the npm package carries the same id.
- [ ] Network access: the manifest allows only `ws://localhost:18720`, with its reasoning. Confirm Figma's review
      accepts a localhost WebSocket (other published MCP bridges use one).
- [ ] `execute` runs code the agent sends inside the plugin. If review refuses a plugin that evaluates code, publish a
      build without it and keep `execute` in the build imported from the manifest (spec, section 16).
- [ ] Try the published build once in a fresh Figma account: pairing, a read, Allow edits, a write, undo.
- [ ] Licences: each bundle ends with the licences of the packages it carries (apps/plugin/build-licenses.js), so the
      published build carries them; nothing to add by hand.

## Listing

**Name:** Pixelwright — MCP for Figma

**Tagline:** Let your AI agent read and edit the file you have open.

**Description:**

Pixelwright connects AI coding agents (Claude Code, Cursor, Codex and other MCP clients) to the Figma file you have
open. Run `npx -y pixelwright@latest` in a terminal, open this plugin in your file, and your agent can:

- read a section as XML with CSS, tokens and assets, ready to build with your own components;
- read your variables, styles and components;
- change the file with the same XML, create components and variants, and write tokens, when you allow it;
- turn instances into your code with your Figma Code Connect templates, on any plan.

The plugin talks only to the Pixelwright server on your computer (localhost), after you pair them once with a code.
Nothing goes to Figma's REST API and no token is needed. Writing is off until you turn on Allow edits in the plugin's
window, and each change is one undo step.

Pixelwright is free: https://github.com/maximwas/pixelwright. It is not made by or affiliated
with Figma. If it saves you time, you can support it on Ko-fi (https://ko-fi.com/maksymvasianin) or with a monobank jar
(https://send.monobank.ua/jar/7o9oMrbXTj).

**Tags:** developer tools, MCP, AI, code, design to code, tokens

**Support contact:** the GitHub repository's issues.

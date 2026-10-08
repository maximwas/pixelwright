# Pixelwright

An MCP server that lets AI agents (Claude Code, Cursor, Codex) read and edit Figma files through a Figma plugin: no
REST API, no access token, no seat quota.

> Unofficial. Not affiliated with or endorsed by Figma. "Figma" is a trademark of Figma, Inc.

Status: in development, nothing is published yet.

## How it works

The Pixelwright plugin runs in the file you have open in Figma Desktop and connects to the Pixelwright MCP server on
your computer (`ws://localhost:18720`). Every read and write goes through the Figma Plugin API inside that file, so
nothing reaches api.figma.com.

## Development

```bash
pnpm install && pnpm build
pnpm lint && pnpm typecheck && pnpm test
pnpm dev:plugin   # then in Figma Desktop: Plugins → Development → Import plugin from manifest → apps/plugin/manifest.json
```

## License

[FSL-1.1-MIT](LICENSE)

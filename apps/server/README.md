# Pixelwright

An MCP server that lets AI agents (Claude Code, Cursor, Codex) read and edit Figma files through a Figma plugin: no
REST API, no access token, no seat quota.

> Unofficial. Not affiliated with or endorsed by Figma. "Figma" is a trademark of Figma, Inc.

The Pixelwright plugin runs in the file you have open in Figma Desktop and connects to this server on your computer
(`ws://localhost:18720`). Every read and write goes through the Figma Plugin API inside that file, so nothing reaches
api.figma.com.

Status: in development, nothing is published yet.

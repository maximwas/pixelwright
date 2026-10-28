// `pnpm build` (after the server's tsdown): the Figma plugin of this build's channel into dist/plugin: main.js,
// ui.html and manifest.json. Runs under tsx, which reads the tsconfig's `@/` paths.
import { fileURLToPath } from "node:url";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { PluginBuild } from "./plugin/plugin-build.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

await new PluginBuild(root, fileURLToPath(new URL("../dist/plugin", import.meta.url))).run(CHANNEL);

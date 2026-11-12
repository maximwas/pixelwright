// Puts the Figma plugin's build (apps/plugin: manifest.json and build/) into dist/plugin, so the npm package carries
// it and the setup can copy it where Figma Desktop imports it from. The plugin is built first (the root build does so).
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const plugin = fileURLToPath(new URL("../../plugin/", import.meta.url));
const target = fileURLToPath(new URL("../dist/plugin/", import.meta.url));

if (!existsSync(`${plugin}manifest.json`) || !existsSync(`${plugin}build/main.js`)) {
  throw new Error("The Figma plugin is not built: run pnpm --filter @pixelwright/plugin build first.");
}

rmSync(target, {
  recursive: true,
  force: true,
});
cpSync(`${plugin}manifest.json`, `${target}manifest.json`);
cpSync(`${plugin}build`, `${target}build`, { recursive: true });

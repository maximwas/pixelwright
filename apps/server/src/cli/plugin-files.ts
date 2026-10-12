import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where this copy of Pixelwright keeps the Figma plugin: dist/plugin inside the npm package, apps/plugin in the
 * repository; null when neither has a built one.
 */
export function packagedPlugin(): string | null {
  for (const candidate of [new URL("./plugin/", import.meta.url), new URL("../../../plugin/", import.meta.url)]) {
    const folder = fileURLToPath(candidate);

    if (existsSync(join(folder, "manifest.json")) && existsSync(join(folder, "build"))) {
      return folder;
    }
  }

  return null;
}

/**
 * Copies the plugin (its manifest and build) to `to`, where Figma Desktop can import it from (Figma cannot read every
 * folder, such as ~/Desktop on macOS); an older copy there is replaced. Resolves with the manifest's path.
 */
export async function installPlugin(from: string, to: string): Promise<string> {
  if (!existsSync(join(from, "manifest.json"))) {
    throw new Error(`No plugin in ${from} (manifest.json is missing): reinstall pixelwright, or build the plugin.`);
  }

  await rm(to, {
    recursive: true,
    force: true,
  });
  await mkdir(to, { recursive: true });
  await cp(join(from, "manifest.json"), join(to, "manifest.json"));
  await cp(join(from, "build"), join(to, "build"), { recursive: true });

  return join(to, "manifest.json");
}

import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLUGIN_MANIFEST_NAME } from "../constants/clients.ts";

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
 * folder, such as ~/Desktop on macOS). An older copy there is replaced; a folder holding anything else is left alone.
 * The Pixelwright folder around it, which also keeps the pairing keys, is made for its owner only. Resolves with the
 * manifest's path.
 */
export async function installPlugin(from: string, to: string): Promise<string> {
  if (!existsSync(join(from, "manifest.json"))) {
    throw new Error(`No plugin in ${from} (manifest.json is missing): reinstall pixelwright, or build the plugin.`);
  }

  await refuseOtherFiles(to);
  await mkdir(dirname(to), {
    recursive: true,
    mode: 0o700,
  });
  await rm(to, {
    recursive: true,
    force: true,
  });
  await mkdir(to, { recursive: true });
  await cp(join(from, "manifest.json"), join(to, "manifest.json"));
  await cp(join(from, "build"), join(to, "build"), { recursive: true });

  return join(to, "manifest.json");
}

/** Throws unless `to` is missing, empty, or an older copy of the plugin (its manifest names it). */
async function refuseOtherFiles(to: string): Promise<void> {
  if (!existsSync(to)) {
    return;
  }

  const entries = await readdir(to);

  if (entries.length === 0) {
    return;
  }

  try {
    const manifest: unknown = JSON.parse(await readFile(join(to, "manifest.json"), "utf8"));

    if (typeof manifest === "object" && manifest !== null && "name" in manifest) {
      if (manifest.name === PLUGIN_MANIFEST_NAME) {
        return;
      }
    }
  } catch {
    // No readable manifest: not a copy of the plugin.
  }

  throw new Error(
    `${to} is not a Pixelwright plugin folder (it holds ${entries.slice(0, 3).join(", ")}${entries.length > 3 ? ", …" : ""}), so it was left as it is: move those files, or set PIXELWRIGHT_HOME to another folder.`,
  );
}

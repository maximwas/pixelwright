import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Metafile } from "esbuild";

/** The package folder in a bundled input's path: the last node_modules, as pnpm nests them under .pnpm/<id>/. */
const PACKAGE_PATH = /^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//;
const LICENCE_FILE = /^licen[cs]e/i;

export const NOTICES_HEADER = "Third-party software in this bundle of the Pixelwright Figma plugin.";

/**
 * The licence notices of every package a plugin bundle holds code of (P-063): MIT and its kin ask that their notice
 * go with every copy, and a Figma plugin ships as its bundles alone. Read from esbuild's metafile, so a package tree
 * shaking dropped is not named. No maintained esbuild package does this (esbuild-plugin-license 1.2.3 is from 2024).
 */
export class PluginNotices {
  readonly #root: string;

  /** `root`: the folder esbuild ran in, which the metafile's input paths are relative to. */
  constructor(root: string) {
    this.#root = root;
  }

  text(metafile: Metafile): string {
    const packages = new Map<string, string>();
    const kept = Object.values(metafile.outputs).flatMap((output) => Object.entries(output.inputs));

    for (const [input, { bytesInOutput }] of kept) {
      const match = PACKAGE_PATH.exec(input);

      if (bytesInOutput > 0 && match?.[1] !== undefined && match[2] !== undefined && !packages.has(match[2])) {
        packages.set(match[2], resolve(this.#root, match[1]));
      }
    }

    const sections = [...packages]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, folder]) => this.#section(name, folder));

    return `${NOTICES_HEADER}\n\n${sections.join("\n")}`;
  }

  /** The notices as a comment at the end of a script: `*\/` would end the comment early, `</` an inline script. */
  comment(text: string): string {
    return `\n/*!\n${text.replaceAll("*/", "* /").replaceAll("</", "<\\/")}*/\n`;
  }

  #section(name: string, folder: string): string {
    const { version, license } = JSON.parse(readFileSync(join(folder, "package.json"), "utf8"));
    const file = readdirSync(folder).find((entry) => LICENCE_FILE.test(entry));
    const text =
      file === undefined
        ? `${license ?? "No licence"} (no licence file in the package)`
        : readFileSync(join(folder, file), "utf8").trim();

    return `## ${name}\n\n${version}, ${license ?? "unknown licence"}\n\n${text}\n`;
  }
}

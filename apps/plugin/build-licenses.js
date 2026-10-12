import { appendFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * An esbuild plugin that puts the licence of every package a bundle carries code from at the end of the bundle, and
 * beside it as `<bundle>.LICENSE.txt`: MIT and its kin ask that their notice go with every copy, and the Figma
 * Community takes only the manifest and the bundles. No maintained package does this for esbuild
 * (esbuild-plugin-license had its last release in 2024 and a few hundred downloads a week).
 */
export function licenses() {
  return {
    name: "pixelwright-licenses",
    setup(build) {
      build.initialOptions.metafile = true;
      build.onEnd((result) => {
        if (result.errors.length > 0 || result.metafile === undefined || build.initialOptions.outfile === undefined) {
          return;
        }

        const cwd = build.initialOptions.absWorkingDir ?? process.cwd();
        const packages = new Map();

        // What each output kept, not every file esbuild read: tree shaking drops whole packages.
        const kept = Object.values(result.metafile.outputs).flatMap((output) =>
          Object.entries(output.inputs)
            .filter(([, { bytesInOutput }]) => bytesInOutput > 0)
            .map(([input]) => input),
        );

        for (const input of kept) {
          // The last node_modules in the path: pnpm keeps packages under node_modules/.pnpm/<id>/node_modules/<name>.
          const match = /^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//.exec(input);

          if (match !== null && !packages.has(match[2])) {
            packages.set(match[2], resolve(cwd, match[1]));
          }
        }

        const sections = [...packages]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, folder]) => {
            const { version, license } = JSON.parse(readFileSync(join(folder, "package.json"), "utf8"));
            const file = readdirSync(folder).find((entry) => /^licen[cs]e/i.test(entry));
            const text =
              file === undefined
                ? `${license ?? "No licence"} (no licence file in the package)`
                : readFileSync(join(folder, file), "utf8").trim();

            return `## ${name}\n\n${version}, ${license ?? "unknown licence"}\n\n${text}\n`;
          });
        const notice = `Third-party software in this bundle of the Pixelwright Figma plugin.\n\n${sections.join("\n")}`;
        const outfile = build.initialOptions.outfile;

        writeFileSync(`${outfile}.LICENSE.txt`, notice);
        // A comment the minifier never sees: esbuild has written the bundle by now. "*/" inside would end it early.
        appendFileSync(outfile, `\n/*!\n${notice.replaceAll("*/", "* /")}*/\n`);
      });
    },
  };
}

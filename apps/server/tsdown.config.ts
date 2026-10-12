import { readFileSync } from "node:fs";
import license from "rollup-plugin-license";
import { defineConfig } from "tsdown";

/** Code adapted into the server rather than bundled from a package, so rollup-plugin-license cannot find it. */
const ADAPTED = [
  {
    name: "@figma/code-connect",
    about:
      "2.0.1, MIT; adapted, not bundled: the React helpers of the Code Connect runtime (src/code-connect/react-helpers.ts)",
    licenseText: readFileSync(new URL("./licenses/figma-code-connect.txt", import.meta.url), "utf8"),
  },
];

export default defineConfig({
  entry: ["src/bin.ts"],
  platform: "node",
  target: "node24",
  format: "esm",
  dts: false,
  sourcemap: true,
  clean: true,
  deps: {
    alwaysBundle: ["@pixelwright/core"],
  },
  plugins: [
    // The licences of the packages bundled in (core's dependencies), which MIT and its kin ask to go with every copy.
    license({
      thirdParty: {
        output: {
          file: "dist/THIRD-PARTY-NOTICES.md",
          template: (dependencies) =>
            [
              "# Third-party software in the pixelwright server bundle",
              "",
              ...dependencies.map(
                ({ name, version, license: kind, licenseText }) =>
                  `## ${name}\n\n${version}, ${kind ?? "unknown licence"}\n\n${(licenseText ?? "").trim()}\n`,
              ),
              ...ADAPTED.map(({ name, about, licenseText }) => `## ${name}\n\n${about}\n\n${licenseText.trim()}\n`),
            ].join("\n"),
        },
      },
    }),
  ],
});

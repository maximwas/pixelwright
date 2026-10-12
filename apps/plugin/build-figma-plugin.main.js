import { importingEntry } from "./build-entry.js";
import { licenses } from "./build-licenses.js";

// The main thread is built for esbuild's neutral platform, which reads no package.json "main": slugify has only that.
export default function main(options) {
  return {
    ...importingEntry(options),
    mainFields: ["module", "main"],
    plugins: [...(options.plugins ?? []), licenses()],
  };
}

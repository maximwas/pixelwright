import { importingEntry } from "./build-entry.js";
import { licenses } from "./build-licenses.js";

export default function ui(options) {
  return {
    ...importingEntry(options),
    plugins: [...(options.plugins ?? []), licenses()],
  };
}

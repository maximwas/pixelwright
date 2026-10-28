// Planted: a manifest that loads its tool with a relative dynamic import() and re-exports it with a relative
// export … from. Refused by imports/no-relative-path, which no-relative-import-paths cannot see.
export { BetaTool } from "./beta.tool.ts";

export const BETA_MANIFEST = {
  load: async () => (await import("./beta.tool.ts")).BetaTool,
};

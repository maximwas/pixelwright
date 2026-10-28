import { defineConfig } from "vitest/config";

// old/ is fenced off: no include reaches it, and the exclude keeps it so if an include ever widens.
const exclude = ["old/**", "node_modules/**", "dist/**"];
// needle-di's @injectable() as a legacy decorator (tsconfig.base.json says why); oxc does not read it from tsconfig.
const oxc = { decorator: { legacy: true } };
// The `@/` alias of tsconfig.base.json; each project is its own config, so each one turns it on.
const resolve = { tsconfigPaths: true };

export default defineConfig({
  test: {
    projects: [
      {
        oxc,
        resolve,
        test: {
          name: "unit",
          include: [
            "src/**/*.test.ts",
            "scripts/**/*.test.ts",
            "test/golden/**/*.golden.test.ts",
            "test/guards/**/*.test.ts",
          ],
          exclude,
        },
      },
      { oxc, resolve, test: { name: "contract", include: ["test/contract/**/*.contract.test.ts"], exclude } },
      // Real Figma (Test MCP), local only: one file at a time, and writing tests never retry.
      {
        oxc,
        resolve,
        test: {
          name: "live",
          include: ["test/live/**/*.live.test.ts"],
          globalSetup: ["test/live/live.setup.ts"],
          exclude,
          fileParallelism: false,
          retry: 0,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});

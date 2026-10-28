import { defineConfig } from "vitest/config";

// old/ is fenced off: no include reaches it, and the exclude keeps it so if an include ever widens.
const exclude = ["old/**", "node_modules/**", "dist/**"];

export default defineConfig({
  test: {
    projects: [
      {
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
      {
        test: {
          name: "contract",
          include: ["test/contract/**/*.contract.test.ts"],
          exclude,
        },
      },
      // Real Figma (Test MCP), local only: one file at a time, and writing tests never retry.
      {
        test: {
          name: "live",
          include: ["test/live/**/*.live.test.ts"],
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

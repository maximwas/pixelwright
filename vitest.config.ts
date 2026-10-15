import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "core",
          root: "packages/core",
          environment: "node",
          include: ["test/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "server",
          root: "apps/server",
          environment: "node",
          include: ["test/**/*.test.ts"],
        },
      },
      // Root stays at the repo root, so vitest never reads the plugin package's build config.
      {
        test: {
          name: "plugin",
          environment: "node",
          include: ["apps/plugin/test/**/*.test.ts"],
        },
      },
    ],
  },
});

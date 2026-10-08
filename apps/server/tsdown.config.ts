import { defineConfig } from "tsdown";

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
});

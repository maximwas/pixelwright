import { defineConfig } from "tsdown";

// The server and CLI bundle (A§11.3): dependencies stay external, each tool's code lands in a lazy chunk.
export default defineConfig({
  entry: ["src/cli/bin.ts"],
  platform: "node",
  target: "node24",
  format: "esm",
  dts: false,
  sourcemap: true,
  clean: true,
  // The server config extends tsconfig.base.json, whose experimentalDecorators lowers @injectable().
  tsconfig: "tsconfig.server.json",
  // The guide's topics are Markdown files, inlined as strings: the npm package ships dist/ alone.
  loader: { ".md": "text" },
});

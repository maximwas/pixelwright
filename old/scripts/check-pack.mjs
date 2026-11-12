// Packs the server the way `npm publish` would, installs the tarball into an empty folder and checks it works there:
// the CLI, the MCP server on stdio with no Figma plugin around, and the files the package must carry (the Figma
// plugin's build and the licences of what is bundled).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PACKAGE = "pixelwright";
const PROTOCOL_VERSION = "2025-11-25";
const CARRIED = [
  "README.md",
  "LICENSE",
  "dist/THIRD-PARTY-NOTICES.md",
  "dist/plugin/manifest.json",
  "dist/plugin/build/main.js",
  "dist/plugin/build/main.js.LICENSE.txt",
  "dist/plugin/build/ui.js",
  "dist/plugin/build/ui.js.LICENSE.txt",
];
// Copyright lines of code adapted into the server rather than bundled from a package.
const ADAPTED_NOTICES = ["Copyright (c) 2024 Figma"];

const work = mkdtempSync(join(tmpdir(), `${PACKAGE}-pack-`));
// pnpm passes its own npm_config_* settings down; npm warns about the ones it does not know.
const npmEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("npm_config_")));

try {
  execFileSync("pnpm", ["--filter", PACKAGE, "pack", "--pack-destination", work], { stdio: "inherit" });
  const tarball = readdirSync(work).find((name) => name.endsWith(".tgz"));

  if (tarball === undefined) {
    throw new Error("pnpm pack produced no tarball");
  }

  execFileSync("npm", ["init", "-y"], { cwd: work, env: npmEnv, stdio: "ignore" });
  execFileSync("npm", ["install", "--no-audit", "--no-fund", join(work, tarball)], {
    cwd: work,
    env: npmEnv,
    stdio: "inherit",
  });

  const installed = join(work, "node_modules", PACKAGE);
  const missing = CARRIED.filter((file) => !existsSync(join(installed, file)));

  if (missing.length > 0) {
    throw new Error(`The package lacks ${missing.join(", ")}`);
  }

  // Code adapted from other projects is not a package in node_modules: its notice has to be there all the same.
  const notices = readFileSync(join(installed, "dist/THIRD-PARTY-NOTICES.md"), "utf8");
  const unnoticed = ADAPTED_NOTICES.filter((notice) => !notices.includes(notice));

  if (unnoticed.length > 0) {
    throw new Error(`THIRD-PARTY-NOTICES.md lacks ${unnoticed.join(", ")}`);
  }

  const bin = join(work, "node_modules", ".bin", PACKAGE);
  const run = (args) => execFileSync(bin, args, { cwd: work, encoding: "utf8" });
  const version = run(["--version"]).trim();
  const setup = run(["setup", "--print"]);

  if (!/^\d+\.\d+\.\d+$/.test(version) || !setup.includes(`claude mcp add ${PACKAGE}`)) {
    throw new Error(`The CLI printed something unexpected:\n${version}\n${setup}`);
  }

  const tools = await countTools(bin, work);

  // WebP is encoded through a wasm file the bundle finds beside the installed package: compile it from there.
  const wasm = createRequire(join(installed, "package.json")).resolve("@jsquash/webp/codec/enc/webp_enc_simd.wasm");

  await WebAssembly.compile(readFileSync(wasm));

  console.log(
    `ok: ${tarball}, version ${version}, ${tools} tools, the WebP encoder, the plugin and the licence notices included`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}

/** Starts the packaged MCP server on stdio (a pipe, as MCP clients start it) and returns how many tools it lists. */
function countTools(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [], {
      cwd,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: cwd,
        PIXELWRIGHT_HOME: join(cwd, ".pixelwright"),
        PIXELWRIGHT_PLUGIN_BRIDGE: "off",
      },
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("the server did not answer tools/list within 30 s"));
    }, 30_000);
    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
    let buffer = "";
    let tools = 0;

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines.filter((text) => text.trim() !== "")) {
        const message = JSON.parse(line);

        if (message.id === 1) {
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
        } else if (message.id === 2) {
          tools = message.result.tools.length;
          // The guide works without a plugin: read one topic through the packaged server.
          send({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "guide", arguments: { topic: "code-connect" } },
          });
        } else if (message.id === 3) {
          clearTimeout(timer);
          child.kill();

          if (!JSON.stringify(message.result ?? {}).includes("# Code Connect\\n")) {
            reject(new Error(`guide did not answer: ${JSON.stringify(message.result ?? message.error)}`));
          } else {
            resolve(tools);
          }
        }
      }
    });
    child.on("error", reject);
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "check-pack", version: "0" } },
    });
  });
}

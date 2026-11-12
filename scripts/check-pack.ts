// `pnpm check:pack` (S-131): packs the package as npm publish would (prepack builds it), installs the tarball in an
// empty folder and runs it there: the bin, `setup --print` under a temp HOME, the MCP server on stdio with the bridge
// off (initialize, tools/list, one guide topic) and the files the package must carry (S-130). Under tsx, for `@/`.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { PLUGIN_FILE } from "@/cli/setup/setup.constants.ts";
import { PLUGIN_FILES } from "@/plugin/main/plugin.constants.ts";
import { WEBP } from "@/server/adapters/images/images.constants.ts";
import { GUIDE_TOOL, GUIDE_TOPIC } from "@/server/tools/guide/guide.constants.ts";
import { ToolCatalog } from "@/server/tools/tool.catalog.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { NOTICES_HEADER } from "./plugin/plugin-notices.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACKAGE: { name: string; version: string } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
/** What the tarball must carry besides package.json: the docs, the licence, the bin and the plugin build (S-130). */
const CARRIED = [
  "README.md",
  "LICENSE",
  "dist/bin.mjs",
  ...Object.values(PLUGIN_FILES).map((file) => `dist/plugin/${file}`),
];
/** The plugin's bundles end with the notices of the packages they hold code of (P-063). */
const NOTICED = [PLUGIN_FILES.main, PLUGIN_FILES.ui];
/** The topic read through the packaged server: its Markdown is inlined into the bundle, so this proves it shipped. */
const TOPIC = GUIDE_TOPIC.workflow;
// pnpm passes its own npm_config_* settings down; npm warns about the ones it does not know.
const NPM_ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("npm_config_")));

class PackCheck {
  readonly #work: string;
  readonly #app: string;
  readonly #home: string;
  readonly #installed: string;
  readonly #bin: string;

  /** `work`: an empty temp folder, removed at the end; the package goes into app/, the bin runs with HOME at home/. */
  constructor(work: string) {
    this.#work = work;
    this.#app = join(work, "app");
    this.#home = join(work, "home");
    this.#installed = join(this.#app, "node_modules", PACKAGE.name);
    this.#bin = join(this.#app, "node_modules", ".bin", PACKAGE.name);
  }

  async run(): Promise<void> {
    try {
      const tarball = this.#pack();

      this.#install(tarball);
      this.#carried();
      this.#version();
      this.#setup();

      const tools = await this.#serve();

      await this.#webp();
      process.stdout.write(
        `ok: ${tarball}: version ${PACKAGE.version}, ${tools} tools as the catalog registers, every input closed, guide ${TOPIC}, setup --print under a temp HOME, the WebP encoder, the plugin and its notices\n`,
      );
    } finally {
      rmSync(this.#work, { recursive: true, force: true });
    }
  }

  #pack(): string {
    execFileSync("pnpm", ["pack", "--pack-destination", this.#work], {
      cwd: ROOT,
      stdio: ["ignore", "ignore", "inherit"],
    });

    const tarball = readdirSync(this.#work).find((name) => name.endsWith(".tgz"));

    if (tarball === undefined) {
      throw new Error("pnpm pack wrote no tarball");
    }

    return tarball;
  }

  #install(tarball: string): void {
    mkdirSync(this.#app);
    mkdirSync(this.#home);
    execFileSync("npm", ["init", "-y"], { cwd: this.#app, env: NPM_ENV, stdio: "ignore" });
    execFileSync("npm", ["install", "--no-audit", "--no-fund", join(this.#work, tarball)], {
      cwd: this.#app,
      env: NPM_ENV,
      stdio: ["ignore", "ignore", "inherit"],
    });
  }

  #carried(): void {
    const missing = CARRIED.filter((file) => !existsSync(join(this.#installed, file)));

    if (missing.length > 0) {
      throw new Error(`The package lacks ${missing.join(", ")}`);
    }

    const plugin = join(this.#installed, "dist", "plugin");
    const unnoticed = NOTICED.filter((file) => !readFileSync(join(plugin, file), "utf8").includes(NOTICES_HEADER));

    if (unnoticed.length > 0) {
      throw new Error(`The plugin's ${unnoticed.join(", ")} carry no licence notices`);
    }
  }

  /** The installed bin with HOME in the temp folder and nothing else from this shell but PATH. */
  #cli(args: readonly string[]): string {
    return execFileSync(this.#bin, args, { cwd: this.#app, env: this.#env(), encoding: "utf8" });
  }

  #env(): Record<string, string> {
    return { PATH: process.env.PATH ?? "", HOME: this.#home };
  }

  #version(): void {
    const version = this.#cli(["--version"]).trim();

    if (version !== PACKAGE.version) {
      throw new Error(`--version printed ${version}, package.json says ${PACKAGE.version}`);
    }
  }

  /** setup --print puts the plugin under the temp HOME and prints the way in; nothing lands where it ran. */
  #setup(): void {
    const text = this.#cli(["setup", "--print"]);
    const manifest = join(this.#home, CHANNEL.home, PLUGIN_FILE.folder, PLUGIN_FILES.manifest);
    const wrong = [
      text.includes(`claude mcp add ${CHANNEL.name}`) ? null : `no "claude mcp add ${CHANNEL.name}"`,
      text.includes(manifest) && existsSync(manifest) ? null : `no plugin at ${manifest}`,
      readdirSync(this.#app).includes(CHANNEL.home) ? `a ${CHANNEL.home} folder in ${this.#app}` : null,
    ].filter((problem) => problem !== null);

    if (wrong.length > 0) {
      throw new Error(`setup --print: ${wrong.join("; ")}\n${text}`);
    }
  }

  /** The packaged server on stdio, as MCP clients start it, with no bridge: what it lists and one guide topic. */
  async #serve(): Promise<number> {
    const client = new Client({ name: "check-pack", version: PACKAGE.version });

    await client.connect(
      new StdioClientTransport({
        command: this.#bin,
        cwd: this.#app,
        env: { ...this.#env(), PIXELWRIGHT_PLUGIN_BRIDGE: "off" },
        stderr: "ignore",
      }),
    );

    try {
      const { tools } = await client.listTools();
      const registered = new ToolCatalog().manifests().length;
      const open = tools.filter(({ inputSchema }) => inputSchema.additionalProperties ?? true);
      const answer = await client.callTool({ name: GUIDE_TOOL.name, arguments: { topic: TOPIC } });
      const topic = readFileSync(join(ROOT, "src/server/tools/guide/topics", `${TOPIC}.md`), "utf8");
      const wrong = [
        client.getServerVersion()?.name === CHANNEL.name ? null : `the server is not ${CHANNEL.name}`,
        tools.length === registered
          ? null
          : `tools/list has ${tools.length} tools, the catalog registers ${registered}`,
        open.length === 0 ? null : `open inputs: ${open.map(({ name }) => name).join(", ")}`,
        (answer.structuredContent as { markdown?: string } | undefined)?.markdown === topic
          ? null
          : `guide ${TOPIC} answered ${JSON.stringify(answer).slice(0, 300)}`,
      ].filter((problem) => problem !== null);

      if (wrong.length > 0) {
        throw new Error(`The packaged server: ${wrong.join("; ")}`);
      }

      return tools.length;
    } finally {
      await client.close();
    }
  }

  /** The WebP encoder's wasm, which the bundle finds beside the installed package: compiled from there. */
  async #webp(): Promise<void> {
    const wasm = createRequire(join(this.#installed, "package.json")).resolve(WEBP.wasmPath(WEBP.simdBuild));
    // The scripts' lib declares no WebAssembly global, though Node has one.
    const assembly: { compile: (bytes: Uint8Array) => Promise<unknown> } = Reflect.get(globalThis, WEBP.wasmGlobal);

    await assembly.compile(readFileSync(wasm));
  }
}

await new PackCheck(mkdtempSync(join(tmpdir(), "pixelwright-pack-"))).run();

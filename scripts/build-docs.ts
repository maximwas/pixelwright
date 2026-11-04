// `pnpm build:docs` (S-134): the website in docs/ from what the product says about itself, so nothing on it is written
// twice: the README's sections, every tool the catalog registers (name, title, description and the input fields of the
// JSON Schema tools/list publishes), the guide's topic files, and a changelog page from CHANGELOG.md's released
// versions. Never from a test file or a golden (R-027). CI fails when docs/ differs from what this writes.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import * as zod from "zod/mini";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { TOOL_JSON_SCHEMA } from "@/server/main/mcp/mcp.constants.ts";
import { GUIDE_TOOL, GUIDE_TOPIC, GUIDE_TOPIC_ABOUT } from "@/server/tools/guide/guide.constants.ts";
import { ToolCatalog } from "@/server/tools/tool.catalog.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
/** The README's sections the docs page shows, in order. "What it does" stays out: the tools come from their manifests. */
const README_SECTIONS = [
  "Quick start",
  "Try it on the demo",
  "How it works",
  "Safety",
  "Limits",
  "Commands",
  "Updating",
];
/** A word spelled as the server spells its tools, words joined by `_` (R-038): README may name registered ones only. */
const TOOL_WORD = /\b[a-z]+(?:_[a-z]+)+\b/g;
/** A released version's heading in CHANGELOG.md; Unreleased is left out. */
const RELEASE = /^\d+\.\d+\.\d+ — \d{4}-\d{2}-\d{2}$/;
const LINKS = {
  github: "https://github.com/maximwas/pixelwright",
  npm: "https://www.npmjs.com/package/pixelwright",
  kofi: "https://ko-fi.com/maksymvasianin",
  monobank: "https://send.monobank.ua/jar/7o9oMrbXTj",
};
const WORDMARK =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0d99ff" /><rect x="9" y="9" width="14" height="14" fill="none" stroke="#fff" stroke-width="2.2" /><g fill="#0d99ff" stroke="#fff" stroke-width="1.8"><rect x="6.2" y="6.2" width="5.6" height="5.6" /><rect x="20.2" y="6.2" width="5.6" height="5.6" /><rect x="6.2" y="20.2" width="5.6" height="5.6" /><rect x="20.2" y="20.2" width="5.6" height="5.6" /></g></svg>';
const GITHUB_MARK =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

/** A JSON Schema as tools/list publishes a tool's input, as far as the parameter table reads it. */
interface Schema {
  type?: string;
  const?: unknown;
  enum?: unknown[];
  items?: Schema;
  anyOf?: Schema[];
  default?: unknown;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
}

/** A page of the site in docs/<dir>; `base` leads from its folder back to docs/. */
interface Page {
  dir: string;
  base: string;
  title: string;
  description: string;
  intro: string;
  parts: { id: string; title: string; html: string }[];
  source: string;
}

class DocsSite {
  // The texts are Markdown about XML: a tag in them is something to show, never markup. marked escapes code spans and
  // text itself, so only raw HTML needs it (escaping first would escape code spans twice).
  readonly #marked = new Marked({ renderer: { html: ({ text }) => this.#escape(text) } });
  readonly #manifests = [...new ToolCatalog().manifests()].sort((left, right) => left.name.localeCompare(right.name));

  write(): void {
    const docs = this.#docs();
    const changelog = this.#changelog();

    this.#writePage(docs);
    this.#writePage(changelog);
    process.stdout.write(
      `docs/index.html: ${docs.parts.length} sections, ${this.#manifests.length} tools; docs/changelog/index.html: ${changelog.parts.length} versions\n`,
    );
  }

  #docs(): Page {
    const readme = this.#readme();
    const tools = this.#manifests.map((manifest) => this.#tool(manifest)).join("\n");
    const topics = Object.values(GUIDE_TOPIC).map((topic) => ({
      id: `guide-${topic}`,
      title: `Guide: ${topic}`,
      html: `<p class="topic-about">${this.#escape(GUIDE_TOPIC_ABOUT[topic])} The agent reads this with <code>${GUIDE_TOOL.name}</code> topic <code>${topic}</code>.</p>\n${this.#render(this.#read(`src/server/tools/guide/topics/${topic}.md`).replace(/^# .*\n/, ""))}`,
    }));

    return {
      dir: "",
      base: "./",
      title: "Pixelwright docs",
      description:
        "How to set up Pixelwright, what each of its tools reads, and the guide your agent reads: the workflow, the XML, tokens and assets.",
      intro: "",
      parts: [
        ...README_SECTIONS.map((title) => ({
          id: this.#slug(title),
          title,
          html: this.#render(readme.get(title) ?? ""),
        })),
        {
          id: "tools",
          title: "Tools",
          html: `<p>Every tool the server registers, as your agent sees it. A tool marked <span class="writes">can write</span> changes the file only while Allow edits is on in the plugin's window.</p>\n${tools}`,
        },
        ...topics,
      ],
      source: "README.md, the tools' manifests and the guide's topics",
    };
  }

  /** README.md's level-2 sections by title; it may name no tool the catalog does not register. */
  #readme(): Map<string, string> {
    const text = this.#read("README.md");
    const registered = new Set(this.#manifests.map(({ name }) => name));
    const unregistered = [...new Set(text.match(TOOL_WORD) ?? [])].filter((word) => !registered.has(word));

    if (unregistered.length > 0) {
      throw new Error(`README.md names ${unregistered.join(", ")}, which the server does not register`);
    }

    const sections = new Map(this.#sections(text));
    const missing = README_SECTIONS.filter((title) => !sections.has(title));

    if (missing.length > 0) {
      throw new Error(`README.md has no section ${missing.join(", ")}`);
    }

    return sections;
  }

  /** CHANGELOG.md's released versions, newest first, as the changelog page. */
  #changelog(): Page {
    const text = this.#read("CHANGELOG.md").replace(/<!--[\s\S]*?-->/g, "");
    const parts = this.#sections(text)
      .filter(([heading]) => RELEASE.test(heading))
      .map(([heading, markdown]) => ({
        id: `v${this.#slug(heading.split(" ")[0] ?? heading)}`,
        title: heading,
        html: this.#render(markdown),
      }));

    if (parts.length === 0) {
      throw new Error("CHANGELOG.md has no released version (## 1.2.3 — YYYY-MM-DD)");
    }

    return {
      dir: "changelog",
      base: "../",
      title: "Pixelwright changelog",
      description:
        "Every release of Pixelwright, the MCP server and Figma plugin: the version, the day and what changed.",
      intro:
        "        <p>Every release, newest first. The npm package <code>pixelwright</code> and the Figma plugin share one version.</p>\n",
      parts,
      source: "CHANGELOG.md",
    };
  }

  /** A Markdown file's level-2 sections: each heading and the Markdown under it. */
  #sections(text: string): [string, string][] {
    return text
      .split(/^## /m)
      .slice(1)
      .map((part) => [part.slice(0, part.indexOf("\n")).trim(), part.slice(part.indexOf("\n") + 1)]);
  }

  #tool(manifest: ToolManifest): string {
    const schema = zod.toJSONSchema(manifest.input, {
      target: TOOL_JSON_SCHEMA.target,
      io: TOOL_JSON_SCHEMA.input,
    }) as Schema;
    const required = new Set(schema.required ?? []);
    const rows = Object.entries(schema.properties ?? {}).map(([name, field]) =>
      this.#row(name, field, required.has(name)),
    );
    const writes = manifest.annotations.readOnlyHint === false ? ' <span class="writes">can write</span>' : "";
    const table =
      rows.length === 0
        ? ""
        : `\n<table><thead><tr><th>Parameter</th><th>Type</th><th>What it is</th></tr></thead><tbody>\n${rows.join("\n")}\n</tbody></table>`;

    return `<section class="tool" id="tool-${manifest.name}">\n<h3><code>${manifest.name}</code> ${this.#escape(manifest.title)}${writes}</h3>\n<p>${this.#inline(manifest.description)}</p>${table}\n</section>`;
  }

  #row(
    name: string,
    field: Schema,
    required: boolean,
  ): string {
    const optional = required ? "" : '<span class="optional">optional</span>';
    const fallback =
      field.default === undefined
        ? ""
        : `<br /><span class="default">default ${this.#escape(JSON.stringify(field.default))}</span>`;

    return `<tr><td><code>${this.#escape(name)}</code>${optional}</td><td><code>${this.#escape(this.#type(field))}</code>${fallback}</td><td>${this.#inline(field.description ?? "")}</td></tr>`;
  }

  /** A JSON Schema's type, the way a person reads it. */
  #type(field: Schema): string {
    if (field.enum !== undefined) {
      return field.enum.map((value) => JSON.stringify(value)).join(" | ");
    }

    if (field.const !== undefined) {
      return JSON.stringify(field.const);
    }

    if (field.type === "array") {
      return `${this.#type(field.items ?? {})}[]`;
    }

    if (field.anyOf !== undefined) {
      return field.anyOf.map((option) => this.#type(option)).join(" | ");
    }

    return field.type ?? "object";
  }

  /** Markdown with its headings one level down, so a section's own headings sit under the page's. */
  #render(markdown: string): string {
    const tokens = this.#marked.lexer(markdown);

    for (const token of tokens) {
      if (token.type === "heading") {
        token.depth = Math.min(6, token.depth + 1);
      }
    }

    return this.#marked.parser(tokens);
  }

  #inline(markdown: string): string {
    return this.#marked.parseInline(markdown, { async: false });
  }

  #writePage(page: Page): void {
    const folder = join(ROOT, "docs", page.dir);

    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "index.html"), this.#html(page));
  }

  #html(page: Page): string {
    const toc = page.parts
      .map(({ id, title }) => `          <li><a href="#${id}">${this.#escape(title)}</a></li>`)
      .join("\n");
    const sections = page.parts
      .map(
        ({ id, title, html }) =>
          `        <section id="${id}">\n          <h2>${this.#escape(title)}</h2>\n${html}\n        </section>`,
      )
      .join("\n");

    return `<!doctype html>
<html lang="en">
${this.#head(page)}
  <body class="docs">
    <a class="skip" href="#main">Skip to the content</a>
    <div class="progress" aria-hidden="true"></div>
${this.#header(page.base)}
    <div class="doc">
      <nav class="toc" aria-label="On this page" data-follow="first">
        <ol>
${toc}
        </ol>
      </nav>
      <main id="main" class="doc-body">
        <h1>${this.#escape(page.title)}</h1>
${page.intro}${sections}
      </main>
    </div>
${this.#footer(page)}
  </body>
</html>
`;
  }

  #head({ base, title, description }: Page): string {
    return `  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${this.#escape(title)}</title>
    <meta name="description" content="${this.#escape(description)}" />
    <meta name="color-scheme" content="dark light" />
    <link rel="icon" href="${base}favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />
    <link rel="stylesheet" href="${base}site.css" />
    <script src="${base}nav.js" defer></script>
  </head>`;
  }

  #header(base: string): string {
    return `    <header class="top">
      <div class="top-inner">
        <a class="wordmark" href="${base}" aria-label="Pixelwright docs">
          ${WORDMARK}
          <span class="wordmark-text">Pixelwright</span>
        </a>
        <nav class="links" aria-label="Site">
          <a href="${base}">Docs</a>
          <a href="${base}changelog/">Changelog</a>
          <a href="${LINKS.npm}">npm</a>
          <a href="${LINKS.kofi}">Support</a>
        </nav>
        <a class="github" href="${LINKS.github}">
          ${GITHUB_MARK}
          GitHub
        </a>
      </div>
    </header>`;
  }

  #footer({ base, source }: Page): string {
    return `    <footer class="bottom">
      <div class="bottom-inner">
        <div>
          <p>Built from ${source} (scripts/build-docs.ts). Pixelwright is open source under the <a href="${LINKS.github}/blob/main/LICENSE">MIT license</a>. Unofficial: not affiliated with or endorsed by Figma. “Figma” is a trademark of Figma, Inc.</p>
        </div>
        <p class="footer-links">
          <a href="${base}">Docs</a>
          <a href="${LINKS.github}">GitHub</a>
          <a href="${LINKS.npm}">npm</a>
          <a href="${base}changelog/">Changelog</a>
          <a href="${LINKS.github}/discussions">Feedback</a>
          <a href="${LINKS.kofi}">Ko-fi</a>
          <a href="${LINKS.monobank}">monobank</a>
        </p>
      </div>
    </footer>`;
  }

  #read(path: string): string {
    return readFileSync(join(ROOT, path), "utf8");
  }

  #escape(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  #slug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
}

new DocsSite().write();

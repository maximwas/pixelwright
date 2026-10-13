// Builds the website's docs page (docs/docs/index.html) from what the product says about itself: the README's
// sections for people, every tool as the MCP server lists it (description and parameters), and the guide's topics the
// agent reads; and its changelog page (docs/changelog/index.html) from CHANGELOG.md's released versions. Nothing on the
// pages is written twice, so they cannot drift from the product. Run: pnpm build:docs.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { GUIDE_TOPICS } from "../apps/server/src/guide/topics.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const README_SECTIONS = ["Quick start", "How it works", "Code Connect", "Safety", "Limits", "Commands", "Updating"];

const escapeHtml = (text) =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// The texts are Markdown about XML: a tag written in them is something to show, never markup. marked escapes code spans
// and plain text itself, so only raw HTML needs it (escaping before marked would escape code spans twice).
marked.use({ renderer: { html: ({ text }) => escapeHtml(text) } });
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Markdown with its headings moved down `by` levels, so a section's own headings sit under the page's. */
function render(markdown, by) {
  const tokens = marked.lexer(markdown);

  for (const token of tokens) {
    if (token.type === "heading") {
      token.depth = Math.min(6, token.depth + by);
    }
  }

  return marked.parser(tokens);
}

/** The README's level-2 sections by title. */
function readmeSections() {
  const text = readFileSync(join(root, "README.md"), "utf8");
  const sections = new Map();

  for (const part of text.split(/^## /m).slice(1)) {
    const newline = part.indexOf("\n");

    sections.set(part.slice(0, newline).trim(), part.slice(newline + 1));
  }

  return sections;
}

/** The tools as the server lists them over MCP, started with no Figma plugin around. */
function listTools() {
  const home = mkdtempSync(join(tmpdir(), "pixelwright-docs-"));

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, "apps/server/src/bin.ts"), "serve"], {
      env: {
        ...process.env,
        PIXELWRIGHT_HOME: home,
        PIXELWRIGHT_PLUGIN_BRIDGE: "off",
      },
      stdio: ["pipe", "pipe", "ignore"],
    });
    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("the server did not list its tools within 30 s"));
    }, 30_000);
    let buffer = "";

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
          clearTimeout(timer);
          child.kill();
          rmSync(home, { recursive: true, force: true });
          resolve(message.result.tools);
        }
      }
    });
    child.on("error", reject);
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "build-docs", version: "0" } },
    });
  });
}

/** A JSON schema's type, the way a person reads it. */
function typeOf(schema) {
  if (schema.enum !== undefined) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  }

  if (schema.type === "array") {
    return `${typeOf(schema.items ?? {})}[]`;
  }

  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.map(typeOf).join(" | ");
  }

  return schema.type ?? "object";
}

function toolHtml(tool) {
  const properties = Object.entries(tool.inputSchema?.properties ?? {});
  const required = new Set(tool.inputSchema?.required ?? []);
  const rows = properties
    .map(
      ([name, schema]) =>
        `<tr><td><code>${escapeHtml(name)}</code>${required.has(name) ? "" : '<span class="optional">optional</span>'}</td><td><code>${escapeHtml(typeOf(schema))}</code>${schema.default === undefined ? "" : `<br /><span class="default">default ${escapeHtml(JSON.stringify(schema.default))}</span>`}</td><td>${marked.parseInline(schema.description ?? "")}</td></tr>`,
    )
    .join("\n");
  const writes = tool.annotations?.readOnlyHint === false;

  return `<section class="tool" id="tool-${tool.name}">
  <h3><code>${tool.name}</code>${writes ? '<span class="writes">writes</span>' : ""}</h3>
  <p>${marked.parseInline(tool.description ?? "")}</p>
  ${properties.length === 0 ? "" : `<table><thead><tr><th>Parameter</th><th>Type</th><th>What it is</th></tr></thead><tbody>\n${rows}\n</tbody></table>`}
</section>`;
}

const readme = readmeSections();
const tools = (await listTools()).sort((a, b) => a.name.localeCompare(b.name));
const missing = README_SECTIONS.filter((title) => !readme.has(title));

if (missing.length > 0) {
  throw new Error(`README.md has no section ${missing.join(", ")}`);
}

const parts = [
  ...README_SECTIONS.map((title) => ({
    id: slug(title),
    title,
    html: render(readme.get(title) ?? "", 1),
  })),
  {
    id: "tools",
    title: "Tools",
    html: `<p>Every tool the server lists, as your agent sees it. Tools marked <span class="writes">writes</span> change the file and need Allow edits.</p>\n${tools.map(toolHtml).join("\n")}`,
  },
  ...Object.entries(GUIDE_TOPICS).map(([name, topic]) => ({
    id: `guide-${name}`,
    title: `Guide: ${name}`,
    html: `<p class="topic-about">${escapeHtml(topic.about)} The agent reads this with <code>guide</code> topic <code>${name}</code>.</p>\n${render(topic.markdown.replace(/^# .*\n/, ""), 1)}`,
  })),
];

/** A page of the site under docs/<dir>: the header, a table of contents, the parts and the footer every page shares. */
function sitePage({ title, description, parts, intro = "", footerNote }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="color-scheme" content="dark light" />
    <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />
    <link rel="stylesheet" href="../site.css" />
    <script src="../nav.js" defer></script>
  </head>
  <body class="docs">
    <a class="skip" href="#main">Skip to the content</a>
    <div class="progress" aria-hidden="true"></div>
    <header class="top">
      <div class="top-inner">
        <a class="wordmark" href="../" aria-label="Pixelwright home">
          <svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0d99ff" /><rect x="9" y="9" width="14" height="14" fill="none" stroke="#fff" stroke-width="2.2" /><g fill="#0d99ff" stroke="#fff" stroke-width="1.8"><rect x="6.2" y="6.2" width="5.6" height="5.6" /><rect x="20.2" y="6.2" width="5.6" height="5.6" /><rect x="6.2" y="20.2" width="5.6" height="5.6" /><rect x="20.2" y="20.2" width="5.6" height="5.6" /></g></svg>
          <span class="wordmark-text">Pixelwright</span>
        </a>
        <nav class="links" aria-label="Site">
          <a href="../">Home</a>
          <a href="../docs/">Docs</a>
          <a href="../changelog/">Changelog</a>
          <a href="https://www.npmjs.com/package/pixelwright">npm</a>
          <a href="https://ko-fi.com/maksymvasianin">Support</a>
        </nav>
        <a class="github" href="https://github.com/maximwas/pixelwright">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          GitHub
        </a>
      </div>
    </header>
    <div class="doc">
      <nav class="toc" aria-label="On this page" data-follow="first">
        <ol>
${parts.map(({ id, title: label }) => `          <li><a href="#${id}">${escapeHtml(label)}</a></li>`).join("\n")}
        </ol>
      </nav>
      <main id="main" class="doc-body">
        <h1>${escapeHtml(title)}</h1>
${intro}${parts.map(({ id, title: label, html }) => `        <section id="${id}">\n          <h2>${escapeHtml(label)}</h2>\n${html}\n        </section>`).join("\n")}
      </main>
    </div>
    <footer class="bottom">
      <div class="bottom-inner">
        <div>
          <p>${footerNote} Unofficial: not affiliated with or endorsed by Figma. “Figma” is a trademark of Figma, Inc.</p>
        </div>
        <p class="footer-links">
          <a href="../">Home</a>
          <a href="https://github.com/maximwas/pixelwright">GitHub</a>
          <a href="https://www.npmjs.com/package/pixelwright">npm</a>
          <a href="../changelog/">Changelog</a>
          <a href="https://github.com/maximwas/pixelwright/discussions">Feedback</a>
          <a href="https://ko-fi.com/maksymvasianin">Ko-fi</a>
          <a href="https://send.monobank.ua/jar/7o9oMrbXTj">monobank</a>
        </p>
      </div>
    </footer>
  </body>
</html>
`;
}

/** CHANGELOG.md's released versions, newest first: "## 0.1.0 — 2026-10-13" and its Markdown; Unreleased left out. */
function releases() {
  const text = readFileSync(join(root, "CHANGELOG.md"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const found = [];

  for (const part of text.split(/^## /m).slice(1)) {
    const newline = part.indexOf("\n");
    const heading = /^(\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})$/.exec(part.slice(0, newline).trim());

    if (heading !== null) {
      found.push({ version: heading[1], date: heading[2], markdown: part.slice(newline + 1) });
    }
  }

  return found;
}

writePage(
  "docs",
  sitePage({
    title: "Pixelwright docs",
    description:
      "How to set up Pixelwright, what each of its tools does, and the formats your agent reads: the XML, writing, tokens, assets and Code Connect.",
    parts,
    footerNote: "Built from Pixelwright's README, its tools and its guide (scripts/build-docs.mjs).",
  }),
);
console.log(`docs/docs/index.html: ${parts.length} sections, ${tools.length} tools`);

const versions = releases();

if (versions.length === 0) {
  throw new Error("CHANGELOG.md has no released version (## 1.2.3 — YYYY-MM-DD)");
}

writePage(
  "changelog",
  sitePage({
    title: "Pixelwright changelog",
    description:
      "Every release of Pixelwright, the MCP server and Figma plugin: the version, the day and what changed.",
    intro:
      "        <p>Every release, newest first. The npm package <code>pixelwright</code> and the Figma plugin share one version.</p>\n",
    parts: versions.map(({ version, date, markdown }) => ({
      id: `v${version.replaceAll(".", "-")}`,
      title: `${version} — ${date}`,
      html: render(markdown, 1),
    })),
    footerNote: "Built from CHANGELOG.md (scripts/build-docs.mjs).",
  }),
);
console.log(`docs/changelog/index.html: ${versions.length} versions`);

function writePage(dir, html) {
  mkdirSync(join(root, "docs", dir), { recursive: true });
  writeFileSync(join(root, "docs", dir, "index.html"), html);
}

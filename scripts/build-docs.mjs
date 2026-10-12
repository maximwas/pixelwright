// Builds the website's docs page (docs/docs/index.html) from what the product says about itself: the README's
// sections for people, every tool as the MCP server lists it (description and parameters), and the guide's topics the
// agent reads. Nothing on the page is written twice, so it cannot drift from the product. Run: pnpm build:docs.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { GUIDE_TOPICS } from "../apps/server/src/guide/topics.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const README_SECTIONS = ["Quick start", "How it works", "Code Connect", "Safety", "Limits", "Commands"];

const escapeHtml = (text) =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
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
        `<tr><td><code>${escapeHtml(name)}</code>${required.has(name) ? "" : '<span class="optional">optional</span>'}</td><td><code>${escapeHtml(typeOf(schema))}</code>${schema.default === undefined ? "" : `<br /><span class="default">default ${escapeHtml(JSON.stringify(schema.default))}</span>`}</td><td>${marked.parseInline(escapeHtml(schema.description ?? ""))}</td></tr>`,
    )
    .join("\n");
  const writes = tool.annotations?.readOnlyHint === false;

  return `<section class="tool" id="tool-${tool.name}">
  <h3><code>${tool.name}</code>${writes ? '<span class="writes">writes</span>' : ""}</h3>
  <p>${marked.parseInline(escapeHtml(tool.description ?? ""))}</p>
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

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pixelwright docs</title>
    <meta name="description" content="How to set up Pixelwright, what each of its tools does, and the formats your agent reads: the XML, writing, tokens, assets and Code Connect." />
    <meta name="color-scheme" content="light dark" />
    <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Onest:wght@400;500;600&family=Unbounded:wght@500;700&display=swap" />
    <link rel="stylesheet" href="../site.css" />
  </head>
  <body class="docs">
    <a class="skip" href="#main">Skip to the content</a>
    <header class="top">
      <a class="wordmark" href="../" aria-label="Pixelwright home">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect class="mark-frame" x="4" y="4" width="16" height="16" />
          <rect class="mark-handle" x="2" y="2" width="4" height="4" />
          <rect class="mark-handle" x="18" y="2" width="4" height="4" />
          <rect class="mark-handle" x="2" y="18" width="4" height="4" />
          <rect class="mark-handle" x="18" y="18" width="4" height="4" />
        </svg>
        Pixelwright
      </a>
      <nav class="links" aria-label="Site">
        <a href="../">Home</a>
        <a href="https://github.com/maximwas/pixelwright">GitHub</a>
        <a href="https://www.npmjs.com/package/pixelwright">npm</a>
      </nav>
    </header>
    <div class="doc">
      <nav class="toc" aria-label="On this page">
        <ol>
${parts.map(({ id, title }) => `          <li><a href="#${id}">${escapeHtml(title)}</a></li>`).join("\n")}
        </ol>
      </nav>
      <main id="main" class="doc-body">
        <h1>Pixelwright docs</h1>
${parts.map(({ id, title, html }) => `        <section id="${id}">\n          <h2>${escapeHtml(title)}</h2>\n${html}\n        </section>`).join("\n")}
      </main>
    </div>
    <footer class="bottom">
      <p>Built from Pixelwright's README, its tools and its guide (scripts/build-docs.mjs).</p>
      <p>Unofficial: not affiliated with or endorsed by Figma. “Figma” is a trademark of Figma, Inc.</p>
    </footer>
  </body>
</html>
`;

mkdirSync(join(root, "docs/docs"), { recursive: true });
writeFileSync(join(root, "docs/docs/index.html"), page);
console.log(`docs/docs/index.html: ${parts.length} sections, ${tools.length} tools`);

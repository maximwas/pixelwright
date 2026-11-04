import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { install } = TEST_MCP.ids;

// The server starts in a temp project folder (CLAUDE_PROJECT_DIR; the client lists no root), so no baseline lands in
// the repo (m:335a001e); the folder goes after. baseline_save writes nothing to Figma.
describe("read/baselines", () => {
  const { file } = inject("live");
  let client: LiveClient;
  let project: string;

  beforeAll(async () => {
    project = await mkdtemp(join(tmpdir(), "pixelwright-live-baselines-"));
    client = await new LiveClient().connect({ CLAUDE_PROJECT_DIR: project });
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
    await rm(project, { recursive: true, force: true });
  });

  it("keeps the Install card and the tokens it binds in the project's .pixelwright/baselines, header first (T-200, K-058)", async () => {
    const saved = await client.call("baseline_save", { file, node: install, name: "install" });
    const path = join(project, ".pixelwright", "baselines", "install.json");
    const text = await readFile(path, "utf8");
    const kept = JSON.parse(text);

    expect(saved).toMatchObject({ name: "install", path, node: { id: install }, file: { name: file }, cut: [] });
    expect(saved.layers).toBeGreaterThan(1);
    expect(text).toMatch(/^\{"pixelwrightBaseline":1,"name":"install","capturedAt":"/);
    expect(kept.snapshot.root.id).toBe(install);
    expect(kept.tokens).not.toBeNull();
  });

  it("refuses the same name again, and starts it over with replace: the same layer read again changed nothing (T-201)", async () => {
    await expect(client.call("baseline_save", { file, node: install, name: "install" })).rejects.toThrow(
      /install exists \(.+, 81:1627, saved .+ UTC\)/,
    );

    const replaced = await client.call("baseline_save", { file, node: install, name: "install", replace: true });

    expect(replaced).toMatchObject({
      replaced: { node: { id: install }, counts: { changed: 0, added: 0, removed: 0 } },
    });
  });
});

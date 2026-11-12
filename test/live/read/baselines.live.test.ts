import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { install } = TEST_MCP.ids;

/** The prefix of the layers this file makes in the Live tests Section, removed after. */
const PREFIX = "live:baselines:";

type Changes = { changes: { changed: { path: string; attributes: Record<string, unknown> }[] } };
type Overview = { summary: string; baselines: { name: string; status: string }[] };
type One = { baselines: { status: string; reason?: string; now?: { id: string } }[]; notes: string[] };

// The server starts in a temp project folder (CLAUDE_PROJECT_DIR; the client lists no root), so no baseline lands in
// the repo (m:335a001e); the folder goes after. baseline_save writes nothing to Figma.
describe("read/baselines", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;
  let project: string;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;

  /** A copy of the Install card in the Live tests section, named with the prefix; its id. */
  const copy = async (name: string): Promise<string> =>
    (await run(`const copy = (await pw.node(${JSON.stringify(install)})).clone();
(await pw.node(${JSON.stringify(scratch)})).appendChild(copy);
copy.name = ${JSON.stringify(`${PREFIX}${name}`)};
return copy.id;`)) as string;

  beforeAll(async () => {
    project = await mkdtemp(join(tmpdir(), "pixelwright-live-baselines-"));
    client = await new LiveClient().connect({ CLAUDE_PROJECT_DIR: project });
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
  if (!node.removed) node.remove();
}`);
    await client.close();
    await rm(project, { recursive: true, force: true });
  });

  it("keeps the Install card and the tokens it binds in the project's .pixelwright/baselines, header first (T-200, K-058)", async () => {
    const saved = await client.call("baseline_save", { file, node: install, name: "install" });
    const page = await run(`let node = await pw.node(${JSON.stringify(install)});
while (node.type !== "PAGE") node = node.parent;
return { id: node.id, name: node.name };`);
    const path = join(project, ".pixelwright", "baselines", "install.json");
    const text = await readFile(path, "utf8");
    const kept = JSON.parse(text);

    expect(saved).toMatchObject({ name: "install", path, node: { id: install }, file: { name: file }, cut: [] });
    expect(saved.layers).toBeGreaterThan(1);
    expect(text).toMatch(/^\{"pixelwrightBaseline":1,"name":"install","capturedAt":"/);
    expect(kept.snapshot.root.id).toBe(install);
    expect(kept.tokens).not.toBeNull();
    // T-206: the page comes from the read op, so a remade root is looked for on it.
    expect(saved.page).toEqual(page);
    expect(kept.page).toEqual(page);
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

  // T-205: the copy is made and changed through execute (0.8.0 has no design_apply), then removed with the others.
  it("lists the padding changed on a copy of the Install card since its baseline, with an accept (T-205)", async () => {
    const copy = await run(`const card = await pw.node(${JSON.stringify(install)});
const copy = card.clone();
(await pw.node(${JSON.stringify(scratch)})).appendChild(copy);
copy.name = ${JSON.stringify(`${PREFIX}padding`)};
if (copy.layoutMode === "NONE") copy.layoutMode = "VERTICAL";
return copy.id;`);

    await client.call("baseline_save", { file, node: copy, name: "install-copy" });
    await run(`const copy = await pw.node(${JSON.stringify(copy)});
copy.paddingTop += 8;`);

    const diff = (await client.call("baseline_diff", { file, name: "install-copy" })) as Changes;
    const root = diff.changes.changed.find(({ path }) => path === "(root)");

    expect(diff).toMatchObject({ baselines: [{ status: "changed" }], accept: expect.stringMatching(/^[0-9a-f]{16}$/) });
    expect(Object.keys(root?.attributes ?? {})).toContainEqual(expect.stringMatching(/^padding/));
  });

  // T-204 after the cases above: install was saved as it is, install-copy has its padding changed.
  it("lists every baseline of the file with its status; the copy accepted, the next overview reads it the same (T-204, T-201)", async () => {
    const overview = (await client.call("baseline_diff", { file })) as Overview;

    expect(overview.baselines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "install", status: "same" }),
        expect.objectContaining({ name: "install-copy", status: "changed" }),
      ]),
    );

    const { accept } = (await client.call("baseline_diff", { file, name: "install-copy" })) as { accept: string };

    await client.call("baseline_save", { name: "install-copy", accept });

    const again = (await client.call("baseline_diff", { file })) as Overview;

    expect(again.baselines).toContainEqual(expect.objectContaining({ name: "install-copy", status: "same" }));
    expect(again.summary).toMatch(/^2 baselines: install the same, install-copy the same\.$/);
  });

  // T-206 from here on, after the overview above counted two baselines.
  it("says hidden, with why, for a copy hidden since its baseline (T-206)", async () => {
    const id = await copy("hidden");

    await client.call("baseline_save", { file, node: id, name: "hidden-copy" });
    await run(`(await pw.node(${JSON.stringify(id)})).visible = false;`);

    const diff = (await client.call("baseline_diff", { file, name: "hidden-copy" })) as One;

    expect(diff.baselines[0]).toMatchObject({ status: "hidden", reason: expect.any(String) });
  });

  it("says missing for a copy deleted since its baseline, with how to start over (T-206)", async () => {
    const id = await copy("deleted");

    await client.call("baseline_save", { file, node: id, name: "deleted-copy" });
    await run(`(await pw.node(${JSON.stringify(id)})).remove();`);

    const diff = (await client.call("baseline_diff", { file, name: "deleted-copy" })) as One;

    expect(diff.baselines[0]).toMatchObject({ status: "missing", reason: expect.stringContaining("is gone") });
  });

  // Live layers stay in the Live tests section, so the root is remade on the page it was on; one remade on a page
  // other than the current one is the unit test's (baseline-diff.tool.test.ts, T-206): find runs within its page.
  it("compares a copy deleted and made again under its name with the one on its page (T-206)", async () => {
    const id = await copy("remade");

    await client.call("baseline_save", { file, node: id, name: "remade-copy" });
    await run(`(await pw.node(${JSON.stringify(id)})).remove();`);

    const remade = await copy("remade");
    const diff = (await client.call("baseline_diff", { file, name: "remade-copy" })) as One;

    expect(diff.baselines[0]).toMatchObject({ now: { id: remade } });
    expect(diff.notes).toContainEqual(expect.stringContaining(`${id} is gone: compared with`));
  });
});

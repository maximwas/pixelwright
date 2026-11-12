import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const PREFIX = "live:design-apply-unchanged:";

type Planned = {
  dry?: boolean;
  errors: { id?: string; attribute?: string; message: string }[];
  changes: { id: string | null; props: Record<string, unknown>; sources: Record<string, string> }[];
};

// Dry runs only: design_read's XML sent back plans nothing (D-19); the layer the effects case plans against is made in
// the scratch Section by execute, named live:design-apply-unchanged:<case>, and removed after.
describe("write/design_apply unchanged, paints and effects planning", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const plan = async (xml: string): Promise<Planned> =>
    (await client.call("design_apply", { file, xml, dryRun: true })) as Planned;
  const written = (planned: Planned) => planned.changes.filter((change) => Object.keys(change.props).length > 0);

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
  if (!node.removed) node.remove();
}`);
    await client.close();
  });

  // Try it: the Install card's own read sent back is nothing to change.
  it("plans no write for the Install card's own read", async () => {
    const xml = String((await client.call("design_read", { file, node: TEST_MCP.ids.install })).xml);
    const planned = await plan(xml);

    expect(planned.errors).toEqual([]);
    expect(written(planned)).toEqual([]);
  });

  // Try it: one background changed in that read lists only that background.
  it("lists only the background changed in the read", async () => {
    const xml = String((await client.call("design_read", { file, node: TEST_MCP.ids.install })).xml);
    const changed = xml.replace(`id="${TEST_MCP.ids.install}"`, `id="${TEST_MCP.ids.install}" background="#123456"`);
    const planned = await plan(changed.replace(/(id="81:1627"[^>]*?) background="(?!#123456)[^"]*"/, "$1"));

    expect(written(planned).map(({ id, sources }) => ({ id, sources }))).toEqual([
      { id: TEST_MCP.ids.install, sources: { fills: "background" } },
    ]);
  });

  // C-103: a new blur on a layer with a shadow writes one list that keeps the shadow.
  it("plans a new blur together with the layer's shadow", async () => {
    const id = (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const node = figma.createFrame();
node.name = ${JSON.stringify(`${PREFIX}blur`)};
node.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 8, spread: 0, visible: true, blendMode: "NORMAL" }];
section.appendChild(node);
return node.id;`)) as string;
    const [change] = written(await plan(`<Frame id="${id}" filter="blur(4.3px)"/>`));

    expect(change?.props.effects).toMatchObject([
      { type: "LAYER_BLUR", radius: 10 },
      { type: "DROP_SHADOW", x: 0, y: 4, radius: 8 },
    ]);
  });
});

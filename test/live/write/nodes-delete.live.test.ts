import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient, type ToolResult } from "../support/live-client.ts";

const NAME = {
  rectangle: "live:nodes-delete:rectangle-",
  component: "live:nodes-delete:component",
  instance: "live:nodes-delete:instance",
  versioned: "live:nodes-delete:versioned",
} as const;

/** Versions cannot be deleted from Test MCP's history (T-181, A§15.12): only with the switch. */
const VERSIONS = process.env.PIXELWRIGHT_LIVE_VERSIONS === "1";

// Writes, so no retry. Each case makes its own layers in the scratch Section; the setup's sweep removes any left.
describe("write/nodes_delete", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const remove = (args: ToolResult): Promise<ToolResult> => client.call("nodes_delete", { file, ...args });

  /** Three rectangles made by execute in the scratch Section, by id. */
  const rectangles = async (): Promise<string[]> =>
    (await run(`const section = await pw.node(${JSON.stringify(scratch)});
return [1, 2, 3].map((index) => {
  const rectangle = figma.createRectangle();
  rectangle.name = ${JSON.stringify(NAME.rectangle)} + index;
  section.appendChild(rectangle);
  return rectangle.id;
});`)) as string[];

  /** Which of the ids are layers in the file now. */
  const present = async (ids: readonly string[]): Promise<string[]> =>
    (await run(`const ids = ${JSON.stringify(ids)};
const found = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)));
return ids.filter((_id, index) => found[index] !== null && !found[index].removed);`)) as string[];

  beforeAll(async () => {
    // The weekly support sentence off: answers stay exact, and the home's week is not spent by a test (T-006).
    client = await new LiveClient().connect({ PIXELWRIGHT_SUPPORT_REMINDERS: "off" });
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
  });

  it("lists three layers in a dry run and keeps them (T-012, D-35)", async () => {
    const ids = await rectangles();

    expect(await remove({ nodes: ids, dryRun: true })).toEqual({ deleted: ids, errors: [], dry: true });
    expect(await present(ids)).toEqual(ids);

    await remove({ nodes: ids });
  });

  it("deletes three layers, and one undo in Figma brings all three back (T-045)", async () => {
    const ids = await rectangles();

    expect(await remove({ nodes: ids })).toEqual({ deleted: ids, errors: [] });
    expect(await present(ids)).toEqual([]);

    await run("figma.triggerUndo();");

    expect(await present(ids)).toEqual(ids);

    await remove({ nodes: ids });
  });

  it("refuses a layer inside an instance with its reason and deletes the rest (T-045, P-160)", async () => {
    const [instance, inside] = (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const component = figma.createComponent();
component.name = ${JSON.stringify(NAME.component)};
component.appendChild(figma.createRectangle());
section.appendChild(component);
const instance = component.createInstance();
instance.name = ${JSON.stringify(NAME.instance)};
section.appendChild(instance);
return [instance.id, instance.children[0].id];`)) as [string, string];

    const answer = await remove({ nodes: [inside, instance] });

    expect(answer).toEqual({
      deleted: [instance],
      errors: [{ id: inside, message: expect.stringContaining("inside an instance") }],
    });
  });

  it.skipIf(!VERSIONS)(
    "saves no version when nothing would be deleted, and one before a delete that does (T-011)",
    async () => {
      const title = `live test ${new Date().toISOString()}`;
      const [id] = (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const rectangle = figma.createRectangle();
rectangle.name = ${JSON.stringify(NAME.versioned)};
section.appendChild(rectangle);
return [rectangle.id];`)) as [string];

      expect(await remove({ nodes: ["0:999999"], version: title })).toMatchObject({ deleted: [], dry: true });
      expect(await remove({ nodes: [id], version: title })).toEqual({
        deleted: [id],
        errors: [],
        version: { id: expect.any(String), title },
      });
    },
  );
});

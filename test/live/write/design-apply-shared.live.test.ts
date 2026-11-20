import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

const PREFIX = "live:fix-090a:";

/** Two scratch collections that each have a colour variable named live/primary: one CSS name, --live-primary. */
const COLLECTIONS = [`${PREFIX}brand-a`, `${PREFIX}brand-b`];

/** The collections' data- attributes, as design_read writes them. */
const SLUGS = ["live-fix-090a-brand-a", "live-fix-090a-brand-b"];

const removeTokens = `for (const collection of await figma.variables.getLocalVariableCollectionsAsync()) {
  if (${JSON.stringify(COLLECTIONS)}.includes(collection.name)) collection.remove();
}`;

const makeTokens = `${removeTokens}
const ids = [];
for (const [name, r] of [[${JSON.stringify(COLLECTIONS[0])}, 0.49], [${JSON.stringify(COLLECTIONS[1])}, 0.43]]) {
  const collection = figma.variables.createVariableCollection(name);
  const primary = figma.variables.createVariable("live/primary", collection, "COLOR");
  primary.setValueForMode(collection.defaultModeId, { r, g: 0.23, b: 0.93, a: 1 });
  ids.push(primary.id);
}
return ids;`;

type Applied = {
  created: { id?: string; line: number }[];
  errors: { attribute?: string; message: string; hint?: string }[];
  notes?: { attribute?: string; message: string; hint?: string }[];
};

// FIX-090A on layers design_apply makes in the Live tests Section, named live:fix-090a:<case> and removed after, with
// two scratch collections made and removed here.
describe("write/design_apply, a token name two collections share, and a spread Figma does not draw", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;
  let variables: string[];

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const apply = async (xml: string, more: Record<string, unknown> = {}): Promise<Applied> =>
    (await client.call("design_apply", { file, xml, parent: scratch, ...more })) as Applied;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
    variables = (await run(makeTokens)) as string[];
  });

  afterAll(async () => {
    if (client === undefined) {
      return;
    }

    try {
      await run(removeTokens);
    } finally {
      try {
        await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
  if (!node.removed) node.remove();
}`);
      } finally {
        await client.close();
      }
    }
  });

  it("binds var() to the variable of the collection whose mode the parent sets", async () => {
    const applied = await apply(`<Frame name="${PREFIX}pick" data-${SLUGS[1]}="mode-1" width="40px" height="40px">
  <Rectangle name="${PREFIX}pick-swatch" width="20px" height="20px" background="var(--live-primary)"/>
</Frame>`);
    const swatch = applied.created.find(({ line }) => line === 2)?.id ?? "";

    expect(applied.errors).toEqual([]);
    expect(
      await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(swatch)});
return node.fills[0].boundVariables.color.id;`),
    ).toBe(variables[1]);
  });

  it("refuses it on a dry run and a real run when no mode picks one, naming both collections", async () => {
    const xml = `<Frame name="${PREFIX}refused" width="40px" height="40px" background="var(--live-primary)"/>`;

    for (const dryRun of [true, false]) {
      const [error] = (await apply(xml, { dryRun })).errors;

      expect(error?.attribute).toBe("background");
      expect(error?.message).toContain(`in ${COLLECTIONS[0]} and ${COLLECTIONS[1]}`);
      expect(error?.hint).toContain(`data-${SLUGS[0]}="<mode>"`);
    }
  });

  it("notes a spread on a frame that does not clip, and not on one that does", async () => {
    const shadow = 'background="#ffffff" box-shadow="0 0 0 24px #000000" width="80px" height="80px"';
    const loose = await apply(`<Frame name="${PREFIX}spread" ${shadow}/>`, { dryRun: true });
    const clipped = await apply(`<Frame name="${PREFIX}spread" ${shadow} overflow="hidden"/>`, { dryRun: true });

    expect(loose.notes?.map(({ attribute, hint }) => [attribute, hint?.includes("overflow: hidden")])).toEqual([
      ["box-shadow", true],
    ]);
    expect(clipped.notes).toBeUndefined();
  });
});

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient, type ToolResult } from "../support/live-client.ts";

/** The name of the variables these dry runs would make: nothing is written, so nothing needs cleaning up. */
const PREFIX = "live:tokens-apply:";

interface JsonVariable {
  readonly name: string;
  readonly token: string;
  readonly values: Record<string, string>;
}

interface JsonCollection {
  readonly name: string;
  readonly modes: string[];
  readonly variables: JsonVariable[];
}

/** Dry runs only (item 48): they read Test MCP's own variables and write none, with Allow edits on or off. */
describe("write/tokens_apply", () => {
  const { file } = inject("live");
  let client: LiveClient;

  const apply = (args: ToolResult): Promise<ToolResult> => client.call("tokens_apply", { file, ...args });

  /** tokens_read's JSON of Test MCP, as tokens_apply takes it back in `tokens`. */
  const readTokens = async (): Promise<{ collections: JsonCollection[] }> =>
    (await client.call("tokens_read", { file, format: "json" })).tokens as { collections: JsonCollection[] };

  /** The collection that holds --space-24, with the variable. */
  const spaceHome = async (): Promise<{ collection: JsonCollection; variable: JsonVariable }> => {
    const { collections } = await readTokens();
    const collection = collections.find(({ variables }) => variables.some(({ token }) => token === "--space-24"));
    const variable = collection?.variables.find(({ token }) => token === "--space-24");

    if (collection === undefined || variable === undefined) {
      throw new Error("Test MCP has no --space-24");
    }

    return { collection, variable };
  };

  beforeAll(async () => {
    // The weekly support sentence off: answers stay exact, and the home's week is not spent by a test (T-006).
    client = await new LiveClient().connect({ PIXELWRIGHT_SUPPORT_REMINDERS: "off" });
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
  });

  it("plans nothing for tokens_read's own JSON sent back (D-25)", async () => {
    const { tokens } = await client.call("tokens_read", { file, format: "json" });

    expect(await apply({ tokens, dryRun: true })).toEqual({ created: [], updated: [], errors: [], dry: true });
  });

  it("lists one create for a variable renamed in that JSON, and makes nothing (T-165)", async () => {
    const tokens = await readTokens();
    const { collection, variable } = await spaceHome();
    const renamed = `${PREFIX}space`;
    const sent = {
      ...tokens,
      collections: tokens.collections.map((each) =>
        each.name !== collection.name
          ? each
          : {
            ...each,
            variables: each.variables.map((one) =>
              one.token === variable.token ? { ...one, name: renamed, token: "--live-tokens-apply-space" } : one,
            ),
          },
      ),
    };

    expect(await apply({ tokens: sent, dryRun: true })).toEqual({
      created: [{ kind: "variable", name: renamed, collection: collection.name }],
      updated: [],
      errors: [],
      dry: true,
    });

    const after = await readTokens();

    expect(after.collections.flatMap(({ variables }) => variables.map(({ name }) => name))).not.toContain(renamed);
  });

  it("refuses ALL_SCOPES beside another scope and [] on a BOOLEAN in a dry run, as each variable's error (K-024, FX-050)", async () => {
    const { collection } = await spaceHome();
    const mode = collection.modes[0] ?? "";
    const answer = await apply({
      tokens: {
        collections: [
          {
            name: collection.name,
            variables: [
              { name: `${PREFIX}gap`, values: { [mode]: "4px" }, scopes: ["ALL_SCOPES", "GAP"] },
              { name: `${PREFIX}flag`, values: { [mode]: "true" }, scopes: [] },
            ],
          },
        ],
      },
      dryRun: true,
    });

    expect(answer).toEqual({
      created: [],
      updated: [],
      errors: [
        {
          kind: "variable",
          name: `${PREFIX}gap`,
          collection: collection.name,
          message: "ALL_SCOPES stands alone: it already offers the variable for every field.",
        },
        {
          kind: "variable",
          name: `${PREFIX}flag`,
          collection: collection.name,
          message: "A BOOLEAN variable is offered for every field: its scopes can only be ALL_SCOPES.",
        },
      ],
      dry: true,
    });
  });

  it("refuses a real run until tokens are written, saying to pass dryRun, and makes nothing", async () => {
    const { collection } = await spaceHome();
    const mode = collection.modes[0] ?? "";
    const name = `${PREFIX}real`;
    const answer = await client.blocks("tokens_apply", {
      file,
      tokens: { collections: [{ name: collection.name, variables: [{ name, values: { [mode]: "4px" } }] }] },
    });

    expect(answer.isError).toBe(true);
    expect(JSON.stringify(answer.content)).toContain("dryRun: true");

    const after = await readTokens();

    expect(after.collections.flatMap(({ variables }) => variables.map((one) => one.name))).not.toContain(name);
  });
});

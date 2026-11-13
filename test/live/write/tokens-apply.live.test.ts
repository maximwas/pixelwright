import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient, type ToolResult } from "../support/live-client.ts";

/** The name of the variables the dry runs would make: they write nothing. */
const PREFIX = "live:tokens-apply:";

/** The scratch collection the real runs make, removed through execute after them: no tool deletes tokens. */
const LIVE = "live-tokens";

/** The live collection's two variables, the first an alias to the second made in the same call. */
const TWO_VARIABLES = [
  { name: "Gap/Wide", values: { Base: "var(--live-gap)" } },
  { name: "Gap", token: "--live-gap", values: { Base: "12px" }, scopes: ["GAP"] },
];

/** The words of a refused second mode (FX-054), whatever limit the file's Figma plan has: Starter's is 1. */
const DARK_REFUSED =
  /^The file's Figma plan allows \d+ modes? in a collection: Dark is not added, and its values are left out\.$/;

/** The styles the real runs make, named inside the live-tokens scope so removing them touches none of Test MCP's own. */
const LIVE_STYLES = {
  paint: [{ name: `${LIVE}/Fill`, token: "--live-tokens-Fill", value: "#336699" }],
  text: [{ name: `${LIVE}/Caption`, token: "--live-tokens-Caption-font", value: "400 14px/20px 'Inter'" }],
};

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

interface JsonStyle {
  readonly name: string;
  readonly token: string;
  readonly value: string;
}

interface JsonTokens {
  readonly collections: JsonCollection[];
  readonly styles: { readonly paint: JsonStyle[]; readonly text: JsonStyle[]; readonly effect: JsonStyle[] };
}

/**
 * Dry runs read Test MCP's own variables and write none (item 48); the real runs (item 49) make only the live-tokens
 * collection and styles named inside its scope, in order, and remove them through execute, so Test MCP's own
 * collections and styles never change.
 */
describe("write/tokens_apply", () => {
  const { file } = inject("live");
  let client: LiveClient;

  const apply = (args: ToolResult): Promise<ToolResult> => client.call("tokens_apply", { file, ...args });

  /** tokens_read's JSON of Test MCP, as tokens_apply takes it back in `tokens`. */
  const readTokens = async (): Promise<JsonTokens> =>
    (await client.call("tokens_read", { file, format: "json" })).tokens as JsonTokens;

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

  /** The live collection and the styles named inside its scope removed through execute (A§10.5 item 9); how many collections. */
  const removeLive = async (): Promise<unknown> =>
    (
      await client.call("execute", {
        file,
        code: `const live = (await figma.variables.getLocalVariableCollectionsAsync()).filter((collection) => collection.name === ${JSON.stringify(LIVE)});
for (const collection of live) collection.remove();
const styles = [...(await figma.getLocalPaintStylesAsync()), ...(await figma.getLocalTextStylesAsync()), ...(await figma.getLocalEffectStylesAsync())];
for (const style of styles) if (style.name.startsWith(${JSON.stringify(`${LIVE}/`)})) style.remove();
return live.length;`,
      })
    ).result;

  afterAll(async () => {
    // A run stopped halfway leaves the collection behind: removing it again is harmless.
    await removeLive();
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

  it("writes a live-tokens collection with two variables and an alias, and tokens_read shows them (T-165, FX-052)", async () => {
    const answer = await apply({
      tokens: { collections: [{ name: LIVE, modes: ["Base"], variables: TWO_VARIABLES }] },
    });

    expect(answer).toEqual({
      created: [
        { kind: "collection", name: LIVE },
        { kind: "mode", name: "Base", collection: LIVE },
        { kind: "variable", name: "Gap/Wide", collection: LIVE },
        { kind: "variable", name: "Gap", collection: LIVE },
      ],
      updated: [],
      errors: [],
    });

    const shown = (await readTokens()).collections.find(({ name }) => name === LIVE);

    expect(shown?.modes).toEqual(["Base"]);
    expect(
      shown?.variables
        .map(({ name, token, values }) => ({ name, token, values }))
        .sort((first, second) => first.name.localeCompare(second.name)),
    ).toEqual([
      { name: "Gap", token: "--live-gap", values: { Base: "12px" } },
      { name: "Gap/Wide", token: "--Gap-Wide", values: { Base: "var(--live-gap)" } },
    ]);
  });

  it("refuses a second mode past the Figma plan's limit as that mode's error and writes the rest; a dry run then knows it (FX-054, B-055)", async ({
    skip,
  }) => {
    const gap = { name: "Gap", token: "--live-gap", values: { Base: "16px", Dark: "20px" }, scopes: ["GAP"] };
    const tokens = { collections: [{ name: LIVE, modes: ["Base", "Dark"], variables: [gap] }] };
    const answer = await apply({ tokens });
    const [refusal] = answer.errors as ToolResult[];

    if (refusal === undefined) {
      skip("Test MCP's Figma plan allows a second mode in a collection: no refusal to learn the limit from.");
    }

    expect(answer).toEqual({
      created: [],
      updated: [{ kind: "variable", name: "Gap", collection: LIVE }],
      errors: [refusal],
    });
    expect(refusal).toMatchObject({
      kind: "mode",
      name: "Dark",
      collection: LIVE,
      message: expect.stringMatching(DARK_REFUSED),
    });
    // The limit is learned from the refusal: the dry run refuses the mode before anything is written.
    expect(await apply({ tokens, dryRun: true })).toEqual({ created: [], updated: [], errors: [refusal], dry: true });

    const shown = (await readTokens()).collections.find(({ name }) => name === LIVE);

    expect(shown?.modes).toEqual(["Base"]);
    expect(shown?.variables.find(({ name }) => name === "Gap")?.values).toEqual({ Base: "16px" });
  });

  it("makes a paint style and a text style inside the live-tokens scope, and tokens_read shows them (C-173, T-166)", async () => {
    expect(await apply({ tokens: { styles: LIVE_STYLES } })).toEqual({
      created: [
        { kind: "paint", name: `${LIVE}/Fill` },
        { kind: "text", name: `${LIVE}/Caption` },
      ],
      updated: [],
      errors: [],
    });

    const { paint, text } = (await readTokens()).styles;

    expect(paint.find(({ name }) => name === `${LIVE}/Fill`)).toMatchObject({
      token: "--live-tokens-Fill",
      value: expect.stringMatching(/^#336699$/i),
    });
    expect(text.find(({ name }) => name === `${LIVE}/Caption`)).toMatchObject({
      token: "--live-tokens-Caption-font",
      value: "400 14px/20px 'Inter'",
    });
    // What tokens_read shows is what the file holds: sent again, the call plans nothing.
    expect(await apply({ tokens: { styles: LIVE_STYLES }, dryRun: true })).toEqual({
      created: [],
      updated: [],
      errors: [],
      dry: true,
    });
  });

  it("writes nothing for its tokens_read JSON sent back: no version, no change (D-25)", async () => {
    const { tokens } = await client.call("tokens_read", { file, format: "json" });

    expect(await apply({ tokens })).toEqual({ created: [], updated: [], errors: [] });
  });

  it("removes the live collection and its styles through execute: no tool deletes tokens (A§10.5 item 9)", async () => {
    expect(await removeLive()).toBe(1);

    const { collections, styles } = await readTokens();

    expect(collections.map(({ name }) => name)).not.toContain(LIVE);
    expect(
      [...styles.paint, ...styles.text, ...styles.effect].filter(({ name }) => name.startsWith(`${LIVE}/`)),
    ).toEqual([]);
  });
});

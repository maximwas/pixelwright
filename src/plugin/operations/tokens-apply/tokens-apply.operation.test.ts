import { describe, expect, it } from "vitest";
import type * as zod from "zod/mini";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { FontCatalog } from "@/plugin/adapters/figma/fonts/font-catalog.ts";
import { ModeLimit } from "@/plugin/app/mode-limit.ts";
import { CollectionWriter } from "@/plugin/operations/tokens-apply/collection-writer.ts";
import { StyleLooks } from "@/plugin/operations/tokens-apply/style-looks.ts";
import { StyleWriter } from "@/plugin/operations/tokens-apply/style-writer.ts";
import { TokensApplyOperation } from "@/plugin/operations/tokens-apply/tokens-apply.operation.ts";
import { VariableValues } from "@/plugin/operations/tokens-apply/variable-values.ts";
import { VariableWriter } from "@/plugin/operations/tokens-apply/variable-writer.ts";
import type { tokensApplyOp } from "@/shared/ops/tokens-apply/tokens-apply.manifest.ts";
import type { TokensPlan } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

// No Figma here (CLAUDE.md): figma.variables and the styles are a stub that keeps what is written; the live suite
// writes real ones in Test MCP.

const COLOR = { r: 0.1, g: 0.2, b: 0.3, a: 1 };

const NO_STYLES = { paint: [], text: [], effect: [] };

type Answer = zod.output<typeof tokensApplyOp.output>;

type StubStyle = { readonly id: string; readonly name: string; readonly type: string; [field: string]: unknown };

/** Figma's variables and styles as the writer reaches them, Starter's limit on modes when given one. */
function figmaStub(modeLimit = Number.POSITIVE_INFINITY) {
  const log: string[] = [];
  const counter = { next: 0 };
  const id = (prefix: string) => `${prefix}:${++counter.next}`;
  const collections: { id: string; name: string; modes: { modeId: string; name: string }[] }[] = [];
  const variables: { id: string; name: string; valuesByMode: Record<string, unknown>; [field: string]: unknown }[] = [];
  const styles: Record<string, StubStyle[]> = { paint: [], text: [], effect: [] };
  const factory = {
    collections: async () => collections,
    variables: async () => variables,
    collection: (name: string) => {
      const made = {
        id: id("C"),
        name,
        defaultModeId: "M:default",
        modes: [{ modeId: "M:default", name: "Mode 1" }],
        renameMode: (modeId: string, renamed: string) => {
          made.modes = made.modes.map((mode) => (mode.modeId === modeId ? { modeId, name: renamed } : mode));
        },
        addMode: (added: string) => {
          if (made.modes.length >= modeLimit) {
            throw new Error(`in addMode: Limited to ${modeLimit} modes only`);
          }

          const modeId = id("M");

          made.modes.push({ modeId, name: added });

          return modeId;
        },
      };

      collections.push(made);

      return made;
    },
    variable: (
      name: string,
      _collection: unknown,
      type: string,
    ) => {
      log.push(`make ${name}`);

      const made = {
        id: id("V"),
        name,
        resolvedType: type,
        valuesByMode: {} as Record<string, unknown>,
        scopes: ["ALL_SCOPES"],
        codeSyntax: {} as Record<string, string>,
        setValueForMode: (modeId: string, value: unknown) => {
          log.push(`set ${name}`);
          made.valuesByMode[modeId] = value;
        },
        setVariableCodeSyntax: (platform: string, value: string) => {
          made.codeSyntax[platform] = value;
        },
      };

      variables.push(made);

      return made;
    },
    alias: (target: { id: string }) => ({ type: "VARIABLE_ALIAS", id: target.id }),
    styles: async (group: string) => styles[group] ?? [],
    style: (group: string, name: string) => {
      const made = { id: id("S"), name, type: group };

      styles[group]?.push(made);

      return made;
    },
  };

  return { factory, log, collections, variables, styles };
}

/** The writer as the plugin's root builds it, over the stub; what it imports, loads, merges and commits. */
function build(stub = figmaStub()) {
  const undo: string[] = [];
  const imports: string[] = [];
  const loaded: unknown[] = [];
  const merges: unknown[] = [];
  const paints = {
    colour: (color: typeof COLOR) => color,
    of: async (specs: { token?: string }[], bound: ReadonlyMap<string, { id: string }>) =>
      specs.map(({ token }) => ({ type: "SOLID", variable: bound.get(token ?? "")?.id })),
  };
  const effects = {
    merged: async (current: unknown[], specs: { type: string; radius: number }[]) => {
      merges.push(current);

      return specs.map(({ type, radius }) => ({ type, radius }));
    },
  };
  const fonts = ["Regular", "Bold"].map((style) => ({ fontName: { family: "Inter", style } }));
  const layers = { fonts: async () => fonts, loadFont: async (font: unknown) => loaded.push(font) };
  const library = { id: "V:lib", name: "Primary", resolvedType: "COLOR" };
  const catalogue = { imported: async (key: string) => imports.push(key) && library };
  const lookup = { variable: async () => null };
  const values = new VariableValues(paints as never, stub.factory as never, lookup as never, catalogue as never);
  const variables = new VariableWriter(
    stub.factory as never,
    new CollectionWriter(stub.factory as never, new ModeLimit()),
    values,
    new TokenNames(),
  );
  const looks = new StyleLooks(paints as never, effects as never, new FontCatalog(layers as never), values);
  const styles = new StyleWriter(stub.factory as never, looks, layers as never);
  const report = {
    succeeded: (output: unknown) => output,
    failed: (error: unknown) => {
      throw error;
    },
  };
  const operation = new TokensApplyOperation(report as never, variables, styles, {
    commitUndo: () => undo.push("undo"),
  } as never);
  const apply = async (plan: Partial<TokensPlan>, dryRun = false): Promise<Answer> => {
    const answer: unknown = await operation.run({ plan: { collections: [], styles: NO_STYLES, ...plan }, dryRun });

    return answer as Answer;
  };

  return { apply, stub, undo, imports, loaded, merges };
}

/** A colour variable with one value per mode. */
function ink(modes: readonly string[]) {
  return {
    name: "Ink",
    type: "COLOR" as const,
    values: Object.fromEntries(modes.map((mode) => [mode, { kind: "color" as const, color: COLOR }])),
  };
}

describe("TokensApplyOperation (T-165, P-163)", () => {
  it("makes a collection and every variable before any value, an alias from its target made after it (FX-052), one undo step", async () => {
    const { apply, stub, undo } = build();
    const answer = await apply({
      collections: [
        {
          name: "Spacing",
          modes: ["Base"],
          variables: [
            { name: "Gap/Wide", type: "FLOAT", values: { Base: { kind: "alias", token: "--live-gap" } } },
            {
              name: "Gap",
              type: "FLOAT",
              values: { Base: { kind: "number", value: 12 } },
              scopes: ["GAP"],
              codeSyntax: { WEB: "var(--live-gap)" },
            },
          ],
        },
      ],
    });
    const [wide, gap] = stub.variables;

    expect(answer).toEqual({
      created: [
        { kind: "collection", name: "Spacing" },
        { kind: "mode", name: "Base", collection: "Spacing" },
        { kind: "variable", name: "Gap/Wide", collection: "Spacing" },
        { kind: "variable", name: "Gap", collection: "Spacing" },
      ],
      updated: [],
      errors: [],
    });
    // A new collection's first mode renames Figma's default.
    expect(stub.collections.map(({ name, modes }) => [name, modes.map((mode) => mode.name)])).toEqual([
      ["Spacing", ["Base"]],
    ]);
    expect(stub.log).toEqual(["make Gap/Wide", "make Gap", "set Gap/Wide", "set Gap"]);
    expect(wide?.valuesByMode).toEqual({ "M:default": { type: "VARIABLE_ALIAS", id: gap?.id } });
    expect(gap).toMatchObject({
      valuesByMode: { "M:default": 12 },
      scopes: ["GAP"],
      codeSyntax: { WEB: "var(--live-gap)" },
    });
    expect(undo).toEqual(["undo"]);
  });

  it("refuses a mode past the Figma plan's limit as that mode's error, writes the rest, and a dry run learns the limit (FX-054, B-055)", async () => {
    const { apply, stub, undo } = build(figmaStub(1));
    const twoModes = {
      collections: [{ name: "Brand", modes: ["Light", "Dark"], variables: [ink(["Light", "Dark"])] }],
    };
    const refused = {
      kind: "mode",
      name: "Dark",
      collection: "Brand",
      message: "The file's Figma plan allows 1 mode in a collection: Dark is not added, and its values are left out.",
    };

    // Before Figma has refused a mode, a dry run cannot know the plan: it says so and writes nothing.
    expect((await apply(twoModes, true)).notes).toEqual([expect.stringContaining("Dark")]);
    expect(stub.collections).toEqual([]);
    expect(await apply(twoModes)).toEqual({
      created: [
        { kind: "collection", name: "Brand" },
        { kind: "mode", name: "Light", collection: "Brand" },
        { kind: "variable", name: "Ink", collection: "Brand" },
      ],
      updated: [],
      errors: [refused],
    });
    expect(stub.variables.map(({ valuesByMode }) => valuesByMode)).toEqual([{ "M:default": COLOR }]);

    const [brand] = stub.collections;
    const [held] = stub.variables;
    const darkOnly = {
      collections: [
        { name: "Brand", id: brand?.id ?? "", modes: ["Dark"], variables: [{ ...ink(["Dark"]), id: held?.id ?? "" }] },
      ],
    };

    expect(await apply(darkOnly, true)).toEqual({ created: [], updated: [], errors: [refused] });
    expect(undo).toEqual(["undo"]);
  });

  it("imports a library variable by its key before writing an alias to it on a real run, and imports nothing on a dry run (m:acc257ba)", async () => {
    const { apply, stub, imports } = build();
    const plan = {
      collections: [
        {
          name: "Brand",
          modes: ["Light"],
          variables: [
            {
              name: "Accent",
              type: "COLOR" as const,
              values: { Light: { kind: "alias" as const, token: "--Primary", key: "K:primary" } },
            },
          ],
        },
      ],
    };

    await apply(plan, true);
    expect(imports).toEqual([]);
    expect((await apply(plan)).errors).toEqual([]);
    expect(imports).toEqual(["K:primary"]);
    expect(stub.variables[0]?.valuesByMode).toEqual({ "M:default": { type: "VARIABLE_ALIAS", id: "V:lib" } });
  });

  it("makes a paint style bound to a variable the call made and a text style in a font Figma has, and changes only the shadows of an effect style (C-173, T-166)", async () => {
    const stub = figmaStub();

    stub.styles.effect?.push({
      id: "S:card",
      name: "Card",
      type: "effect",
      effects: [
        { type: "DROP_SHADOW", radius: 2 },
        { type: "LAYER_BLUR", radius: 4 },
      ],
    });

    const { apply, loaded, merges } = build(stub);
    const answer = await apply({
      collections: [{ name: "Brand", modes: ["Light"], variables: [ink(["Light"])] }],
      styles: {
        paint: [{ name: "Ink/Fill", paints: [{ kind: "token", token: "--Ink" }] }],
        text: [
          {
            name: "Caption",
            font: { family: "inter", weight: 700, italic: false, size: 12, lineHeight: { unit: "PIXELS", value: 16 } },
            textCase: "UPPER",
          },
        ],
        effect: [
          {
            name: "Card",
            id: "S:card",
            effects: [{ type: "DROP_SHADOW", radius: 8, x: 0, y: 2 }],
            covers: ["DROP_SHADOW", "INNER_SHADOW"],
          },
        ],
      },
      targets: { "--Ink": {} },
    });

    expect(answer.created.slice(3)).toEqual([
      { kind: "paint", name: "Ink/Fill" },
      { kind: "text", name: "Caption" },
    ]);
    expect(answer.updated).toEqual([{ kind: "effect", name: "Card" }]);
    expect(answer.errors).toEqual([]);
    expect(stub.styles.paint).toEqual([
      expect.objectContaining({ name: "Ink/Fill", paints: [{ type: "SOLID", variable: stub.variables[0]?.id }] }),
    ]);
    expect(loaded).toEqual([{ family: "Inter", style: "Bold" }]);
    expect(stub.styles.text).toEqual([
      expect.objectContaining({
        name: "Caption",
        fontName: { family: "Inter", style: "Bold" },
        fontSize: 12,
        lineHeight: { unit: "PIXELS", value: 16 },
        textCase: "UPPER",
      }),
    ]);
    // Only the shadows its CSS names are merged; the blur it leaves out stays where it was.
    expect(merges).toEqual([[{ type: "DROP_SHADOW", radius: 2 }]]);
    expect(stub.styles.effect?.[0]?.effects).toEqual([
      { type: "DROP_SHADOW", radius: 8 },
      { type: "LAYER_BLUR", radius: 4 },
    ]);
  });
});

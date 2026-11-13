import { describe, expect, it, vi } from "vitest";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { TextWriter } from "@/plugin/operations/apply/writers/text-writer.ts";

const UNDERLINE = { line: "UNDERLINE" };
const FONT = { family: "Inter", weight: 400, italic: false, size: 16, lineHeight: { unit: "AUTO" } };
const NO_FONT = { ...FONT, family: "Nope" };

/** Runs that refuse the family "Nope" and record what they write. */
function build() {
  const runs = {
    check: async ({ font }: { font?: { family: string } }) =>
      font?.family === "Nope" ? [{ key: "font", error: new WriteError("Figma has no font family Nope") }] : [],
    write: vi.fn(async (_key: string, _range: object, _props: { font?: { family: string } }) => undefined),
  };
  const look = {
    longest: () => undefined,
    restore: vi.fn(),
    inherit: async (
      _node: unknown,
      _fields: unknown,
      write: (start: number, end: number) => Promise<void>,
    ) =>
      await write(0, 3),
  };
  const assign = { set: vi.fn((node: object, values: object) => Object.assign(node, values)) };
  const fonts = { start: vi.fn(), unloadedIn: () => undefined };
  const writer = new TextWriter(fonts as never, look as never, runs as never, assign as never);

  return { writer, runs, assign };
}

/** A change to a text: its own props and the runs its Spans make. */
function change(props: object, runs: object[] = []) {
  return { props, text: { characters: "Old", runs } } as never;
}

function layer(type: string) {
  return { type } as never;
}

function text(characters: string, extra: object = {}) {
  return { type: "TEXT", characters, getStyledTextSegments: () => [], ...extra };
}

describe("TextWriter checks", () => {
  it("refuses a font family this Figma lacks, on the font", async () => {
    const { writer } = build();

    const found = await writer.checks(change({ font: NO_FONT }), layer("TEXT"), new Set());

    expect(found.map(({ keys }) => keys)).toEqual([["font"]]);
    expect(found[0]).toMatchObject({ error: { message: "Figma has no font family Nope" } });
  });

  // A TextPath has no decoration: the dry run answers what the real run would throw (setRangeTextDecoration is missing).
  it("refuses a decoration on a text on a path, in the text and in a Span of it alike", async () => {
    const { writer } = build();
    const own = await writer.checks(change({ textDecoration: UNDERLINE }), layer("TEXT_PATH"), new Set());
    const span = await writer.checks(
      change({}, [{ start: 0, end: 1, props: { textDecoration: UNDERLINE } }]),
      layer("TEXT_PATH"),
      new Set(),
    );

    expect(own.map(({ keys, span }) => [keys, span])).toEqual([[["textDecoration"], undefined]]);
    expect(span.map(({ keys, span }) => [keys, span])).toEqual([[["textDecoration"], 0]]);
    expect(span[0]?.error).toEqual(own[0]?.error);
  });

  it("names the key a Span's refusal is for, with the Span's index", async () => {
    const { writer } = build();
    const runs = [
      { start: 0, end: 1, props: { font: FONT } },
      { start: 1, end: 2, props: { font: NO_FONT } },
    ];

    const found = await writer.checks(change({}, runs), layer("TEXT"), new Set());

    expect(found.map(({ keys, span }) => [keys, span])).toEqual([[["font"], 1]]);
  });
});

describe("TextWriter write", () => {
  it("skips only the key a Span's refusal names, and writes the Span's others", async () => {
    const { writer, runs } = build();
    const node = text("Old");
    const props = { font: NO_FONT, textCase: "UPPER" };
    const spans = [{ start: 0, end: 3, props }];
    const refusals = [{ error: new Error("no font"), keys: ["font"], span: 0 }];

    await writer.write(node as never, change({}, spans), refusals as never, vi.fn());

    expect(runs.write.mock.calls.map(([key]) => key)).toEqual(["textCase"]);
  });

  it("leaves the text's own key alone when only a Span's was refused", async () => {
    const { writer, runs } = build();
    const spans = [{ start: 0, end: 3, props: { font: NO_FONT } }];
    const refusals = [{ error: new Error("no font"), keys: ["font"], span: 0 }];

    await writer.write(text("Old") as never, change({ font: FONT }, spans), refusals as never, vi.fn());

    expect(runs.write.mock.calls.map(([key, , props]) => [key, props.font?.family])).toEqual([["font", "Inter"]]);
  });
});

describe("TextWriter characters", () => {
  // P-152: written on the text itself, the characters of a text an instance binds to a property do not stick.
  it("sets the property of the nearest instance that has it, not the text", async () => {
    const { writer, assign } = build();
    const setProperties = vi.fn();
    const outer = { type: "INSTANCE", componentProperties: { "Title#1:1": {} }, setProperties: vi.fn(), parent: null };
    const inner = { type: "INSTANCE", componentProperties: { "Title#1:1": {} }, setProperties, parent: outer };
    const frame = { type: "FRAME", parent: inner };
    const node = text("Old", { componentPropertyReferences: { characters: "Title#1:1" }, parent: frame });

    await writer.write(node as never, { props: {}, text: { characters: "New", runs: [] } } as never, [], vi.fn());

    expect(setProperties).toHaveBeenCalledWith({ "Title#1:1": "New" });
    expect(outer.setProperties).not.toHaveBeenCalled();
    expect(assign.set).not.toHaveBeenCalled();
  });

  it("writes the text itself when no instance above it has the property", async () => {
    const { writer, assign } = build();
    const bare = { type: "INSTANCE", componentProperties: {}, setProperties: vi.fn(), parent: null };
    const node = text("Old", { componentPropertyReferences: { characters: "Title#1:1" }, parent: bare });

    await writer.write(node as never, { props: {}, text: { characters: "New", runs: [] } } as never, [], vi.fn());

    expect(assign.set).toHaveBeenCalledWith(node, { characters: "New" });
    expect(bare.setProperties).not.toHaveBeenCalled();
  });

  it("writes the text itself in a component's own layer, where no instance above is its own", async () => {
    const { writer, assign } = build();
    const above = { type: "INSTANCE", componentProperties: { "Title#1:1": {} }, setProperties: vi.fn(), parent: null };
    const component = { type: "COMPONENT", parent: above };
    const node = text("Old", { componentPropertyReferences: { characters: "Title#1:1" }, parent: component });

    await writer.write(node as never, { props: {}, text: { characters: "New", runs: [] } } as never, [], vi.fn());

    expect(assign.set).toHaveBeenCalledWith(node, { characters: "New" });
    expect(above.setProperties).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import type { ApplyChange } from "@/core/apply/apply.types.ts";
import type { WritePlanner } from "@/core/apply/plan/write-planner.ts";
import { VersionedWrite } from "@/server/app/writes/versioned-write.ts";
import { ApplyFiles } from "@/server/tools/design-apply/apply-files.ts";
import { type DesignApplyOutput, DesignApplyOutputSchema } from "@/server/tools/design-apply/design-apply.schema.ts";
import { DesignApplyTool } from "@/server/tools/design-apply/design-apply.tool.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";

// Without ids to read and changes to write the plugin is never reached, so the session is never called. No element
// names a file: the files change nothing and go on no change.
function tool(planner = {} as WritePlanner, session = {}): DesignApplyTool {
  const files = new ApplyFiles(
    planner,
    { of: async () => new Map() } as never,
    { attach: async (changes: unknown[]) => ({ changes, errors: [] }) } as never,
    { of: async () => ({}) } as never,
  );

  return new DesignApplyTool(session as never, new VersionedWrite(), { due: () => null } as never, files);
}

const APPLIED = { created: [], changed: [], errors: [] };

const IDLE = {
  layersToRead: () => [],
  plan: () => ({ changes: [], written: [], send: [], errors: [], notWritten: new Map() }),
} as never;

describe("DesignApplyTool", () => {
  it("answers INVALID_XML with the line, the column and the words", async () => {
    await expect(tool().execute({ xml: "<Frame>\n  <Text>Hi</Frame>", dryRun: true })).rejects.toMatchObject({
      code: ERROR_CODE.invalidXml,
      message: expect.stringContaining("line 2, column 11: Expected </Text> for the tag at line 2, found </Frame>."),
    });
  });

  it("answers a dry run with the elements it read and every refusal", async () => {
    const answer = await tool(IDLE).execute({ xml: '<Frame><Text x="10">&mdash;</Text></Frame>', dryRun: true });
    const content = answer.structuredContent as {
      elements: { tag: string; ref: string }[];
      errors: { attribute?: string }[];
    };

    expect(content).toMatchObject({ dry: true });
    expect(content.elements.map(({ tag, ref }) => [tag, ref])).toEqual([
      ["Frame", "new:1"],
      ["Text", "new:1:8"],
    ]);
    expect(content.errors.map(({ attribute }) => attribute)).toEqual(["x"]);
  });

  // Item 34: a dry run reads the named layers with the apply profile and lists the changes the plan makes.
  it("reads the named layers with the apply profile and lists what the plan changes", async () => {
    const asked: unknown[] = [];
    const session = {
      run: async (op: { name: string }, input: unknown) => {
        asked.push(input);

        return op.name === "read" ? { reads: [], missing: [], cuts: [] } : { ...APPLIED, changed: ["81:1"] };
      },
    };
    const layout: ApplyChange = {
      line: 1,
      column: 1,
      kind: "update",
      ref: "81:1",
      id: "81:1",
      tag: "Frame",
      parent: null,
      index: 0,
      props: { itemSpacing: 12 },
      sources: { itemSpacing: "gap" },
    };
    const planner = {
      layersToRead: () => ["81:1"],
      plan: () => ({ changes: [layout], written: [layout], send: [layout], errors: [], notWritten: new Map() }),
    } as never;
    const answer = await tool(planner, session).execute({ xml: '<Frame id="81:1" gap="12px"/>', dryRun: true });

    expect(asked).toEqual([
      { nodes: ["81:1"], profile: "apply" },
      { changes: [layout], dryRun: true },
    ]);
    expect(answer.structuredContent).toMatchObject({
      dry: true,
      changes: [{ id: "81:1", tag: "Frame", kind: "update", props: { itemSpacing: 12 } }],
    });
  });

  it("lists, per element, the attributes no writer handles yet", async () => {
    const planner = {
      layersToRead: () => [],
      plan: () => ({
        changes: [],
        written: [],
        send: [],
        errors: [],
        notWritten: new Map([["new:1", ["background"]]]),
      }),
    } as never;
    const answer = await tool(planner).execute({ xml: '<Frame background="#f00"/>', dryRun: true });

    expect(answer.structuredContent).toMatchObject({ elements: [{ ref: "new:1", notWritten: ["background"] }] });
  });

  // The MCP client rejects an answer whose objects carry a key the declared outputSchema does not list (live failure).
  it("answers a dry run whose changes and elements carry only the keys of the declared output schema", async () => {
    const copy: ApplyChange = {
      line: 1,
      column: 1,
      kind: "create",
      ref: "new:1",
      id: null,
      tag: "Frame",
      parent: null,
      index: 0,
      before: "1:1",
      after: "1:2",
      props: {},
      sources: {},
      text: { characters: "Hi", runs: [] },
      copyOf: "1:3",
      source: "1:4",
      copy: "new:1",
    };
    const planner = {
      layersToRead: () => [],
      plan: () => ({ changes: [copy], written: [copy], send: [copy], errors: [], notWritten: new Map() }),
    } as never;
    const answer = await tool(planner, { run: async () => APPLIED }).execute({ xml: "<Frame/>", dryRun: true });
    const schema = zod.toJSONSchema(DesignApplyOutputSchema, { target: "draft-2020-12", io: "output" }) as {
      properties: Record<string, { items: { properties: Record<string, unknown> } }>;
    };
    const content = answer.structuredContent as Record<string, Record<string, unknown>[]>;

    expect(content.changes?.[0]?.text).toEqual({ characters: "Hi", runs: [] });

    for (const list of ["elements", "changes"]) {
      const listed = Object.keys(schema.properties[list]?.items.properties ?? {});
      const extra = (content[list] ?? []).flatMap((entry) => Object.keys(entry).filter((key) => !listed.includes(key)));

      expect(extra, list).toEqual([]);
    }
  });

  // T-142: one planner for dry and real runs: a real run is planned exactly as a dry one.
  it("plans a real run as a dry one", async () => {
    const asked: unknown[] = [];
    const planner = {
      layersToRead: () => [],
      plan: (...args: unknown[]) => {
        asked.push(args);

        return { changes: [], written: [], send: [], errors: [], notWritten: new Map() };
      },
    } as never;

    await tool(planner).execute({ xml: '<Text name="A">Hi</Text>', dryRun: true });
    await tool(planner).execute({ xml: '<Text name="A">Hi</Text>' });
    expect(asked).toHaveLength(2);
    expect(asked[1]).toEqual(asked[0]);
  });

  // T-120, T-121: the changes go to the apply op with the parent; its errors join the call's in the XML's order.
  it("writes the planned changes through the apply op and answers what it made", async () => {
    const frame: ApplyChange = {
      line: 2,
      column: 1,
      kind: "create",
      ref: "new:2",
      id: null,
      tag: "Frame",
      parent: null,
      index: 0,
      props: {},
      sources: {},
    };
    const asked: unknown[] = [];
    const planner = {
      layersToRead: () => [],
      plan: () => ({ changes: [frame], written: [frame], send: [frame], errors: [], notWritten: new Map() }),
    } as never;
    const session = {
      run: async (_op: unknown, input: unknown) => {
        asked.push(input);

        return {
          created: [{ line: 2, ref: "new:2", id: "9:2", tag: "Frame", name: "Frame" }],
          changed: [],
          errors: [{ line: 3, column: 1, message: "No layer 9:9 in this file." }],
        };
      },
    };
    const answer = await tool(planner, session).execute({ xml: '<Frame/>\n<Frame x="1"/>', parent: "9:1" });
    const content = answer.structuredContent as DesignApplyOutput;

    expect(asked).toEqual([{ changes: [frame], parent: "9:1", dryRun: false }]);
    expect(content.created).toEqual([{ line: 2, ref: "new:2", id: "9:2", tag: "Frame", name: "Frame" }]);
    expect(content.errors.map(({ line }) => line)).toEqual([2, 3]);
    expect(content.dry).toBeUndefined();
  });

  // Nothing to write: no plugin write, no version, nothing created or changed.
  it("answers at once when nothing writes", async () => {
    const answer = await tool(IDLE).execute({ xml: "<Frame/>", version: "Before" });

    expect(answer.structuredContent).toMatchObject({ created: [], changed: [], errors: [] });
    expect(answer.structuredContent).not.toHaveProperty("version");
  });
});

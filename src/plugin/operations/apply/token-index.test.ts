import { describe, expect, it } from "vitest";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import type { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { TOKEN_KIND } from "@/plugin/operations/apply/apply.constants.ts";
import { TokenIndex } from "@/plugin/operations/apply/token-index.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

function raw(...variables: [string, string][]): RawTokens {
  return {
    collections: [],
    variables: variables.map(([name, resolvedType]) => ({
      id: `V:${name}`,
      name,
      collectionId: "C:1",
      resolvedType,
      scopes: [],
      valuesByMode: {},
    })),
    external: {},
    styles: [{ id: "S:1", type: TOKEN_KIND.paint, name: "Card" } as RawTokens["styles"][number]],
  };
}

/** The index over hand-made ports; `pages` is what the current page reads, one entry per call. */
function build(pages: RawTokens[]) {
  const reads: number[] = [];
  const files = {
    read: async () => {
      reads.push(1);

      return pages[Math.min(reads.length, pages.length) - 1];
    },
    otherPages: async () => [],
  } as never;
  const catalogue = { read: async () => ({}) } as never;
  const lookup = { variable: async (id: string) => ({ id }) } as never;

  return { index: new TokenIndex(files, catalogue, new TokenNames(), lookup), reads };
}

async function refusal(promise: Promise<unknown>): Promise<WriteError> {
  return (await promise.then(
    () => new Error("not refused"),
    (error: unknown) => error,
  )) as WriteError;
}

describe("TokenIndex", () => {
  it("finds a variable and a paint style by their CSS names", async () => {
    const { index } = build([raw(["ink", "COLOR"])]);

    index.start(0);

    expect((await index.variable("--ink", TOKEN_KIND.colour)).id).toBe("V:ink");
    expect(await index.style("--Card", TOKEN_KIND.paint)).toBe("S:1");
    expect(await index.style("--Nope", TOKEN_KIND.paint)).toBeNull();
  });

  it("refuses a variable of another type, naming both", async () => {
    const { index } = build([raw(["gap", "FLOAT"])]);

    index.start(0);

    expect((await refusal(index.check("--gap", TOKEN_KIND.colour))).message).toBe(
      "--gap is a float variable: this needs a color one.",
    );
  });

  it("answers an unknown name with the near one, or the list when none is near", async () => {
    const { index } = build([raw(["ink", "COLOR"])]);

    index.start(0);

    expect((await refusal(index.check("--inq", TOKEN_KIND.colour))).hint).toContain("Did you mean --ink?");
    expect((await refusal(index.check("--zzzzzzzz", TOKEN_KIND.colour))).hint).toContain("tokens_read lists");
  });

  // One call's index: the file may have changed between calls.
  it("reads the file again after start() and forgets what the last call read", async () => {
    const { index, reads } = build([raw(["ink", "COLOR"]), raw(["paper", "COLOR"])]);

    index.start(0);
    await index.check("--ink", TOKEN_KIND.colour);
    await index.check("--ink", TOKEN_KIND.colour);

    expect(reads).toHaveLength(1);

    index.start(0);

    await expect(index.check("--paper", TOKEN_KIND.colour)).resolves.toBeUndefined();
    expect(reads).toHaveLength(2);
    expect((await refusal(index.check("--ink", TOKEN_KIND.colour))).message).toContain("--ink");
  });
});

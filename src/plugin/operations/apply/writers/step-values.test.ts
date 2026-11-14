import { describe, expect, it, vi } from "vitest";
import { Assign } from "@/plugin/adapters/figma/assign.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { LayoutStep } from "@/plugin/operations/apply/writers/layout/layout-step.ts";
import { StepValues } from "@/plugin/operations/apply/writers/step-values.ts";

const space = { id: "VariableID:1:1", name: "space/md" };

/** A file with one number variable, --space-md; any other name is unknown, a colour is of the wrong type. */
function tokens() {
  const find = async (token: string, type: string) => {
    if (token !== "space-md") {
      throw new WriteError(`No variable is named ${token}.`);
    }

    if (type !== "FLOAT") {
      throw new WriteError(`${token} is a FLOAT.`);
    }

    return space;
  };

  return { check: vi.fn(find), variable: vi.fn(find) };
}

function frame(bound: Record<string, { id: string }> = {}) {
  const node = {
    type: "FRAME",
    layoutMode: "NONE",
    itemSpacing: 0,
    paddingTop: 0,
    boundVariables: { ...bound },
    setBoundVariable: vi.fn((field: string, variable: { id: string } | null) => {
      if (variable === null) {
        delete node.boundVariables[field];
      } else {
        node.boundVariables[field] = { id: variable.id };
      }
    }),
  };

  return node;
}

describe("StepValues", () => {
  it("finds a length's token as a number variable on either run, and refuses an unknown or a colour one", async () => {
    const index = tokens();
    const values = new StepValues(index as never, new Assign());

    await expect(
      values.check({ itemSpacing: 4, padding: [{ token: "space-md" }, 0, 0, 0], minWidth: null, width: undefined }),
    ).resolves.toBeUndefined();
    expect(index.check).toHaveBeenCalledWith("space-md", "FLOAT", undefined);
    await expect(values.check({ itemSpacing: 4, padding: [0, { token: "space-xl" }, 0, 0] })).rejects.toThrow(
      /space-xl/,
    );
  });

  it("names the prop whose token cannot bind, so the error goes on its attribute", async () => {
    const values = new StepValues(tokens() as never, new Assign());
    const error = await values.check({ itemSpacing: 4, gridRowGap: { token: "space-xl" } }).catch((thrown) => thrown);

    expect(error).toBeInstanceOf(WriteError);
    expect(error.keys).toEqual(["gridRowGap"]);
  });

  it("binds a token's variable to its field, and a number over a bound field unbinds it", async () => {
    const node = frame({ paddingTop: { id: "VariableID:9:9" } });
    const values = new StepValues(tokens() as never, new Assign());

    await values.write(node as never, { itemSpacing: { token: "space-md" }, paddingTop: 12 });

    expect(node.setBoundVariable).toHaveBeenCalledWith("itemSpacing", space);
    expect(node.setBoundVariable).toHaveBeenCalledWith("paddingTop", null);
    expect(node.paddingTop).toBe(12);
    expect(node.boundVariables).toEqual({ itemSpacing: { id: space.id } });
  });

  it("binds nothing again where the field holds the variable already", async () => {
    const node = frame({ itemSpacing: { id: space.id } });

    await new StepValues(tokens() as never, new Assign()).write(node as never, { itemSpacing: { token: "space-md" } });

    expect(node.setBoundVariable).not.toHaveBeenCalled();
  });
});

describe("LayoutStep with tokens", () => {
  it("writes nothing when one of its tokens cannot be bound: every one is found first", async () => {
    const node = frame();
    const step = new LayoutStep(new Assign(), new StepValues(tokens() as never, new Assign()));

    await expect(
      step.write(node as never, { layoutMode: "VERTICAL", itemSpacing: 8, padding: [{ token: "nope" }, 0, 0, 0] }),
    ).rejects.toThrow(/nope/);
    expect(node.layoutMode).toBe("NONE");
    expect(node.itemSpacing).toBe(0);
  });

  it("binds a gap and a padding side to the number variable their var() names", async () => {
    const node = frame();
    const step = new LayoutStep(new Assign(), new StepValues(tokens() as never, new Assign()));

    await step.write(node as never, {
      layoutMode: "VERTICAL",
      itemSpacing: { token: "space-md" },
      padding: [{ token: "space-md" }, 4, 4, 4],
    });

    expect(node.layoutMode).toBe("VERTICAL");
    expect(node.boundVariables).toEqual({ itemSpacing: { id: space.id }, paddingTop: { id: space.id } });
  });
});

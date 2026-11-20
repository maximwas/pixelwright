import { describe, expect, it, vi } from "vitest";
import { LayerBoxes } from "@/plugin/adapters/figma/layer-boxes.ts";
import { ICON_TAG } from "@/plugin/operations/apply/apply.constants.ts";
import { LayerWriter } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import { APPLY_CHANGE_KIND } from "@/shared/ops/apply/apply.constants.ts";

function write(
  kind: string,
  props: object,
  node: object,
  tag = ICON_TAG,
) {
  const seen: object[] = [];
  const step = { keys: ["name"], capability: null, write: (_node: unknown, given: object) => void seen.push(given) };
  const text = { write: async () => false };
  const writer = new LayerWriter([step] as never, text as never, {} as never, new LayerBoxes());
  const fail = vi.fn();

  return {
    done: writer.write(node as never, { kind, tag, props: { name: "i", ...props } } as never, [], fail),
    fail,
    seen,
  };
}

function icon(box: { width: number; height: number }, drawn?: { width: number; height: number }) {
  return { ...box, absoluteBoundingBox: box, absoluteRenderBounds: drawn ?? box, rescale: vi.fn() };
}

describe("LayerWriter icon fit", () => {
  it("scales a new Icon whole by its width, else its height, and hands the steps the props without the size", async () => {
    const byWidth = icon({ width: 24, height: 24 });
    const first = write(APPLY_CHANGE_KIND.create, { width: 48 }, byWidth);

    expect(await first.done).toBe(true);
    expect(byWidth.rescale).toHaveBeenCalledWith(2);
    expect(first.seen).toEqual([{ name: "i" }]);

    const byHeight = icon({ width: 20, height: 10 });

    await write(APPLY_CHANGE_KIND.create, { height: 30 }, byHeight).done;
    expect(byHeight.rescale).toHaveBeenCalledWith(3);
  });

  it("scales nothing for a size that reads the same", async () => {
    const same = icon({ width: 24, height: 24 });

    await write(APPLY_CHANGE_KIND.create, { width: 24.2 }, same).done;
    expect(same.rescale).not.toHaveBeenCalled();
  });

  it("measures an existing Icon by the box it draws in when that reaches past its own", async () => {
    const past = icon({ width: 24, height: 24 }, { width: 30, height: 30 });

    await write(APPLY_CHANGE_KIND.update, { width: 60 }, past).done;
    expect(past.rescale).toHaveBeenCalledWith(2);

    const within = icon({ width: 24, height: 24 }, { width: 24.3, height: 24.3 });

    await write(APPLY_CHANGE_KIND.update, { width: 48 }, within).done;
    expect(within.rescale).toHaveBeenCalledWith(2);
  });

  it("leaves a layer that is no Icon alone, and names the size when Figma refuses the scaling", async () => {
    const frame = icon({ width: 24, height: 24 });
    const other = write(APPLY_CHANGE_KIND.create, { width: 48 }, frame, "Frame");

    await other.done;
    expect(frame.rescale).not.toHaveBeenCalled();
    expect(other.seen).toEqual([{ name: "i", width: 48 }]);

    const refused = icon({ width: 24, height: 24 });

    refused.rescale.mockImplementation(() => {
      throw new Error("instance");
    });

    const run = write(APPLY_CHANGE_KIND.create, { width: 48 }, refused);

    await run.done;
    expect(run.fail).toHaveBeenCalledWith(expect.any(Error), STEP_KEYS.size);
  });
});

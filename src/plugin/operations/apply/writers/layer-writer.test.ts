import { describe, expect, it } from "vitest";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { LayerWriter, type WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";

const layer = {} as TypedLayer;
const change = { props: { fills: [], opacity: 0.5, name: "x" } } as never;

describe("LayerWriter.checks", () => {
  /** Steps that log what they were asked; `broken` ones throw from check. */
  function build(broken: string[] = []) {
    const log: string[] = [];
    const step = (
      id: string,
      keys: WriteStep["keys"],
      check = true,
    ): WriteStep => ({
      keys,
      capability: null,
      write: () => {
        log.push(`write ${id}`);
      },
      ...(check
        ? {
          check: () => {
            log.push(`check ${id}`);

            if (broken.includes(id)) {
              throw new Error(id);
            }
          },
        }
        : {}),
    });
    const writer = new LayerWriter(
      [
        step("fills", ["fills"]),
        step("opacity", ["opacity"]),
        step("name", ["name"], false),
        step("blend", ["blendMode"]),
      ],
      {} as never,
      {} as never,
    );

    return { writer, log };
  }

  it("runs the check of every step the change names, and writes nothing", async () => {
    const { writer, log } = build();

    expect(await writer.checks(change, layer, [])).toEqual([]);
    expect(log).toEqual(["check fills", "check opacity"]);
  });

  it("collects each step's refusal with its keys and still checks the others", async () => {
    const { writer } = build(["fills", "opacity"]);
    const found = await writer.checks(change, layer, []);

    expect(found.map(({ keys }) => keys)).toEqual([["fills"], ["opacity"]]);
  });

  it("does not check a step an earlier refusal already covers", async () => {
    const { writer, log } = build(["fills"]);

    await writer.checks(change, layer, [{ error: new Error("capability"), keys: ["fills"] }]);

    expect(log).toEqual(["check opacity"]);
  });
});

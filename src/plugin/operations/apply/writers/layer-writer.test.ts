import { describe, expect, it, vi } from "vitest";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { ApplyReport } from "@/plugin/operations/apply/report.ts";
import { LayerWriter, type WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

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
      { checks: async () => [] } as never,
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

  it("narrows a refusal to the props its WriteError names", async () => {
    const writer = new LayerWriter(
      [
        {
          keys: ["layoutMode", "itemSpacing", "gridRowGap"],
          capability: null,
          write: () => undefined,
          check: () => {
            throw new WriteError("No variable is named nope.", undefined, ["gridRowGap"]);
          },
        },
      ],
      { checks: async () => [] } as never,
      {} as never,
      {} as never,
    );
    const found = await writer.checks(
      { props: { layoutMode: "VERTICAL", gridRowGap: { token: "nope" } } } as never,
      layer,
      [],
    );

    expect(found.map(({ keys }) => keys)).toEqual([["gridRowGap"]]);
  });

  // NEW-090: a note's pins are read against the layer's state after the change, so the check is given the change itself.
  it("gives a step's check the change it is for, with the layer", async () => {
    const seen: unknown[] = [];
    const writer = new LayerWriter(
      [
        {
          keys: ["notes"],
          capability: null,
          write: () => undefined,
          check: (
            _props,
            given,
            whole,
          ) => {
            seen.push(given, whole);
          },
        },
      ],
      { checks: async () => [] } as never,
      {} as never,
      {} as never,
    );
    const whole = { kind: "update", props: { notes: [] } } as never;

    await writer.checks(whole, layer, []);

    expect(seen).toEqual([layer, whole]);
  });

  it("does not check a step an earlier refusal already covers", async () => {
    const { writer, log } = build(["fills"]);

    await writer.checks(change, layer, [{ error: new Error("capability"), keys: ["fills"] }]);

    expect(log).toEqual(["check opacity"]);
  });
});

describe("LayerWriter.write", () => {
  const gap = {
    line: 3,
    column: 1,
    id: null,
    props: { layoutMode: "VERTICAL", itemSpacing: { token: "nope" } },
    sources: { layoutMode: "display", itemSpacing: "gap" },
  } as never;
  const node = {} as SceneNode;

  /** A layout step as StepValues makes it: its check names the gap, its write throws the same error unkeyed. */
  function layoutStep(
    seen: FigmaProps[],
    keys: WriteStep["keys"] = ["layoutMode", "itemSpacing"],
    failure: (props: FigmaProps) => unknown = () => new WriteError("No variable is named nope."),
  ): WriteStep {
    return {
      keys,
      capability: null,
      check: (props) => {
        if (props.itemSpacing !== undefined) {
          throw new WriteError("No variable is named nope.", undefined, ["itemSpacing"]);
        }
      },
      write: (_layer, props) => {
        seen.push(props);

        if (props.itemSpacing !== undefined) {
          throw failure(props);
        }
      },
    };
  }

  function build(step: WriteStep) {
    return new LayerWriter(
      [step],
      { checks: async () => [], write: async () => false } as never,
      { set: () => undefined } as never,
      {} as never,
    );
  }

  it("reports a step's token error once, on its prop, as the dry run does", async () => {
    const seen: FigmaProps[] = [];
    const writer = build(layoutStep(seen));
    const refusals = await writer.checks(gap, layer, []);
    const dry = new ApplyReport();
    const real = new ApplyReport();

    for (const { error, keys } of refusals) {
      dry.fail(gap, error, keys);
      real.fail(gap, error, keys);
    }

    await writer.write(node, gap, refusals, (error, keys) => real.fail(gap, error, keys));

    expect(real.result().errors).toEqual(dry.result().errors);
    expect(real.result().errors.map(({ attribute }) => attribute)).toEqual(["gap"]);
    expect(seen).toEqual([{ layoutMode: "VERTICAL" }]);
  });

  it("fails only the props a WriteError thrown in write names", async () => {
    const writer = build(
      layoutStep([], ["layoutMode", "itemSpacing", "gridRowGap"], () => {
        return new WriteError("No variable is named nope.", undefined, ["gridRowGap"]);
      }),
    );
    const fail = vi.fn();

    await writer.write(node, gap, [], fail);

    expect(fail).toHaveBeenCalledOnce();
    expect(fail.mock.calls[0]?.[1]).toEqual(["gridRowGap"]);
  });

  it("never reports a key the checks refused again, a step's own failure going to its other keys", async () => {
    const writer = build(layoutStep([], ["itemSpacing", "layoutMode"], () => new Error("Figma said no.")));
    const fail = vi.fn();
    const frame = { props: { layoutMode: "VERTICAL", itemSpacing: 4 } } as never;

    await writer.write(node, frame, [], fail);
    expect(fail.mock.calls[0]?.[1]).toEqual(["itemSpacing", "layoutMode"]);

    fail.mockClear();
    await writer.write(node, frame, [{ error: new Error("capability"), keys: ["layoutMode"] }], fail);
    expect(fail.mock.calls[0]?.[1]).toEqual(["itemSpacing"]);
  });
});

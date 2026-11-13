import { describe, expect, it, vi } from "vitest";
import { ModeStep } from "@/plugin/operations/apply/writers/mode-step.ts";

const theme = {
  id: "c1",
  name: "Theme",
  modes: [
    { modeId: "m1", name: "Light" },
    { modeId: "m2", name: "Dark" },
  ],
};

function build() {
  const names = { attribute: (name: string) => name.toLowerCase() };

  return new ModeStep(
    { collections: async () => [theme] } as never,
    { collection: async () => null } as never,
    names as never,
  );
}

function layer(explicit: Record<string, string> = {}) {
  return {
    type: "FRAME",
    resolvedVariableModes: {},
    explicitVariableModes: explicit,
    setExplicitVariableModeForCollection: vi.fn(),
    clearExplicitVariableModeForCollection: vi.fn(),
  };
}

describe("ModeStep.check", () => {
  it("finds a collection and a mode by name or slug on a layer typed only (a dry run's new layer)", async () => {
    const step = build();

    await expect(step.check({ modes: { theme: "dark", Theme: "Light" } }, { type: "FRAME" })).resolves.toBeUndefined();
    await expect(step.check({ modes: { theme: "" } }, { type: "FRAME" })).resolves.toBeUndefined();
  });

  it("refuses a collection the file lacks, and a mode the collection lacks", async () => {
    const step = build();

    await expect(step.check({ modes: { colours: "dark" } }, { type: "FRAME" })).rejects.toThrow(/data-colours/);
    await expect(step.check({ modes: { theme: "sepia" } }, { type: "FRAME" })).rejects.toThrow(/sepia/);
  });
});

describe("ModeStep.write", () => {
  it("sets a mode where the layer is not in it, and clears the collection's on an empty one", async () => {
    const frame = layer({ c1: "m1" });

    await build().write(frame as never, { modes: { theme: "dark" } });
    expect(frame.setExplicitVariableModeForCollection).toHaveBeenCalledWith(theme, "m2");

    await build().write(frame as never, { modes: { theme: "" } });
    expect(frame.clearExplicitVariableModeForCollection).toHaveBeenCalledWith(theme);
  });

  it("changes nothing when one name is wrong", async () => {
    const frame = layer();

    await expect(build().write(frame as never, { modes: { theme: "dark", nope: "x" } })).rejects.toThrow(/data-nope/);
    expect(frame.setExplicitVariableModeForCollection).not.toHaveBeenCalled();
  });

  it("refuses a layer that takes no modes", async () => {
    await expect(build().write({ type: "TEXT" } as never, { modes: { theme: "dark" } })).rejects.toThrow(
      /no variable modes/,
    );
  });
});

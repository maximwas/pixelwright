import { afterEach, describe, expect, it, vi } from "vitest";
import { ComponentIndex } from "@/plugin/adapters/figma/components/component-index.ts";
import { Variants } from "@/plugin/adapters/figma/components/variants.ts";

describe("ComponentIndex", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // FX-017, m:b2edadeb: Figma never settles a set import of a key that is no published set, and once not a component
  // import either; the import by key gives up at 10 s instead of holding the call to its request timeout.
  it("gives up a library import by key that Figma never answers after 10 s", async () => {
    vi.useFakeTimers();

    // No Figma here (CLAUDE.md): the two imports stand in as promises that never settle, as Figma's did live.
    const never = () => new Promise<never>(() => undefined);

    vi.stubGlobal("figma", { importComponentSetByKeyAsync: never, importComponentByKeyAsync: never });

    const index = new ComponentIndex(new Variants());
    let outcome: unknown = "pending";
    const found = index.find("key:abc123").catch((error: unknown) => {
      outcome = error;
    });

    await vi.advanceTimersByTimeAsync(9_999);
    expect(outcome).toBe("pending");

    await vi.advanceTimersByTimeAsync(1);
    await found;
    expect(outcome).toMatchObject({
      message: "Figma did not import key:abc123: no answer in 10 s.",
      hint: "Only components of a published library this account can use import by key (library_search finds them); in the library file itself, name the component instead.",
    });
  });
});

import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "@/core/ports/key-value-store.port.ts";
import { PairingStore } from "@/plugin/adapters/host/storage/pairing-store.ts";

/** clientStorage as the port sees it, in memory. */
class MemoryStore implements KeyValueStore {
  readonly values = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.values.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
}

const KEY = { id: "0123456789abcdef", secret: "ab".repeat(32) };

describe("PairingStore", () => {
  it("keeps the key under 0.7.0's clientStorage key, and gives it back", async () => {
    const store = new MemoryStore();
    const pairing = new PairingStore(store);

    await pairing.save(KEY);

    expect([...store.values.keys()]).toEqual(["pixelwright.pairing"]);
    expect(await pairing.read()).toEqual(KEY);
  });

  it.each([
    ["nothing", undefined],
    ["a string", "0123456789abcdef"],
    ["a key of the wrong shape", { id: "nope", secret: "nope" }],
  ])("reads %s in the slot as no key", async (_case, stored) => {
    const store = new MemoryStore();

    store.values.set("pixelwright.pairing", stored);

    expect(await new PairingStore(store).read()).toBeNull();
  });

  it("reads no key when clientStorage fails, so the window still connects and asks for a code", async () => {
    const failing: KeyValueStore = {
      get: () => Promise.reject(new Error("unavailable")),
      set: () => Promise.resolve(),
    };

    expect(await new PairingStore(failing).read()).toBeNull();
  });
});

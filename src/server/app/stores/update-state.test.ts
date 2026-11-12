import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import type { JsonFile } from "@/core/ports/json-file.port.ts";
import type { PackageRegistry } from "@/core/ports/package-registry.port.ts";
import { UpdateState } from "@/server/app/stores/update-state.ts";

const DAY = 24 * 60 * 60 * 1_000;
const NOW = Date.parse("2026-10-17T12:00:00Z");

/** latest.json in memory, read through the schema as the atomic JSON file reads it. */
class MemoryJson implements JsonFile {
  value: unknown;

  constructor(value?: unknown) {
    this.value = value;
  }

  read<Schema extends zod.ZodMiniType>(
    _path: string,
    schema: Schema,
    fallback: zod.output<Schema>,
  ): zod.output<Schema> {
    const parsed = zod.safeParse(schema, this.value);

    return parsed.success ? parsed.data : fallback;
  }

  write(_path: string, value: unknown): void {
    this.value = value;
  }

  ensure(): void {}
}

/** npm's answer, or null when it cannot be reached, counting the times it was asked. */
function npm(version: string | null) {
  const asked = { times: 0 };
  const registry: PackageRegistry = {
    latest: async () => {
      asked.times += 1;

      return version;
    },
  };

  return { asked, registry };
}

const kept = (version: string, ago: number) => new MemoryJson({ version, checkedAt: NOW - ago });
const state = (
  file: JsonFile,
  registry: PackageRegistry,
  enabled = true,
) =>
  new UpdateState(file, { now: () => NOW }, registry, { file: "/home/latest.json", enabled, running: "0.8.0" });

describe("UpdateState", () => {
  it("asks npm at most once a day: an answer kept under a day ago is used as it is (S-070)", async () => {
    const { asked, registry } = npm("0.9.1");

    expect(await state(kept("0.9.0", DAY / 2), registry).shown()).toBe("0.9.0");
    expect(asked.times).toBe(0);
  });

  it("asks again once the kept answer is a day old, and keeps the new one", async () => {
    const { asked, registry } = npm("0.9.1");
    const file = kept("0.8.5", DAY + 1);

    expect(await state(file, registry).shown()).toBe("0.9.1");
    expect(asked.times).toBe(1);
    expect(file.value).toEqual({ version: "0.9.1", checkedAt: NOW });
  });

  it("keeps the last answer when npm cannot be reached, and shows nothing when none was", async () => {
    expect(await state(kept("0.9.0", 3 * DAY), npm(null).registry).shown()).toBe("0.9.0");
    expect(await state(new MemoryJson(), npm(null).registry).shown()).toBeNull();
  });

  it("never asks npm when PIXELWRIGHT_NO_UPDATE_CHECK turns the check off", async () => {
    const { asked, registry } = npm("0.9.1");

    expect(await state(kept("0.9.0", 3 * DAY), registry, false).shown()).toBeNull();
    expect(asked.times).toBe(0);
  });

  it("shows only a version newer than the running one and than the one whose banner was closed", async () => {
    const { registry } = npm(null);

    expect(await state(kept("0.8.0", 0), registry).shown()).toBeNull();
    expect(await state(kept("0.7.9", 0), registry).shown()).toBeNull();

    const file = kept("0.9.0", 0);

    state(file, registry).dismiss("0.9.0");
    expect(await state(file, registry).shown()).toBeNull();

    file.value = { ...(file.value as object), version: "0.9.1" };
    expect(await state(file, registry).shown()).toBe("0.9.1");
  });
});

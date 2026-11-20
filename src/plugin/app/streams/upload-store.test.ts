import { expect, it } from "vitest";
import { UploadStore } from "@/plugin/app/streams/upload-store.ts";

const MIB = 1024 * 1024;

function bytes(length: number, value = 1): Uint8Array {
  return new Uint8Array(length).fill(value);
}

// P-030: a chunk goes at its offset, one sent again counts once, and the file is handed out once every byte came.
it("puts chunks at their offset, counts a resent one once and hands the file out once whole", () => {
  const store = new UploadStore({ now: () => 0 });

  expect(store.receive({ stream: "a", offset: 0, bytes: bytes(4), total: 10 })).toBe(4);
  expect(store.receive({ stream: "a", offset: 0, bytes: bytes(4), total: 10 })).toBe(4);
  expect(store.bytes("a")).toBeUndefined();
  expect(store.receive({ stream: "a", offset: 4, bytes: bytes(6, 2), total: 10 })).toBe(10);
  expect(store.bytes("a")).toEqual(Uint8Array.from([1, 1, 1, 1, 2, 2, 2, 2, 2, 2]));
  expect(() => store.receive({ stream: "a", offset: 10, bytes: bytes(1), total: 10 })).toThrow(/past the file/);
});

// P-030: an upload is held five minutes; past 128 MB the oldest goes first, never the one coming in.
it("drops an upload past five minutes and, past 128 MB, the oldest but not the one coming in", () => {
  let now = 0;
  const store = new UploadStore({ now: () => now });

  store.receive({ stream: "old", offset: 0, bytes: bytes(1), total: 1 });
  now = 5 * 60_000 + 1;
  store.receive({ stream: "new", offset: 0, bytes: bytes(1), total: 1 });

  expect(store.bytes("old")).toBeUndefined();
  expect(store.bytes("new")).toEqual(bytes(1));

  store.receive({ stream: "first", offset: 0, bytes: bytes(1), total: 70 * MIB });
  store.receive({ stream: "second", offset: 0, bytes: bytes(1), total: 70 * MIB });

  // The second is still held (its count goes on); the first was dropped and starts again.
  expect(store.receive({ stream: "second", offset: 1, bytes: bytes(1), total: 70 * MIB })).toBe(2);
  expect(store.receive({ stream: "first", offset: 1, bytes: bytes(1), total: 70 * MIB })).toBe(1);
});

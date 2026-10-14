import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadStore } from "../src/services/upload-store.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";

const chunk = (text: string) => Buffer.from(text).toString("base64");
const text = (bytes: Uint8Array | undefined) => (bytes === undefined ? undefined : Buffer.from(bytes).toString());

function store(limits?: { maxBytes?: number; ttlMs?: number }) {
  installFigma(
    tree({
      id: "0:1",
      type: "PAGE",
      name: "Page 1",
    }),
  );

  return new UploadStore(limits);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("UploadStore", () => {
  it("keeps a stream's chunks at their offsets, and gives its bytes once every one came", () => {
    const uploads = store();

    expect(
      uploads.receive({
        stream: "s",
        offset: 3,
        chunk: chunk("def"),
        total: 6,
      }),
    ).toEqual({ received: 3 });
    expect(uploads.bytes("s")).toBeUndefined();
    expect(
      uploads.receive({
        stream: "s",
        offset: 0,
        chunk: chunk("abc"),
        total: 6,
      }),
    ).toEqual({ received: 6 });
    expect(text(uploads.bytes("s"))).toBe("abcdef");
  });

  it("starts a stream again when it comes with another size", () => {
    const uploads = store();

    uploads.receive({
      stream: "s",
      offset: 0,
      chunk: chunk("abc"),
      total: 6,
    });
    uploads.receive({
      stream: "s",
      offset: 0,
      chunk: chunk("xy"),
      total: 2,
    });

    expect(text(uploads.bytes("s"))).toBe("xy");
  });

  it("drops the streams an apply used", () => {
    const uploads = store();

    uploads.receive({
      stream: "a",
      offset: 0,
      chunk: chunk("a"),
      total: 1,
    });
    uploads.receive({
      stream: "b",
      offset: 0,
      chunk: chunk("b"),
      total: 1,
    });
    uploads.drop(["a"]);

    expect([text(uploads.bytes("a")), text(uploads.bytes("b"))]).toEqual([undefined, "b"]);
  });

  it("forgets a stream once it is older than its time", () => {
    vi.useFakeTimers();

    const uploads = store({ ttlMs: 1_000 });

    uploads.receive({
      stream: "old",
      offset: 0,
      chunk: chunk("a"),
      total: 1,
    });
    vi.advanceTimersByTime(1_001);
    uploads.receive({
      stream: "new",
      offset: 0,
      chunk: chunk("b"),
      total: 1,
    });

    expect([text(uploads.bytes("old")), text(uploads.bytes("new"))]).toEqual([undefined, "b"]);
  });

  it("makes room from the oldest stream past its size, never from the one coming in", () => {
    const uploads = store({ maxBytes: 4 });

    uploads.receive({
      stream: "a",
      offset: 0,
      chunk: chunk("aa"),
      total: 2,
    });
    uploads.receive({
      stream: "b",
      offset: 0,
      chunk: chunk("bb"),
      total: 2,
    });
    uploads.receive({
      stream: "c",
      offset: 0,
      chunk: chunk("cc"),
      total: 2,
    });

    expect(["a", "b", "c"].map((stream) => text(uploads.bytes(stream)))).toEqual([undefined, "bb", "cc"]);

    uploads.receive({
      stream: "huge",
      offset: 0,
      chunk: chunk("hhhhhh"),
      total: 6,
    });

    expect(["b", "c", "huge"].map((stream) => text(uploads.bytes(stream)))).toEqual([undefined, undefined, "hhhhhh"]);
  });
});

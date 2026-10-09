import { beforeEach, describe, expect, it } from "vitest";
import { runOperation } from "../src/figma/operations.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";

const IMAGE = Uint8Array.from({ length: 10 }, (_, index) => index);
let exports: unknown[];

beforeEach(() => {
  exports = [];

  const page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "2:4869",
        absoluteBoundingBox: {
          x: 0,
          y: 0,
          width: 1440,
          height: 8000,
        },
      },
    ],
  });
  const { figma } = installFigma(page);
  const node = page.children?.[0] as unknown as Record<string, unknown>;

  node.exportAsync = async (settings: unknown) => {
    exports.push(settings);

    return IMAGE;
  };
  Object.assign(figma, {
    base64Encode: (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)),
  });
});

const chunk = (offset: number, extra: object = {}) =>
  runOperation("export", {
    node: "2:4869",
    format: "PNG",
    offset,
    length: 4,
    ...extra,
  }) as Promise<{ totalBytes: number; bytes: string }>;

describe("export", () => {
  it("renders once and serves the later chunks of the same export from memory", async () => {
    const parts = [await chunk(0), await chunk(4), await chunk(8)];

    expect(exports).toEqual([
      {
        format: "PNG",
        constraint: {
          type: "SCALE",
          value: 1,
        },
        useAbsoluteBounds: false,
      },
    ]);
    expect(parts.map((part) => part.totalBytes)).toEqual([10, 10, 10]);
    expect(parts.map((part) => atob(part.bytes)).join("")).toBe(String.fromCharCode(...IMAGE));
  });

  it("renders again for a new export, so a changed layer is never served stale", async () => {
    await chunk(0);
    await chunk(0, { effects: false });

    expect(exports).toHaveLength(2);
    expect(exports[1]).toMatchObject({ useAbsoluteBounds: true });
  });

  it("lowers the scale so the longer side fits maxSide, and says which scale it used", async () => {
    const part = await chunk(0, {
      scale: 2,
      maxSide: 2_000,
    });

    expect(exports[0]).toMatchObject({
      constraint: {
        type: "SCALE",
        value: 0.25,
      },
    });
    expect(part).toMatchObject({ scale: 0.25 });
  });

  it("keeps the scale asked for when the image fits", async () => {
    const part = await chunk(0, {
      scale: 0.2,
      maxSide: 2_000,
    });

    expect(part).toMatchObject({ scale: 0.2 });
  });
});

import { describe, expect, it } from "vitest";
import { ApplyImages } from "@/plugin/operations/apply/apply-images.ts";
import { AssetStep } from "@/plugin/operations/apply/writers/asset-step.ts";
import { PaintWrite } from "@/plugin/operations/apply/writers/paint-write.ts";

function images(uploaded: string[] = []) {
  const uploads = {
    bytes: (stream: string) => (uploaded.includes(stream) ? new Uint8Array(1) : undefined),
    drop: () => {},
  };

  return new ApplyImages(uploads as never, { image: () => ({ hash: "h" }) } as never);
}

const missing = { kind: "image", src: "a.png", stream: "s1" } as const;

describe("AssetStep.check", () => {
  it("refuses an image whose upload did not arrive, before any write", () => {
    const step = new AssetStep(images(), {} as never);

    expect(() => step.check({ asset: missing })).toThrow(/a\.png did not reach the plugin/);
  });

  it("takes an image that arrived, one with no stream (a dry run's), an icon, and an image already made", () => {
    const made = images(["s1"]);
    const step = new AssetStep(made, {} as never);

    expect(() => step.check({ asset: missing })).not.toThrow();
    made.hash(missing);
    expect(() => new AssetStep(made, {} as never).check({ asset: missing })).not.toThrow();
    expect(() => new AssetStep(images(), {} as never).check({ asset: { kind: "image", src: "a.png" } })).not.toThrow();
    expect(() =>
      new AssetStep(images(), {} as never).check({ asset: { kind: "icon", src: "a.svg", stream: "s9" } }),
    ).not.toThrow();
  });
});

describe("PaintWrite.check", () => {
  it("refuses a background image whose upload did not arrive", async () => {
    const paints = new PaintWrite({} as never, {} as never, images());

    await expect(paints.check([{ kind: "image", src: "b.png", stream: "s2" }])).rejects.toThrow(/b\.png did not reach/);
  });
});

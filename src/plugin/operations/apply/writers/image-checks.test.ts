import { describe, expect, it } from "vitest";
import { Capabilities, type TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
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

const rectangle: TypedLayer = { type: "RECTANGLE" };

function step(made = images()): AssetStep {
  return new AssetStep(made, {} as never, new Capabilities());
}

describe("AssetStep.check", () => {
  it("refuses an image whose upload did not arrive, before any write", () => {
    expect(() => step().check({ asset: missing }, rectangle)).toThrow(/a\.png did not reach the plugin/);
  });

  it("refuses an image on a layer with no fills to hold it", () => {
    expect(() => step(images(["s1"])).check({ asset: missing }, { type: "LINE" })).toThrow(
      "A line has no fills to hold an image.",
    );
  });

  it("takes an image that arrived, one with no stream (a dry run's), an icon, and an image already made", () => {
    const made = images(["s1"]);

    expect(() => step(made).check({ asset: missing }, rectangle)).not.toThrow();
    made.hash(missing);
    expect(() => step(made).check({ asset: missing }, rectangle)).not.toThrow();
    expect(() => step().check({ asset: { kind: "image", src: "a.png" } }, rectangle)).not.toThrow();
    expect(() =>
      step().check({ asset: { kind: "icon", src: "a.svg", stream: "s9" } }, { type: "FRAME" }),
    ).not.toThrow();
  });
});

describe("PaintWrite.check", () => {
  it("refuses a background image whose upload did not arrive", async () => {
    const paints = new PaintWrite({} as never, {} as never, images());

    await expect(paints.check([{ kind: "image", src: "b.png", stream: "s2" }])).rejects.toThrow(/b\.png did not reach/);
  });
});

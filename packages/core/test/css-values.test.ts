import { describe, expect, it } from "vitest";
import { changeOf, cleanOracle, splitTop, urlsOf } from "../src/index.ts";

const props = (tag: string, attributes: Record<string, string>) =>
  changeOf({
    line: 1,
    column: 1,
    tag,
    id: null,
    ref: "new:1",
    parent: null,
    index: 0,
    attributes,
  });

describe("CSS values, read as CSS reads them", () => {
  it("splits outside quotes, parentheses and comments, as before for everything else", () => {
    expect(splitTop("'Foo, Bar', sans-serif", ",")).toEqual(["'Foo, Bar'", "sans-serif"]);
    expect(splitTop("0 5px 0 0 rgba(0, 0, 0, 0.25), inset 0 0 0 1px #000", ",")).toEqual([
      "0 5px 0 0 rgba(0, 0, 0, 0.25)",
      "inset 0 0 0 1px #000",
    ]);
    expect(splitTop('url("a (1).png") center / cover', " ")).toEqual(['url("a (1).png")', "center", "/", "cover"]);
    expect(splitTop("1 / span 2", "/")).toEqual(["1", "span 2"]);
    expect(splitTop("10px  20px", " ")).toEqual(["10px", "20px"]);
  });

  it("takes a font family with a comma inside its quotes whole", () => {
    expect(props("Text", { font: "500 30px/normal 'Foo, Bar', sans-serif" }).change.props.font).toMatchObject({
      family: "Foo, Bar",
    });
  });

  it("takes an image's file with parentheses in its quoted name whole", () => {
    expect(
      props("Frame", { background: 'url("assets/photo (1).png") center / cover no-repeat' }).change.props.fills,
    ).toEqual([
      expect.objectContaining({
        kind: "image",
        src: "assets/photo (1).png",
      }),
    ]);
  });

  it("asks for quotes around a file name with spaces", () => {
    expect(props("Frame", { background: "url(my photo.png) center / cover" }).errors).toEqual([
      expect.objectContaining({
        attribute: "background",
        message: expect.stringMatching(/quotes/),
      }),
    ]);
  });

  it("drops var() fallbacks whole, commas and parentheses inside them included", () => {
    expect(cleanOracle("var(--Overlay, rgba(0, 0, 0, 0.50))")).toBe("var(--Overlay)");
    expect(cleanOracle("0 4px 8px 0 var(--Shadow, rgba(0, 0, 0, 0.1)) /* note */")).toBe("0 4px 8px 0 var(--Shadow)");
  });

  it("lists every file a value names, quoted or not", () => {
    expect(urlsOf('url("a (1).png") center, url(b.png), linear-gradient(#000, #fff)')).toEqual(["a (1).png", "b.png"]);
  });
});

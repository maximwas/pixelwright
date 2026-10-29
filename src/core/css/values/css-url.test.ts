import { describe, expect, it } from "vitest";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";

const urls = new CssUrl(new CssSplit());

describe("CssUrl", () => {
  // C-014: bare where CSS reads it so, quoted otherwise.
  it("writes a file's url() bare when CSS can read it so, and quoted when the path holds spaces or quotes", () => {
    expect(urls.url("assets/hero.png")).toBe("url(assets/hero.png)");
    expect(urls.url('assets/my "best" photo.png')).toBe('url("assets/my \\"best\\" photo.png")');
  });

  it("reads the file a background layer names, quoted or not, and what follows it", () => {
    expect(urls.image('url("a (1).png") center / cover')).toEqual({ src: "a (1).png", rest: "center / cover" });
    expect(urls.image("url(b.png) no-repeat")).toEqual({ src: "b.png", rest: "no-repeat" });
    expect(urls.image("linear-gradient(#000, #fff)")).toBeNull();
  });

  // C-014: an unquoted url with a space is CSS's bad-url token: refused, with the hint to quote it.
  it("refuses an unquoted url() with a space and hints to quote it", () => {
    expect(urls.image("url(my photo.png) center")).toEqual({
      error: expect.stringContaining("url() without quotes cannot hold spaces"),
      hint: 'Write the file in quotes: url("my photo.png").',
    });
  });

  it("compares backgrounds without the file they name", () => {
    expect(urls.withoutUrls('url("x/a.png") center, #fff')).toBe(urls.withoutUrls("url(y.png) center, #fff"));
  });
});

import { afterEach, expect, it, vi } from "vitest";
import { FontsourceAxes } from "@/server/adapters/http/fontsource-axes.ts";

/** api.fontsource.org/v1/variable/inter, as recorded on 2026-11-13. */
const INTER =
  '{"family":"Inter","axes":{"ital":{"default":"0","min":"0","max":"1","step":"1"},"opsz":{"default":"14","min":"14","max":"32","step":"0.1"},"wght":{"default":"400","min":"100","max":"900","step":"1"}}}';

afterEach(() => vi.unstubAllGlobals());

// Plugin API 138 names a family's axes, not their ranges: Fontsource's variable endpoint has them, by family id.
it("reads a variable family's axes with their ranges once, a static family as none", async () => {
  const fetch = vi.fn(async (url: string) =>
    url.endsWith("/inter") ? new Response(INTER) : new Response("Not Found", { status: 404 }),
  );

  vi.stubGlobal("fetch", fetch);

  const axes = new FontsourceAxes();

  expect(await axes.axes("Inter")).toEqual({
    ital: { min: 0, max: 1, default: 0 },
    opsz: { min: 14, max: 32, default: 14 },
    wght: { min: 100, max: 900, default: 400 },
  });
  expect(await axes.axes("Inter")).not.toBeNull();
  expect(await axes.axes("Noto Sans JP")).toBeNull();
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    "https://api.fontsource.org/v1/variable/inter",
    "https://api.fontsource.org/v1/variable/noto-sans-jp",
  ]);
});

it("answers none offline and asks again on the next call", async () => {
  const fetch = vi.fn(async () => {
    throw new Error("offline");
  });

  vi.stubGlobal("fetch", fetch);

  const axes = new FontsourceAxes();

  expect(await axes.axes("Inter")).toBeNull();
  expect(await axes.axes("Inter")).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(2);
});

// QA NEW-090: only a 404 says "static family"; a 429 or a 5xx says nothing, and must not be remembered as a static one.
it("remembers a 404 as a static family but asks again after any other status", async () => {
  const statuses = new Map([
    ["/static", 404],
    ["/limited", 429],
    ["/broken", 503],
  ]);
  const fetch = vi.fn(async (url: string) => {
    const status = [...statuses].find(([suffix]) => url.endsWith(suffix))?.[1] ?? 200;

    return new Response("", { status });
  });

  vi.stubGlobal("fetch", fetch);

  const axes = new FontsourceAxes();

  for (const family of ["Static", "Limited", "Broken"]) {
    expect(await axes.axes(family)).toBeNull();
    expect(await axes.axes(family)).toBeNull();
  }

  expect(fetch.mock.calls.map(([url]) => url.split("/").pop())).toEqual([
    "static",
    "limited",
    "limited",
    "broken",
    "broken",
  ]);
});

it("encodes the family in the URL it asks", async () => {
  const asked: string[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      asked.push(url);

      return new Response("", { status: 404 });
    }),
  );
  await new FontsourceAxes().axes("Odd/../Name?x#y");

  expect(asked).toEqual(["https://api.fontsource.org/v1/variable/odd%2F..%2Fname%3Fx%23y"]);
});

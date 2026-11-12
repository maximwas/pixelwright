import { afterEach, expect, it, vi } from "vitest";
import type { FontDirectory } from "@/core/ports/font-directory.port.ts";
import { FontsourceDirectory } from "@/server/adapters/http/fontsource-directory.ts";

/** api.fontsource.org's answer for two of its Google families, as recorded on 2026-10-30. */
const RECORDED =
  '[{"id":"inter","family":"Inter","subsets":["cyrillic","cyrillic-ext","greek","greek-ext","latin","latin-ext","vietnamese"],"weights":[100,200,300,400,500,600,700,800,900],"styles":["italic","normal"],"defSubset":"latin","variable":true,"lastModified":"2025-09-10","category":"sans-serif","license":"OFL-1.1","type":"google"},{"id":"manrope","family":"Manrope","subsets":["cyrillic","cyrillic-ext","greek","latin","latin-ext","vietnamese"],"weights":[200,300,400,500,600,700,800],"styles":["normal"],"defSubset":"latin","variable":true,"lastModified":"2025-09-05","category":"sans-serif","license":"OFL-1.1","type":"google"}]';

afterEach(() => vi.unstubAllGlobals());

/** A fallback that answers each call in turn. */
const fallback = (...answers: Awaited<ReturnType<FontDirectory["families"]>>[]) => {
  const families = vi.fn<FontDirectory["families"]>();

  for (const answer of answers) {
    families.mockResolvedValueOnce(answer);
  }

  return { families };
};

// A§15.5: Fontsource first, read once for the server.
it("reads each Google family with its weights from Fontsource, italics as design_read writes them, once", async () => {
  const fetch = vi.fn(async () => new Response(RECORDED));

  vi.stubGlobal("fetch", fetch);

  const directory = new FontsourceDirectory(fallback());
  const served = await directory.families();

  await directory.families();

  expect(served.error).toBeNull();
  expect(served.families?.get("Manrope")).toEqual(["200", "300", "400", "500", "600", "700", "800"]);
  expect(served.families?.get("Inter")).toEqual(expect.arrayContaining(["100", "400", "400 italic", "900 italic"]));
  expect(fetch).toHaveBeenCalledOnce();
});

it("asks Google's catalogue when Fontsource fails, and forgets a failed read so the next call asks again", async () => {
  const fetch = vi.fn(async () => new Response("", { status: 503 }));
  const google = fallback(
    { families: null, error: "offline" },
    { families: new Map([["Inter", ["400"]]]), error: null },
  );

  vi.stubGlobal("fetch", fetch);

  const directory = new FontsourceDirectory(google);

  expect(await directory.families()).toEqual({ families: null, error: "offline" });
  expect((await directory.families()).families?.get("Inter")).toEqual(["400"]);
  expect(fetch).toHaveBeenCalledTimes(2);
});

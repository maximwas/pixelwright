import { afterEach, expect, it, vi } from "vitest";
import { GoogleMetadataDirectory } from "@/server/adapters/http/google-metadata-directory.ts";

/** fonts.google.com/metadata/fonts for two families, as recorded on 2026-10-30, cut to the fields read. */
const RECORDED =
  '{"familyMetadataList":[{"family":"Inter","fonts":{"100":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"100i":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"200":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"200i":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"300":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"300i":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"400":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"400i":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"500":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"500i":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"600":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"600i":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"700":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"700i":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"800":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"800i":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"900":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375},"900i":{"thickness":null,"slant":null,"width":null,"lineHeight":1.2099609375}}},{"family":"Manrope","fonts":{"200":{"thickness":null,"slant":null,"width":null,"lineHeight":1.366},"300":{"thickness":null,"slant":null,"width":null,"lineHeight":1.366},"400":{"thickness":null,"slant":null,"width":null,"lineHeight":1.366},"500":{"thickness":null,"slant":null,"width":null,"lineHeight":1.366},"600":{"thickness":null,"slant":null,"width":null,"lineHeight":1.366},"700":{"thickness":null,"slant":null,"width":null,"lineHeight":1.366},"800":{"thickness":null,"slant":null,"width":null,"lineHeight":1.366}}}]}';

afterEach(() => vi.unstubAllGlobals());

it("reads Google's catalogue, its )]}' guard line stripped, italics as design_read writes them (T-101)", async () => {
  vi.stubGlobal("fetch", async () => new Response(`)]}'\n${RECORDED}`));

  const served = await new GoogleMetadataDirectory().families();

  expect(served.families?.get("Manrope")).toEqual(["200", "300", "400", "500", "600", "700", "800"]);
  expect(served.families?.get("Inter")).toEqual(expect.arrayContaining(["100", "400", "400 italic", "900 italic"]));
});

it("says why when it cannot be read: offline is an error, never an empty catalogue", async () => {
  vi.stubGlobal("fetch", async () => new Response("", { status: 500 }));

  expect(await new GoogleMetadataDirectory().families()).toEqual({
    families: null,
    error: expect.stringContaining("500"),
  });
});

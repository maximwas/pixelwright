import { expect, it } from "vitest";
import type { FontDirectory, ServedFonts } from "@/core/ports/font-directory.port.ts";
import { FontSources } from "@/server/tools/fonts-check/font-sources.ts";

const directory = (served: ServedFonts): FontDirectory => ({ families: async () => served });

/** The fonts a read uses, as design_read lists them. */
const USED = { Manrope: ["400", "600"], "Proxima Nova": ["700"], Inter: ["400", "300 italic"] };

// T-101: 0.7.0's words and link.
it("says which fonts Google serves, with a css2 link for the weights used and the weights it lacks", async () => {
  const served = new Map([
    ["Manrope", ["200", "400", "600", "800"]],
    ["Inter", ["400", "400 italic"]],
  ]);

  expect(await new FontSources(directory({ families: served, error: null })).check(USED)).toEqual({
    summary: "3 font families: 2 on Google Fonts.",
    fonts: [
      {
        family: "Manrope",
        weights: ["400", "600"],
        google: true,
        css: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600&display=swap",
      },
      {
        family: "Proxima Nova",
        weights: ["700"],
        google: false,
        note: "Not on Google Fonts: the build needs its own files (a licence from its foundry, or a fallback).",
      },
      {
        family: "Inter",
        weights: ["400", "300 italic"],
        google: true,
        css: "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;1,300&display=swap",
        note: "Google Fonts has no 300 italic: the nearest weight will stand in.",
      },
    ],
  });
});

it("still lists the fonts when Google Fonts cannot be reached, google null, and says why", async () => {
  const result = await new FontSources(directory({ families: null, error: "offline" })).check({
    Manrope: ["400"],
    "Proxima Nova": ["700"],
  });

  expect(result).toEqual({
    summary: "2 font families. Google Fonts could not be reached (offline): which are there is unknown.",
    fonts: [
      { family: "Manrope", weights: ["400"], google: null },
      { family: "Proxima Nova", weights: ["700"], google: null },
    ],
  });
});

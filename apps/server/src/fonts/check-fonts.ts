import { designTree } from "@pixelwright/core";
import type * as z from "zod";
import { runOp } from "../mcp/run-op.ts";
import { selectedLayer } from "../mcp/selected-layer.ts";
import type { FontsCheckInputSchema, FontsCheckOutputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";
import { errorMessage } from "../utils/error-message.ts";
import { googleFontsLink } from "../utils/google-fonts-link.ts";
import { googleFonts } from "./google-fonts.ts";

type FontsCheck = z.output<typeof FontsCheckOutputSchema>;

/** The fonts a layer's texts use (the selected layer's by default), each with where the build gets it. */
export async function checkFonts(
  bridge: ToolContext["bridge"],
  { node, file }: z.output<typeof FontsCheckInputSchema>,
  catalogue: () => Promise<ReadonlyMap<string, readonly string[]>> = googleFonts,
): Promise<FontsCheck> {
  const id = node ?? (await selectedLayer(bridge, file));
  const { fonts } = designTree(
    await runOp(
      bridge,
      "snapshot",
      {
        node: id,
        css: "none",
      },
      file,
    ),
  );
  const google = await catalogue().then(
    (found) => ({
      found,
      error: null,
    }),
    (error: unknown) => ({
      found: null,
      error: errorMessage(error),
    }),
  );
  const checked: FontsCheck["fonts"] = Object.entries(fonts).map(([family, weights]) => {
    const served = google.found?.get(family);

    if (google.found === null) {
      return {
        family,
        weights,
        google: null,
      };
    }

    if (served === undefined) {
      return {
        family,
        weights,
        google: false,
        note: "Not on Google Fonts: the build needs its own files (a licence from its foundry, or a fallback).",
      };
    }

    const missing = weights.filter((weight) => !served.includes(weight.replace(" italic", "i")));

    return {
      family,
      weights,
      google: true,
      css: googleFontsLink(family, weights),
      ...(missing.length === 0
        ? {}
        : { note: `Google Fonts has no ${missing.join(", ")}: the nearest weight will stand in.` }),
    };
  });

  return {
    summary:
      google.error === null
        ? `${checked.length} font families: ${checked.filter((font) => font.google).length} on Google Fonts.`
        : `${checked.length} font families. Google Fonts could not be reached (${google.error}): which are there is unknown.`,
    fonts: checked,
  };
}

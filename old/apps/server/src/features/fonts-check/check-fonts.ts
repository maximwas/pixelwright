import { designTree } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { selectedLayer } from "../../plugin/selected-layer.ts";
import { errorMessage } from "../../utils/error-message.ts";
import { googleFontsLink } from "./google-fonts-link.ts";
import type { FontsCheckInputSchema, FontsCheckOutputSchema } from "./schemas.ts";

type FontsCheck = z.output<typeof FontsCheckOutputSchema>;
type Catalogue = () => Promise<ReadonlyMap<string, readonly string[]>>;
/** Google Fonts' families, or why they could not be read. */
type Served =
  | { readonly found: ReadonlyMap<string, readonly string[]>; readonly error: null }
  | { readonly found: null; readonly error: string };

/** The fonts a layer's texts use (the selected layer's by default), each with where the build gets it. */
export async function checkFonts(
  plugin: PluginClient,
  { node, file }: z.output<typeof FontsCheckInputSchema>,
  catalogue: Catalogue,
): Promise<FontsCheck> {
  const session = plugin.session(file);
  const id = node ?? (await selectedLayer(session));
  const { fonts } = designTree(
    await session.run("snapshot", {
      node: id,
      css: "none",
    }),
  );
  const google = await served(catalogue);
  const checked = Object.entries(fonts).map(([family, weights]) => checkedFont(family, weights, google));

  return {
    summary:
      google.error === null
        ? `${checked.length} font families: ${checked.filter((font) => font.google).length} on Google Fonts.`
        : `${checked.length} font families. Google Fonts could not be reached (${google.error}): which are there is unknown.`,
    fonts: checked,
  };
}

async function served(catalogue: Catalogue): Promise<Served> {
  return await catalogue().then(
    (found) => ({
      found,
      error: null,
    }),
    (error: unknown) => ({
      found: null,
      error: errorMessage(error),
    }),
  );
}

/** One family: whether Google Fonts serves it, its css2 link, and the weights it lacks. */
function checkedFont(family: string, weights: string[], google: Served): FontsCheck["fonts"][number] {
  if (google.found === null) {
    return {
      family,
      weights,
      google: null,
    };
  }

  const servedWeights = google.found.get(family);

  if (servedWeights === undefined) {
    return {
      family,
      weights,
      google: false,
      note: "Not on Google Fonts: the build needs its own files (a licence from its foundry, or a fallback).",
    };
  }

  const missing = weights.filter((weight) => !servedWeights.includes(weight.replace(" italic", "i")));

  return {
    family,
    weights,
    google: true,
    css: googleFontsLink(family, weights),
    ...(missing.length === 0
      ? {}
      : { note: `Google Fonts has no ${missing.join(", ")}: the nearest weight will stand in.` }),
  };
}

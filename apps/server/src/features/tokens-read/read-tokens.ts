import { modelSummary, type RawTokens, TOKEN_FORMATS, type TokenModel, tokenModel } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { libraryListing } from "./library-listing.ts";
import type { TokensReadInputSchema, TokensReadOutputSchema } from "./schemas.ts";

type TokensReadArgs = z.output<typeof TokensReadInputSchema>;
type TokensRead = z.input<typeof TokensReadOutputSchema>;

/**
 * tokens_read: the file's tokens from the plugin, made into core's token model and written in the format asked for.
 * Past maxChars the summary comes back (with json, also the first tokens that fit), and a note naming the parts to read
 * one at a time.
 */
export async function readTokens(
  plugin: PluginClient,
  { collections, libraries, used, within, format, maxChars, file }: TokensReadArgs,
): Promise<TokensRead> {
  const raw = await plugin.run(
    "variables",
    {
      libraries,
      used,
      ...(within === undefined ? {} : { within }),
    },
    file,
  );
  const filter = collections === undefined ? {} : { collections };
  const model = tokenModel(raw, filter);
  const listing = raw.library === undefined ? null : libraryListing(raw.library);
  const source = {
    raw,
    model,
    filter,
  };
  const written = TOKEN_FORMATS[format].write(source);
  const notes = [...model.notes, ...readingNotes(raw, collections), ...(listing?.notes ?? []), ...written.notes];
  const library = listing === null ? {} : { library: listing.library };

  if (written.size > maxChars) {
    // A design system can be thousands of variables: past maxChars the model gets the map, the start of the tokens
    // where the format can be cut between them, and the parts to ask for.
    const start = TOKEN_FORMATS[format].start?.(source, maxChars);

    return {
      format,
      ...start?.body,
      summary: modelSummary(model),
      ...library,
      notes: [...notes, tooLongNote(written.size, maxChars, model, start)],
    };
  }

  return {
    format,
    ...written.body,
    ...library,
    notes,
  };
}

/** What the read itself says: the libraries failing or adding nothing, and collections asked for that do not exist. */
function readingNotes(raw: RawTokens, collections: readonly string[] | undefined): string[] {
  const notes = raw.libraryError === undefined ? [] : [raw.libraryError];
  const known = new Set(raw.collections.map((collection) => collection.name.toLowerCase()));
  const missing = (collections ?? []).filter((name) => !known.has(name.toLowerCase()));

  if (missing.length > 0) {
    const names = raw.collections.map((collection) => collection.name).join(", ") || "none";

    notes.push(`No collection is named ${missing.join(", ")}: the file has ${names}.`);
  }

  if (raw.library?.length === 0 && raw.libraryError === undefined) {
    notes.push("No library with variables is enabled in this file: libraries add nothing here.");
  }

  return notes;
}

function tooLongNote(
  size: number,
  maxChars: number,
  model: TokenModel,
  start: { shown: number; total: number } | undefined,
): string {
  const parts = model.collections
    .map((collection) => `collections: ${JSON.stringify([collection.name])}`)
    .slice(0, 5)
    .join(", ");
  const past = `The tokens are ${size} characters, past maxChars (${maxChars})`;

  return start === undefined
    ? `${past}: read them a part at a time, e.g. ${parts}.`
    : `${past}: tokens holds the first ${start.shown} of ${start.total} variables and styles, in order. Read the rest a part at a time, e.g. ${parts}, or with a larger maxChars.`;
}

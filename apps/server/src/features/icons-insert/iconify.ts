import { BridgeError } from "@pixelwright/core";
import * as z from "zod";
import { errorMessage } from "../../utils/error-message.ts";
import { ICONIFY_API, ICONIFY_SEARCH_PAGE, ICONIFY_TIMEOUT_MS } from "./constants.ts";

/** An icon set as Iconify describes it: its name, its licence, and whether it draws in its own colours. */
const IconSetSchema = z.object({
  name: z.string(),
  license: z
    .object({
      title: z.string(),
      spdx: z.string().optional(),
      url: z.string().optional(),
    })
    .optional(),
  palette: z.boolean().optional(),
});

export type IconSet = z.output<typeof IconSetSchema>;

const SetsSchema = z.record(z.string(), IconSetSchema);

const SearchSchema = z.object({
  icons: z.array(z.string()),
  total: z.number(),
  collections: SetsSchema.default({}),
});

/**
 * One call to Iconify's API (its own packages, @iconify/core and @iconify/utils, load icon sets for its components
 * and work on their JSON; none searches or draws an icon as the API does); null when it has no such thing (404).
 * Not answering is an error naming why.
 */
async function asked(path: string, params: Readonly<Record<string, string | undefined>>): Promise<Response | null> {
  const url = new URL(path, ICONIFY_API);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  let response: Response;

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(ICONIFY_TIMEOUT_MS) });
  } catch (error) {
    throw new BridgeError(
      "OP_FAILED",
      `Iconify's API did not answer (${errorMessage(error)}): finding icons needs the internet.`,
    );
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new BridgeError("OP_FAILED", `Iconify's API answered ${response.status} for ${url.pathname}.`);
  }

  return response;
}

/** Icons matching words, from Iconify's search: their names (set:name), how many it found, and their sets. */
export async function searchIcons(
  query: string,
  { set, limit }: { readonly set?: string | undefined; readonly limit: number },
): Promise<{ icons: string[]; total: number; sets: Record<string, IconSet> }> {
  const response = await asked("/search", {
    query,
    prefix: set,
    limit: String(Math.max(limit, ICONIFY_SEARCH_PAGE)),
  });
  const found = SearchSchema.parse(
    response === null
      ? {
          icons: [],
          total: 0,
        }
      : await response.json(),
  );

  return {
    icons: found.icons.slice(0, limit),
    total: found.total,
    sets: found.collections,
  };
}

/** An icon set's description; null for a prefix Iconify has no set of. */
export async function iconSet(prefix: string): Promise<IconSet | null> {
  const response = await asked("/collections", { prefixes: prefix });
  const sets = SetsSchema.parse(response === null ? {} : await response.json());

  return sets[prefix] ?? null;
}

/** An icon as Iconify draws it in SVG: at a height, in a colour (its currentColor's); null for an icon it has none of. */
export async function iconSvg(
  prefix: string,
  name: string,
  { height, color }: { readonly height: number; readonly color?: string | undefined },
): Promise<string | null> {
  const response = await asked(`/${prefix}/${name}.svg`, {
    height: String(height),
    color,
  });

  return response === null ? null : await response.text();
}

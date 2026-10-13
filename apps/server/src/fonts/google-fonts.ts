import { GOOGLE_FONTS_METADATA_URL, GOOGLE_FONTS_TIMEOUT_MS } from "../constants/fonts.ts";

let catalogue: Promise<Map<string, string[]>> | null = null;

/**
 * Google Fonts' families with the weights each has ("400", "400i"…), read once per process; a failed read is
 * forgotten, so the next call tries again.
 */
export function googleFonts(): Promise<Map<string, string[]>> {
  catalogue ??= read().catch((error: unknown) => {
    catalogue = null;

    throw error;
  });

  return catalogue;
}

async function read(): Promise<Map<string, string[]>> {
  const response = await fetch(GOOGLE_FONTS_METADATA_URL, { signal: AbortSignal.timeout(GOOGLE_FONTS_TIMEOUT_MS) });

  if (!response.ok) {
    throw new Error(`fonts.google.com answered ${response.status}`);
  }

  // The answer starts with a line that keeps it from running as a script: )]}'
  const body = (await response.text()).replace(/^\)\]\}'\s*/, "");
  const { familyMetadataList } = JSON.parse(body) as {
    familyMetadataList: { family: string; fonts: Record<string, unknown> }[];
  };

  return new Map(familyMetadataList.map(({ family, fonts }) => [family, Object.keys(fonts)]));
}

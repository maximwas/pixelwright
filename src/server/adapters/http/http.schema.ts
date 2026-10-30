import * as zod from "zod/mini";

/** npm's answer for one dist-tag, as far as the update banner reads it. */
export const NpmLatestSchema = zod.object({ version: zod.string() });

/** Fontsource's families, as far as fonts_check reads them. */
export const FontsourceFontsSchema = zod.array(
  zod.object({ family: zod.string(), weights: zod.array(zod.number()), styles: zod.array(zod.string()) }),
);

/** Google's catalogue, as far as fonts_check reads it: each family's font keys ("400", "400i"). */
export const GoogleMetadataSchema = zod.object({
  familyMetadataList: zod.array(zod.object({ family: zod.string(), fonts: zod.record(zod.string(), zod.unknown()) })),
});

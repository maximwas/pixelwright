import { CSS_FORMAT } from "./css-format.ts";
import { DTCG_FORMAT } from "./dtcg/dtcg-format.ts";
import { JSON_FORMAT } from "./json-format.ts";
import type { TokenFormat, TokenFormatName } from "./types.ts";

/** Every format tokens_read writes, by the name its `format` parameter takes. */
export const TOKEN_FORMATS: Readonly<Record<TokenFormatName, TokenFormat>> = {
  css: CSS_FORMAT,
  json: JSON_FORMAT,
  dtcg: DTCG_FORMAT,
};

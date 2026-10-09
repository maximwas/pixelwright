import type * as z from "zod";
import type { RawTokensSchema } from "../schemas/tokens.ts";

export type RawTokens = z.output<typeof RawTokensSchema>;

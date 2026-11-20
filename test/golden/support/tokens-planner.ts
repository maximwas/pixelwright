import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as zod from "zod/mini";
import { TOKEN_MODEL } from "@/core/tokens/model/token-model.ts";
import { TokensInputSchema } from "@/core/tokens/plan/plan.schema.ts";
import { TOKENS_PLAN } from "@/core/tokens/plan/tokens-plan.ts";
import { ServerMain } from "@/server/main/server.main.ts";
import { type RawTokens, RawTokensSchema } from "@/shared/ops/variables/variables.schema.ts";
import { goldenTokens } from "../fixtures/tokens-input.ts";

/** The planner and the token model as the server's root binds them. */
const container = new ServerMain({
  home: mkdtempSync(join(tmpdir(), "pixelwright-tokens-plan-")),
  logLevel: "silent",
  pluginBridge: false,
  bridgePort: 0,
  pluginOrigins: [],
  projectDir: tmpdir(),
}).container();
const planner = container.get(TOKENS_PLAN);
const model = container.get(TOKEN_MODEL);

/** tokens_read's JSON of a file: the model without its notes, as tokens_read answers it in `tokens`. */
export function readJson(raw: RawTokens): unknown {
  const { notes: _notes, ...tokens } = model.model(raw);

  return tokens;
}

/** The plan of tokens as tokens_apply takes them, its schema's defaults filled in, against the file's raw tokens. */
export function plan(tokens: unknown, raw: RawTokens = goldenTokens()) {
  return planner.plan(zod.parse(TokensInputSchema, tokens), raw);
}

export const EMPTY = RawTokensSchema.parse({ collections: [], variables: [], external: {}, styles: [] });

/** tokens_read's notes of a file, as its answer lists them. */
export function notesOf(raw: RawTokens): readonly string[] {
  return model.model(raw).notes;
}

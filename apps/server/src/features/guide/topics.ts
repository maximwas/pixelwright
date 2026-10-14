import { ASSETS } from "./topics/assets.ts";
import { CODE_CONNECT } from "./topics/code-connect.ts";
import { EMAIL } from "./topics/email.ts";
import { TOKENS } from "./topics/tokens.ts";
import { WORKFLOW } from "./topics/workflow.ts";
import { WRITE } from "./topics/write.ts";
import { XML } from "./topics/xml.ts";

/** The guide's topics: what each is about, and its markdown. Written against the tools as they are. */
export const GUIDE_TOPICS = {
  workflow: WORKFLOW,
  xml: XML,
  tokens: TOKENS,
  assets: ASSETS,
  write: WRITE,
  "code-connect": CODE_CONNECT,
  email: EMAIL,
} as const;

export type GuideTopic = keyof typeof GUIDE_TOPICS;

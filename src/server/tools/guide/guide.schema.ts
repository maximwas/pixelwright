import * as zod from "zod/mini";
import { GUIDE_FIELD, GUIDE_TOPIC } from "@/server/tools/guide/guide.constants.ts";

/** Strict: a misspelt argument is refused by name instead of being dropped without a word. */
export const GuideInputSchema = zod.strictObject({
  topic: zod.exactOptional(zod.enum(GUIDE_TOPIC)).check(zod.describe(GUIDE_FIELD.topic)),
});

export const GuideOutputSchema = zod.object({
  topic: zod.string(),
  markdown: zod.string(),
  /** Without a topic: every topic with its one line. */
  topics: zod.exactOptional(zod.array(zod.object({ name: zod.string(), about: zod.string() }))),
});

export type GuideInput = zod.output<typeof GuideInputSchema>;

export type GuideOutput = zod.output<typeof GuideOutputSchema>;

export type GuideTopic = (typeof GUIDE_TOPIC)[keyof typeof GUIDE_TOPIC];

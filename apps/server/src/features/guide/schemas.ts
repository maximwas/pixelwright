import * as z from "zod";
import { GUIDE_TOPIC_NAMES } from "./read-guide.ts";

export const GuideInputSchema = z.object({
  topic: z.enum(GUIDE_TOPIC_NAMES).exactOptional().describe("The topic to read. Default: the list of topics."),
});

export const GuideOutputSchema = z.object({
  topic: z.string(),
  markdown: z.string(),
  topics: z
    .array(
      z.object({
        name: z.string(),
        about: z.string(),
      }),
    )
    .exactOptional(),
});

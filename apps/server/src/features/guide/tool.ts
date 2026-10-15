import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolDefinition } from "../../types/mcp.ts";
import { GUIDE_TOPIC_NAMES, readGuide } from "./read-guide.ts";
import { GuideInputSchema, GuideOutputSchema } from "./schemas.ts";
import { GUIDE_TOPICS } from "./topics.ts";

export function guideTool(): ToolDefinition<typeof GuideInputSchema, typeof GuideOutputSchema> {
  return {
    name: "guide",
    title: "Pixelwright guide",
    description: `How to work with Pixelwright and read what it returns. Without a topic: the topics. Topics: ${GUIDE_TOPIC_NAMES.map((topic) => `${topic} (${GUIDE_TOPICS[topic].about})`).join("; ")}. Read workflow first in a new task, and xml before building from design_read.`,
    input: GuideInputSchema,
    output: GuideOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: async ({ topic }) => readGuide(topic),
  };
}

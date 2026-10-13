import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { GUIDE_TOPIC_NAMES, readGuide } from "../../guide/read-guide.ts";
import { GUIDE_TOPICS } from "../../guide/topics.ts";
import { registerTool } from "../register-tool.ts";

export function registerGuideTool(server: McpServer): void {
  registerTool(server, {
    name: "guide",
    title: "Pixelwright guide",
    description: `How to work with Pixelwright and read what it returns. Without a topic: the topics. Topics: ${GUIDE_TOPIC_NAMES.map((topic) => `${topic} (${GUIDE_TOPICS[topic].about})`).join("; ")}. Read workflow first in a new task, and xml before building from design_read.`,
    input: z.object({
      topic: z.enum(GUIDE_TOPIC_NAMES).exactOptional().describe("The topic to read. Default: the list of topics."),
    }),
    output: z.object({
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
    }),
    annotations: READ_ONLY_ANNOTATIONS,
    run: async ({ topic }) => readGuide(topic),
  });
}

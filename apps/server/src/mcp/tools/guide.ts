import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { GUIDE_TOPICS, type GuideTopic } from "../../guide/topics.ts";
import { registerTool } from "../register-tool.ts";

const TOPICS = Object.keys(GUIDE_TOPICS) as [GuideTopic, ...GuideTopic[]];

export function registerGuideTool(server: McpServer): void {
  registerTool(server, {
    name: "guide",
    title: "Pixelwright guide",
    description: `How to work with Pixelwright and read what it returns. Without a topic: the topics. Topics: ${TOPICS.map((topic) => `${topic} (${GUIDE_TOPICS[topic].about})`).join("; ")}. Read workflow first in a new task, and xml before building from design_read.`,
    input: z.object({
      topic: z.enum(TOPICS).exactOptional().describe("The topic to read. Default: the list of topics."),
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
    run: async ({ topic }) => {
      if (topic !== undefined) {
        return {
          topic,
          markdown: GUIDE_TOPICS[topic].markdown,
        };
      }

      const topics = TOPICS.map((name) => ({
        name,
        about: GUIDE_TOPICS[name].about,
      }));

      return {
        topic: "index",
        markdown: `# Pixelwright guide\n\n${topics.map(({ name, about }) => `- ${name}: ${about}`).join("\n")}\n\nCall guide with a topic to read it.\n`,
        topics,
      };
    },
  });
}

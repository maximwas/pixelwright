import { GUIDE_TOPICS, type GuideTopic } from "./topics.ts";

/** The guide's topics by name, as the tool's enum takes them. */
export const GUIDE_TOPIC_NAMES = Object.keys(GUIDE_TOPICS) as [GuideTopic, ...GuideTopic[]];

/** One topic of the guide, or, without one, the index of topics. */
export function readGuide(topic: GuideTopic | undefined): {
  topic: string;
  markdown: string;
  topics?: { name: string; about: string }[];
} {
  if (topic !== undefined) {
    return {
      topic,
      markdown: GUIDE_TOPICS[topic].markdown,
    };
  }

  const topics = GUIDE_TOPIC_NAMES.map((name) => ({
    name,
    about: GUIDE_TOPICS[name].about,
  }));

  return {
    topic: "index",
    markdown: `# Pixelwright guide\n\n${topics.map(({ name, about }) => `- ${name}: ${about}`).join("\n")}\n\nCall guide with a topic to read it.\n`,
    topics,
  };
}

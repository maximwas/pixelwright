/** The part of Pixelwright a log line comes from, its `component` field (plan 3.2). */
export const LOG_COMPONENT = {
  server: "server",
  bridge: "bridge",
  toolRunner: "tool-runner",
  pluginSession: "plugin-session",
  tool: "tool",
} as const;

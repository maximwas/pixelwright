/** The hint while the bridge is up and no file is connected: where to start the plugin. */
export const NO_FILE_HINT = {
  text: (plugin: string) =>
    `No Figma file is connected: open the file in Figma Desktop, run Plugins → Development → ${plugin}, and keep the plugin window open.`,
} as const;

/** How many renders the plugin holds at once (T-075): exports read side by side; past it the oldest is dropped. */
export const STREAMS = { held: 4 } as const;

export const STREAMS_TEXT = {
  gone: (stream: string) =>
    `The export ${stream} is no longer held (it was read whole, or more than ${STREAMS.held} were read at once): export it again.`,
} as const;

/** How many renders the plugin holds at once (T-075): exports read side by side; past it the oldest is dropped. */
export const STREAMS = { held: 4 } as const;

const MIB = 1024 * 1024;

/**
 * Files on their way in (P-030), 0.7.0's numbers: one is held five minutes (UPLOAD_TTL_MS), and 128 MB in all
 * (UPLOAD_BYTES), since a call may send many files before its apply.
 */
export const UPLOADS = { ttlMs: 5 * 60_000, maxBytes: 128 * MIB } as const;

export const STREAMS_TEXT = {
  pastEnd: (offset: number, total: number) =>
    `upload: a chunk at byte ${offset} starts past the file's ${total} bytes.`,
  gone: (stream: string) =>
    `The export ${stream} is no longer held (it was read whole, or more than ${STREAMS.held} were read at once): export it again.`,
} as const;

/** The longest code execute takes. */
export const EXECUTE_CODE_CHARS = 100_000;

/** The longest execute waits for its code: five minutes, for a long task; the bridge waits a little longer. */
export const EXECUTE_MAX_MS = 300_000;

/** How long execute waits when the call does not say. */
export const EXECUTE_DEFAULT_MS = 10_000;

/** The most console lines execute keeps; the rest are counted. */
export const EXECUTE_MAX_LOGS = 200;

/** The longest console line execute keeps. */
export const EXECUTE_LOG_CHARS = 2_000;

/** The longest result execute returns as JSON; a longer one comes back as its start. */
export const EXECUTE_RESULT_CHARS = 100_000;

/** How deep execute follows a returned value; deeper values come back as "[…]". */
export const EXECUTE_RESULT_DEPTH = 8;

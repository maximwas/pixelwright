/** A live plugin answers a ping in a few ms, and a free op never queues: past this the plugin is gone or frozen. */
export const PING_TIMEOUT_MS = 5_000;

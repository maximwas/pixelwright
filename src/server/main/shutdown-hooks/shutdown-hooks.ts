import { inject, injectable } from "@needle-di/core";
import closeWithGrace from "close-with-grace";
import { LOG_COMPONENT } from "@/core/ports/logger/logger.constants.ts";
import { LOGGER } from "@/core/ports/logger/logger.port.ts";
import { SHUTDOWN_DELAY_MS, SHUTDOWN_LOG, STDIN_EVENT } from "@/server/main/shutdown-hooks/shutdown-hooks.constants.ts";

/**
 * Closes the server once (S-013): when the MCP client goes away (stdin ends) or on SIGINT, SIGTERM and the other exit
 * signals; an uncaught error closes it too, logged with its stack. A second signal ends the process at once.
 */
@injectable()
export class ShutdownHooks {
  readonly #logger;

  constructor(logger = inject(LOGGER)) {
    this.#logger = logger;
  }

  install(close: () => Promise<void>): void {
    const logger = this.#logger.child({ component: LOG_COMPONENT.server });
    const hooks = closeWithGrace(
      {
        delay: SHUTDOWN_DELAY_MS,
        logger: false,
      },
      async ({ signal, err: error, manual }) => {
        if (error === undefined) {
          logger.info(SHUTDOWN_LOG.closing, {
            reason: signal ?? (manual ? SHUTDOWN_LOG.stdinClosed : SHUTDOWN_LOG.idle),
          });
        } else {
          logger.error(SHUTDOWN_LOG.crashed, { err: error });
        }

        await close();
      },
    );

    process.stdin.once(STDIN_EVENT.end, () => hooks.close());
    process.stdin.once(STDIN_EVENT.close, () => hooks.close());
  }
}

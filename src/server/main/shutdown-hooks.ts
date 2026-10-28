import { inject, injectable } from "@needle-di/core";
import closeWithGrace from "close-with-grace";
import { LOGGER } from "../../core/ports/logger.port.ts";
import { SHUTDOWN_DELAY_MS } from "./server.constants.ts";

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
    const logger = this.#logger.child({ component: "server" });
    const hooks = closeWithGrace(
      {
        delay: SHUTDOWN_DELAY_MS,
        logger: false,
      },
      async ({ signal, err: error, manual }) => {
        if (error === undefined) {
          logger.info("shutting down", { reason: signal ?? (manual ? "stdin closed" : "nothing left to do") });
        } else {
          logger.error("shutting down after an uncaught error", { err: error });
        }

        await close();
      },
    );

    process.stdin.once("end", () => hooks.close());
    process.stdin.once("close", () => hooks.close());
  }
}

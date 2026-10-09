import { BridgeError, fromWireError } from "@pixelwright/core";
import type { PendingRequest, ResponseMessage } from "../types/bridge.ts";

/** Requests sent to one plugin session and not answered yet. Each one fails on its own timer. */
export class PendingRequests {
  readonly #requests = new Map<string, PendingRequest>();

  /** Tracks a request; the promise settles with the plugin's response, a timeout or a disconnect. */
  track(id: string, op: string, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#requests.delete(id);
        reject(new BridgeError("TIMEOUT", `${op} timed out after ${timeoutMs} ms (it may still be applied in Figma)`));
      }, timeoutMs);

      this.#requests.set(id, {
        op,
        resolve,
        reject,
        timer,
      });
    });
  }

  /** Settles a request with the plugin's response. A late answer after a timeout is ignored. */
  settle(response: ResponseMessage): void {
    const request = this.#requests.get(response.id);

    if (request === undefined) {
      return;
    }

    this.#requests.delete(response.id);
    clearTimeout(request.timer);

    if (response.ok) {
      request.resolve(response.result ?? null);
    } else {
      request.reject(fromWireError(response.error));
    }
  }

  /** Fails every request: the plugin went away, so whether they ran is unknown. */
  failAll(closeCode: number): void {
    for (const request of this.#requests.values()) {
      clearTimeout(request.timer);
      request.reject(
        new BridgeError(
          "PLUGIN_DISCONNECTED",
          `plugin disconnected (${closeCode}) during ${request.op}; outcome unknown`,
        ),
      );
    }

    this.#requests.clear();
  }
}

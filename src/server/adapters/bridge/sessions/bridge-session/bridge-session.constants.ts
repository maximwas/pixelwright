import type { ProbeResult } from "@/core/ports/plugin-link/plugin-link.port.ts";

/** status probe with no file connected: nothing to ping. */
export const NO_PROBE: ProbeResult = {
  ok: false,
  ms: null,
  error: "PLUGIN_NOT_CONNECTED: no Figma file is connected, so there is no plugin to ping.",
};

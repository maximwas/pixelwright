/** What the bridge takes from the server's settings. */
export interface BridgeSettings {
  /** The port the owner listens on: the channel's, or 0 (any free port) in tests. */
  readonly port: number;
  /** Origins a plugin window may come from besides "null" (PIXELWRIGHT_PLUGIN_ORIGINS). */
  readonly pluginOrigins: readonly string[];
  /** <home>/bridge.json: the peers' token and the paired plugins' keys. */
  readonly configFile: string;
}

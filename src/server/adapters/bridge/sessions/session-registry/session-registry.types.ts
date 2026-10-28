/** A plugin turned away at hello for its protocol (S-004), kept for the status hint. */
export interface ProtocolRefusal {
  readonly protocol: number;
  /** The version its hello named, or null when it named none readable. */
  readonly pluginVersion: string | null;
}

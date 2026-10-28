/** A paired plugin's key: its id travels in hello, its secret never travels at all (S-023). */
export interface PluginKey {
  readonly id: string;
  readonly secret: string;
}

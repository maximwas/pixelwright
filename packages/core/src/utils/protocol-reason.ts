/**
 * The close reason a bridge gives a connection that speaks another protocol, naming the one it speaks. Every version
 * writes it the same way, so the other side can tell whether it is the older or the newer one.
 */
export function protocolRequired(protocol: number): string {
  return `protocol ${protocol} required`;
}

/** The protocol a close reason from protocolRequired names, or null for any other reason. */
export function requiredProtocol(reason: string | null): number | null {
  const match = /^protocol (\d+) required$/.exec(reason ?? "");

  return match === null ? null : Number(match[1]);
}

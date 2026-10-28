/** A random id for this plugin window; crypto.randomUUID needs a secure context, which a plugin iframe may not be. */
export function newInstanceId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

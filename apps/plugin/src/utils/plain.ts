/** Plugin API values are frozen objects with readonly arrays: a JSON copy is what goes on the wire anyway. */
export function plain<T = unknown>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

import type { ReactNode } from "react";

/** Orbit's badge: the Badge component, its Label text property as children. */
export function Badge({ children }: { readonly children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

import type { ReactNode } from "react";

interface ButtonProps {
  /** The Button set's Variant. */
  readonly variant?: "primary" | "secondary";
  /** The Button set's State=Disabled. */
  readonly disabled?: boolean;
  /** The Label text property. */
  readonly children: ReactNode;
}

/** Orbit's button: the Button component set, its Hover state left to CSS. */
export function Button({ variant = "primary", disabled = false, children }: ButtonProps) {
  return (
    <button type="button" className={`button button--${variant}`} disabled={disabled}>
      {children}
    </button>
  );
}

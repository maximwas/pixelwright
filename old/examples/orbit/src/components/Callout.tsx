import type { ReactNode } from "react";

interface CalloutProps {
  readonly title: string;
  readonly body: string;
  /** The Actions slot: the buttons a designer puts in it. */
  readonly children?: ReactNode;
}

/** Orbit's callout: the Callout component, its Title and Body properties as props, its Actions slot as children. */
export function Callout({ title, body, children }: CalloutProps) {
  return (
    <aside className="callout">
      <h3 className="callout__title">{title}</h3>
      <p className="callout__body">{body}</p>
      <div className="callout__actions">{children}</div>
    </aside>
  );
}

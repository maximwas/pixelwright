/** An element of the window: its tag, its class (none when empty) and what it holds. */
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  ...content: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const made = document.createElement(tag);

  if (className !== "") {
    made.className = className;
  }

  made.append(...content);

  return made;
}

// Planted: markup set from code. Refused by no-restricted-syntax.
export class RawHtml {
  fill(element: HTMLElement, markup: string): void {
    element.innerHTML = markup;
  }
}

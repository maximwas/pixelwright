import { element } from "./dom.ts";
import type { UpdateBanner } from "./update-banner.ts";

/**
 * The banner over the window when npm has a newer Pixelwright: which version is out, a link to its changes and one to
 * the steps to update (main opens both in the browser), and a button that closes it until the next version.
 */
export class UpdateBannerView {
  readonly #root = element("aside", "update");
  readonly #text = element("strong", "update-text");
  readonly #changes = element("a", "", "What's new");
  readonly #guide = element("a", "", "How to update");
  readonly #close = element("button", "update-close", "×");
  #shown: UpdateBanner | null = null;

  mount(onOpenLink: (url: string) => void, onDismiss: (version: string) => void): HTMLElement {
    const open = (url: (banner: UpdateBanner) => string) => (event: Event) => {
      event.preventDefault();

      if (this.#shown !== null) {
        onOpenLink(url(this.#shown));
      }
    };

    this.#root.setAttribute("role", "status");
    this.#close.type = "button";
    this.#close.setAttribute("aria-label", "Close until the next version");
    this.#changes.addEventListener(
      "click",
      open(({ changes }) => changes),
    );
    this.#guide.addEventListener(
      "click",
      open(({ guide }) => guide),
    );
    this.#close.addEventListener("click", () => {
      if (this.#shown !== null) {
        onDismiss(this.#shown.version);
      }
    });
    this.#root.append(
      element("div", "update-words", this.#text, element("span", "update-links", this.#changes, " · ", this.#guide)),
      this.#close,
    );
    this.#root.hidden = true;

    return this.#root;
  }

  render(update: UpdateBanner | null): void {
    this.#shown = update;
    this.#root.hidden = update === null;

    if (update !== null) {
      this.#text.textContent = update.text;
      this.#changes.href = update.changes;
      this.#guide.href = update.guide;
    }
  }
}

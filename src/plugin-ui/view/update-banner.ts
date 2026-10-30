import { InjectionToken, injectable } from "@needle-di/core";
import { UPDATE_TEXT, WINDOW_ELEMENT, WINDOW_ERROR } from "@/plugin-ui/view/view.constants.ts";

/**
 * The banner over the window when npm has a newer Pixelwright (S-070), shown until the user closes it; the server keeps
 * the closed version, so the banner comes back only with the next one. ui.html holds its markup.
 */
@injectable()
export class UpdateBanner {
  show(version: string, onClose: () => void): void {
    const banner = this.#element(WINDOW_ELEMENT.update);

    this.#element(WINDOW_ELEMENT.updateText).textContent = UPDATE_TEXT.out(version);
    // A property, not a listener: a second notice replaces the first one's handler.
    this.#element(WINDOW_ELEMENT.updateClose).onclick = () => {
      banner.hidden = true;
      onClose();
    };
    banner.hidden = false;
  }

  #element(id: string): HTMLElement {
    const element = document.getElementById(id);

    if (element === null) {
      throw new Error(WINDOW_ERROR.missing(id));
    }

    return element;
  }
}

export const UPDATE_BANNER = new InjectionToken<UpdateBanner>("UpdateBanner");

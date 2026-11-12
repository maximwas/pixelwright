import { InjectionToken, injectable } from "@needle-di/core";

/** The view now: the part of the page in view (page px), its centre, and the zoom (1 is 100%). */
export interface CanvasViewState {
  readonly bounds: Rect;
  readonly center: Vector;
  readonly zoom: number;
}

/** The page the user is on and the part of it in view (T-032, T-033): the one place the page and the view change. */
@injectable()
export class CanvasView {
  page(): PageNode {
    return figma.currentPage;
  }

  /** Makes the page the current one when it is another; under documentAccess "dynamic-page" that loads it first. */
  async open(page: PageNode): Promise<void> {
    if (page !== figma.currentPage) {
      await figma.setCurrentPageAsync(page);
    }
  }

  /** Fits the layers in view, then sets the zoom when one is given, centred on them; the zoom the view ends at. */
  bringIntoView(layers: readonly SceneNode[], zoom: number | null): number {
    figma.viewport.scrollAndZoomIntoView(layers);

    if (zoom !== null) {
      figma.viewport.zoom = zoom;
    }

    return figma.viewport.zoom;
  }

  state(): CanvasViewState {
    const { bounds, center, zoom } = figma.viewport;

    return { bounds, center, zoom };
  }
}

export const CANVAS_VIEW = new InjectionToken<CanvasView>("CanvasView");

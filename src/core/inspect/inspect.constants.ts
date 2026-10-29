/** Figma's measured sides (Dev Mode), and how a measurement names an end. */
export const MEASURED_SIDE = { left: "LEFT", right: "RIGHT", top: "TOP", bottom: "BOTTOM" } as const;

export const INSPECT_TEXT = { end: (id: string, side: string) => `${id} ${side.toLowerCase()}` } as const;

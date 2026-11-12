/** The most prototype links flow_read lists. */
export const FLOW_MAX_LINKS = 500;

/** The most layers file_map lists in all: past it, a page says how many it has. */
export const FILE_MAP_MAX_NODES = 1_500;

/** The layers a page's screens are: frames, components and instances, at its top or in its sections. */
export const SCREEN_TYPES: ReadonlySet<string> = new Set(["FRAME", "COMPONENT", "INSTANCE"]);

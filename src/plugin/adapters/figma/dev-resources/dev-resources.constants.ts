/** Figma's servers get 5 s to answer about a node's Dev Mode links (P-087): past it they are not read, with a note. */
export const DEV_LINKS = { timeoutMs: 5_000 } as const;

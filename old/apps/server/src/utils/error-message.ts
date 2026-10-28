/** The message of anything thrown. */
export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

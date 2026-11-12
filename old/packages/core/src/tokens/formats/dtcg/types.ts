/** A DTCG token (Design Tokens Format Module 2025.10): its type, its value or an alias, and its description. */
export interface DtcgToken {
  $type: string;
  $value: unknown;
  $description?: string;
}

/** A DTCG group: tokens and groups by name; a token whose path is also a group sits at `$root`. */
export interface DtcgGroup {
  [name: string]: DtcgGroup | DtcgToken;
}

/** tokens_read's DTCG output: a tree per collection mode (and one of styles), and what DTCG could not hold. */
export interface DtcgResult {
  trees: Record<string, DtcgGroup>;
  notes: string[];
}

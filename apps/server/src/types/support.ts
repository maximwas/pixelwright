/** A place to support the project. */
export interface SupportLink {
  /** What the link says, e.g. "Ko-fi". */
  readonly label: string;
  readonly url: string;
}

/** What a tool needs to add the support note to a result: the note when one is due, else null. */
export interface SupportNotes {
  due(): Promise<string | null>;
}

export interface SupportReminderOptions {
  /** support.json, shared by every session on the computer. */
  readonly file: string;
  /** PIXELWRIGHT_SUPPORT_REMINDERS=off turns the note off for good. */
  readonly enabled: boolean;
  readonly links: readonly SupportLink[];
  readonly now?: () => number;
}

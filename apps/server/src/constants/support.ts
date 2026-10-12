import type { SupportLink } from "../types/support.ts";

/**
 * Where people can support the project with a one-time donation: Ko-fi first (cards and PayPal, for supporters abroad),
 * then a monobank jar (any Visa or Mastercard). GitHub Sponsors does not pay out in Ukraine.
 */
export const SUPPORT_LINKS: readonly SupportLink[] = [
  {
    label: "Ko-fi",
    url: "https://ko-fi.com/maksymvasianin",
  },
  {
    label: "monobank",
    url: "https://send.monobank.ua/jar/7o9oMrbXTj",
  },
];

/** The least time between two support notes on one computer, whichever session gives them. */
export const SUPPORT_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** The file in the Pixelwright folder that remembers when the note was last given. */
export const SUPPORT_STATE_FILE = "support.json";

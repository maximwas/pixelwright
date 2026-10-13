import type { SupportLink } from "../types/support.ts";

/**
 * Where people can support the project with a one-time donation: Ko-fi first (cards and PayPal, for supporters abroad),
 * then a monobank jar (any Visa or Mastercard). GitHub Sponsors does not pay out in Ukraine. The server's weekly note
 * and the plugin window's links both come from here; the plugin opens no other address but FEEDBACK_LINK.
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

/** Where people tell what works, what does not and what they need: the repository's discussions. */
export const FEEDBACK_LINK: SupportLink = {
  label: "GitHub",
  url: "https://github.com/maximwas/pixelwright/discussions",
};

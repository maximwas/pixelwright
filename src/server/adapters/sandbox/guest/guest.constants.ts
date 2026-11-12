/** What the sandbox's utils know of pw's limits and of Pixelwright's trees. */
export const GUEST = {
  /** The most ids pw.inspect takes in one call: its input schema's maxItems (scripts/pw/guest-bundle.test.ts). */
  inspectBatch: 100,
  /** A run's pw calls in flight (CODE_LIMITS.inFlight): more at once would only wait in the run's own queue. */
  inFlight: 4,
  /** A hidden layer in pw.designRead's tree: a stub that CSS does not show. */
  hiddenDisplay: "none",
  /** A hidden layer in pw.outline's XML. */
  hiddenFlag: "true",
  /** One tag of pw.outline's XML: a closing slash, the name, the attributes (values in double quotes), a self-closing slash. */
  tag: /<(\/)?([A-Za-z][\w.-]*)((?:\s+[^\s=/>]+="[^"]*")*)\s*(\/)?>/g,
  attribute: /([^\s=]+)="([^"]*)"/g,
  /** The references XmlEscape writes in an attribute: four named ones, and numeric ones for line breaks and tabs. */
  reference: /&(?:#(\d+)|(amp|lt|gt|quot));/g,
  named: { amp: "&", lt: "<", gt: ">", quot: '"' },
  /** A colour channel's top as utils.color answers it: 0-255, as CSS writes rgb(). */
  channel: 255,
  /** A colour without alpha is opaque. */
  opaque: 1,
  /** color.same's default: the very same colour. */
  tolerance: 0,
} as const;

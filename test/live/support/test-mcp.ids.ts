/**
 * The test file and the layers live tests rely on (memory 5348c855). Its key is null, so its name and pages identify
 * it. The setup checks these ids once a tool can read a layer by id (outline, file_map).
 */
export const TEST_MCP = {
  file: "Test MCP",
  pages: ["Start here", "Orbit — Pricing", "Orbit — Components"],
  ids: {
    startHere: "0:1",
    startSection: "81:1541",
    install: "81:1627",
    orbitPricing: "54:226",
    /** Pricing – Desktop, the frame on that page: a read takes a layer, never a page. */
    pricingDesktop: "54:227",
    /** Orbit's hero: the Image Planet (54:317) is its asset, rendered to a file. */
    hero: "54:238",
    /** Orbit's Customers block, with the sticker turned 8 degrees (54:450) in it. */
    customers: "54:434",
    sticker: "54:450",
    /** The Pro plan card: a 2px inside stroke (the Install card has none). */
    planPro: "54:268",
    /** The Starter plan card: a Plan Card instance with its texts and a toggle as properties. */
    planStarter: "54:244",
    /** The header's Sign in: a Button variant (Variant=Secondary, State=Default). */
    signIn: "54:236",
    orbitComponents: "54:183",
  },
} as const;

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
    /** Orbit's Customers block, with the sticker turned 8 degrees (54:450) in it. */
    customers: "54:434",
    sticker: "54:450",
    orbitComponents: "54:183",
  },
} as const;

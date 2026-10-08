import { describe, expect, it } from "vitest";
import { pickActive } from "../src/utils/active-session.ts";

describe("pickActive", () => {
  it("prefers the window that came to the front last", () => {
    const sessions = [
      {
        id: "a",
        lastVisible: 3,
        connected: 1,
      },
      {
        id: "b",
        lastVisible: 0,
        connected: 2,
      },
    ];

    expect(pickActive(sessions)?.id).toBe("a");
  });

  it("falls back to the newest connection when no window was in front", () => {
    const sessions = [
      {
        id: "a",
        lastVisible: 0,
        connected: 1,
      },
      {
        id: "b",
        lastVisible: 0,
        connected: 2,
      },
    ];

    expect(pickActive(sessions)?.id).toBe("b");
  });

  it("has nothing to pick without sessions", () => {
    expect(pickActive([])).toBeNull();
  });
});

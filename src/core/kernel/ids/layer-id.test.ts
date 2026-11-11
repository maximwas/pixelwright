import { describe, expect, it } from "vitest";
import { LayerId } from "@/core/kernel/ids/layer-id.ts";

// C-167
describe("LayerId", () => {
  it.each(["54:243", "I54:268;54:211", "1:2;3:4;5:6"])("accepts %s", (text) => {
    expect(LayerId.parse(text)?.value).toBe(text);
  });

  it.each(["", "54", "54:", "I", "54:243;", "x1:2", " 1:2", "1:2 ", "II1:2", "1:a", "1:2;I3:4"])("refuses %j", (text) => {
    expect(LayerId.parse(text)).toBeNull();
  });
});

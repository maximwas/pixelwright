import { changelogLink, UPDATE_GUIDE_LINK } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { updateBanner } from "../src/view/update-banner.ts";

describe("the update banner", () => {
  it("shows a version newer than the plugin, with its changes and the steps to update", () => {
    expect(
      updateBanner({
        latest: "0.4.0",
        pluginVersion: "0.3.1",
        dismissed: null,
      }),
    ).toEqual({
      version: "0.4.0",
      text: "Pixelwright 0.4.0 is out",
      changes: changelogLink("0.4.0"),
      guide: UPDATE_GUIDE_LINK,
    });
  });

  it("stays closed for the version it was closed on, until a newer one comes", () => {
    expect(
      updateBanner({
        latest: "0.4.0",
        pluginVersion: "0.3.1",
        dismissed: "0.4.0",
      }),
    ).toBeNull();
    expect(
      updateBanner({
        latest: "0.4.1",
        pluginVersion: "0.3.1",
        dismissed: "0.4.0",
      }),
    ).toMatchObject({
      version: "0.4.1",
    });
  });

  it("is not there for the plugin's own version, an older one, or none known", () => {
    expect(
      updateBanner({
        latest: "0.3.1",
        pluginVersion: "0.3.1",
        dismissed: null,
      }),
    ).toBeNull();
    expect(
      updateBanner({
        latest: "0.3.0",
        pluginVersion: "0.3.1",
        dismissed: null,
      }),
    ).toBeNull();
    expect(
      updateBanner({
        latest: null,
        pluginVersion: "0.3.1",
        dismissed: null,
      }),
    ).toBeNull();
  });
});

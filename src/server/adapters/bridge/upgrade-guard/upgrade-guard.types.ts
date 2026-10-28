import type { IncomingMessage } from "node:http";

/** Who upgrades: the plugin's window, or another Pixelwright server joining the owner. */
export type UpgradeRole = "plugin" | "peer";

export type UpgradeRequest = Pick<IncomingMessage, "url" | "headers">;

/** A refused upgrade, kept for the status hint: which check failed and the Origin it came with. */
export interface UpgradeRejection {
  readonly reason: "host" | "origin";
  readonly origin: string | null;
}

export type UpgradeVerdict =
  | { readonly status: 404 }
  | {
    readonly status: 101;
    readonly role: UpgradeRole;
  }
  | {
    readonly status: 403;
    readonly role: UpgradeRole;
    readonly rejection: UpgradeRejection;
  };

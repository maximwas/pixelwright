import type { IncomingMessage } from "node:http";
import type { UPGRADE_REFUSAL, UPGRADE_ROLE } from "./upgrade-guard.constants.ts";

/** Who upgrades: the plugin's window, or another Pixelwright server joining the owner. */
export type UpgradeRole = (typeof UPGRADE_ROLE)[keyof typeof UPGRADE_ROLE];

/** Which check refused an upgrade. */
export type UpgradeRefusal = (typeof UPGRADE_REFUSAL)[keyof typeof UPGRADE_REFUSAL];

export type UpgradeRequest = Pick<IncomingMessage, "url" | "headers">;

/** A refused upgrade, kept for the status hint: which check failed and the Origin it came with. */
export interface UpgradeRejection {
  readonly reason: UpgradeRefusal;
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

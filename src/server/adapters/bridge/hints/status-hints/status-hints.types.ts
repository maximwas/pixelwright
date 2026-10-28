import type { PairingStatus, PluginLinkRole } from "../../../../../core/ports/plugin-link/plugin-link.port.ts";
import type { UpgradeRejection } from "../../upgrade-guard/upgrade-guard.types.ts";

/** What status knows about the bridge when it picks a hint. */
export interface HintFacts {
  readonly role: PluginLinkRole;
  readonly port: number;
  /** Why the bridge could not start, when the role is failed. */
  readonly failure: string | null;
  /** How the owner closed this server's socket, when the role is unavailable. */
  readonly closeCode: number | null;
  readonly pairing: PairingStatus | null;
  /** Files whose plugin is connected. */
  readonly files: number;
  /** The last plugin upgrade the guard refused. */
  readonly rejection: UpgradeRejection | null;
}

/** One row of the hint table (Strategy): whether it speaks for the facts, and what it says. */
export interface StatusHint {
  applies(facts: HintFacts): boolean;
  /** The hint; null when nothing is wrong. */
  text(facts: HintFacts): string | null;
}

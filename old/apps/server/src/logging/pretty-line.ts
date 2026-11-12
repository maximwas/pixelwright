import { ANSI_RESET, LOG_LEVEL_COLORS, LOG_LEVEL_NAMES } from "../constants/logging.ts";

/**
 * One pino line for people: "13:22:44 info  [58063] tool design_read  file=Test MCP ms=31". The pid tells the
 * processes (MCP client sessions) apart; an error shows its message. A line that is not JSON is printed as it is.
 */
export function prettyLine(line: string): string {
  let record: Record<string, unknown>;

  try {
    record = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return line;
  }

  const { level, time, pid, msg, name: _name, hostname: _hostname, err, ...rest } = record;
  const levelName = LOG_LEVEL_NAMES[Number(level)] ?? String(level);
  const at = new Date(Number(time)).toLocaleTimeString("en-GB");
  const details = Object.entries(rest).map(
    ([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`,
  );

  if (typeof err === "object" && err !== null && "message" in err) {
    details.push(`error=${String(err.message)}`);
  }

  const text = `${at} ${levelName.padEnd(5)} [${String(pid)}] ${String(msg ?? "")}${details.length > 0 ? `  ${details.join(" ")}` : ""}`;
  const color = LOG_LEVEL_COLORS[levelName];

  return color === undefined ? text : `${color}${text}${ANSI_RESET}`;
}

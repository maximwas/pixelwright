import { InjectionToken } from "@needle-di/core";
import type { CliCommand, CliStreams, LogsSettings } from "@/cli/main/cli.types.ts";
import type { PluginFiles, Prompts, SetupSettings } from "@/cli/setup/setup.types.ts";

/** Every command, one provider each. */
export const CLI_COMMANDS = new InjectionToken<CliCommand>("CliCommands");

export const CLI_STREAMS = new InjectionToken<CliStreams>("CliStreams");

export const SETUP_SETTINGS = new InjectionToken<SetupSettings>("SetupSettings");

/** @clack/prompts, as the wizard uses it. */
export const PROMPTS = new InjectionToken<Prompts>("Prompts");

/** The plugin's files: where the package keeps them, and their copy into the channel's home. */
export const PLUGIN_COPY = new InjectionToken<PluginFiles>("PluginCopy");

export const LOGS_SETTINGS = new InjectionToken<LogsSettings>("LogsSettings");

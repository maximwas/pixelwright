/** Why a relative path has nowhere to start (S-081): GUI clients start servers in / or the home folder. */
export const PROJECT_TEXT = {
  noProject: (folder: string) =>
    `${folder} is no project folder, so a relative path has nowhere to start: start the MCP client in the project, set CLAUDE_PROJECT_DIR, or give an absolute path.`,
} as const;

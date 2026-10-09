/** The agent cannot run on this machine at all: missing, broken or logged out. */
export class AgentUnavailableError extends Error {
  constructor(
    message: string,
    readonly hint: string
  ) {
    super(message);
    this.name = "AgentUnavailableError";
  }
}

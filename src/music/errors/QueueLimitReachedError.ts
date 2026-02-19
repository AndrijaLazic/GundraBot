export class QueueLimitReachedError extends Error {
  constructor(public readonly limit: number) {
    super(`Queue limit reached (${limit})`);
    this.name = "QueueLimitReachedError";
  }
}

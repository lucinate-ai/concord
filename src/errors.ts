/** A user-facing error: bad usage or an unusable environment (exit 2). */
export class ConcordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcordError';
  }
}

/** An expected failure with a stable `code`; `app.onError` turns it into a JSON response. */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 = 409
  ) {
    super(code);
  }
}

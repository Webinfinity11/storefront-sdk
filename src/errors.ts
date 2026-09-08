/**
 * The only error the SDK throws.
 *
 * `code` mirrors the API's error code (`NOT_FOUND`, `RATE_LIMITED`, …) so a
 * storefront can branch on it without parsing messages, and `status` is the
 * HTTP status for the cases where that is what matters.
 */
export class StoreApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: string,
    status: number,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "StoreApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Nothing there — usually a slug or order id that does not exist. */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** The key is missing, wrong, revoked, or lacks the scope. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** Out of stock, or another conflict the caller can retry differently. */
  get isConflict(): boolean {
    return this.status === 409;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

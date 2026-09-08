/**
 * The only error the SDK throws.
 *
 * `code` mirrors the API's error code (`NOT_FOUND`, `RATE_LIMITED`, …) so a
 * storefront can branch on it without parsing messages, and `status` is the
 * HTTP status for the cases where that is what matters.
 */
export declare class StoreApiError extends Error {
    readonly code: string;
    readonly status: number;
    readonly details?: unknown;
    constructor(code: string, status: number, message: string, details?: unknown);
    /** Nothing there — usually a slug or order id that does not exist. */
    get isNotFound(): boolean;
    /** The key is missing, wrong, revoked, or lacks the scope. */
    get isAuthError(): boolean;
    /** Out of stock, or another conflict the caller can retry differently. */
    get isConflict(): boolean;
    get isRateLimited(): boolean;
}
//# sourceMappingURL=errors.d.ts.map
/**
 * The only error the SDK throws.
 *
 * `code` mirrors the API's error code (`NOT_FOUND`, `RATE_LIMITED`, …) so a
 * storefront can branch on it without parsing messages, and `status` is the
 * HTTP status for the cases where that is what matters.
 */
export class StoreApiError extends Error {
    code;
    status;
    details;
    constructor(code, status, message, details) {
        super(message);
        this.name = "StoreApiError";
        this.code = code;
        this.status = status;
        this.details = details;
    }
    /** Nothing there — usually a slug or order id that does not exist. */
    get isNotFound() {
        return this.status === 404;
    }
    /** The key is missing, wrong, revoked, or lacks the scope. */
    get isAuthError() {
        return this.status === 401 || this.status === 403;
    }
    /** Out of stock, or another conflict the caller can retry differently. */
    get isConflict() {
        return this.status === 409;
    }
    get isRateLimited() {
        return this.status === 429;
    }
}
//# sourceMappingURL=errors.js.map
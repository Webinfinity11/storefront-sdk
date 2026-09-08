import { StoreApiError } from "./errors.js";
const isRecord = (value) => typeof value === "object" && value !== null;
/** Pulls `{ code, message, details }` out of an error body, however odd it is. */
function toStoreApiError(status, body) {
    if (isRecord(body) && isRecord(body["error"])) {
        const error = body["error"];
        return new StoreApiError(typeof error["code"] === "string" ? error["code"] : "UNKNOWN", status, typeof error["message"] === "string"
            ? error["message"]
            : `Request failed with status ${status}`, error["details"]);
    }
    return new StoreApiError("UNKNOWN", status, `Request failed with status ${status}`);
}
/**
 * Creates a client bound to one store's API key.
 *
 * Every method returns `{ data, meta? }` — the same envelope the API uses — and
 * throws {@link StoreApiError} on any non-2xx answer.
 */
export function createStoreClient(options) {
    if (!options.apiKey)
        throw new Error("createStoreClient: apiKey is required");
    if (!options.baseUrl)
        throw new Error("createStoreClient: baseUrl is required");
    const baseUrl = options.baseUrl.replace(/\/+$/, "");
    const doFetch = options.fetch ?? globalThis.fetch;
    async function request(path, init = {}, requestOptions = {}) {
        const url = new URL(`${baseUrl}${path}`);
        for (const [key, value] of Object.entries(init.query ?? {})) {
            if (value !== undefined)
                url.searchParams.set(key, String(value));
        }
        const next = { ...options.next, ...requestOptions.next };
        const response = await doFetch(url.toString(), {
            method: init.method ?? "GET",
            headers: {
                "x-api-key": options.apiKey,
                ...(init.body ? { "content-type": "application/json" } : {}),
                ...options.headers,
            },
            ...(init.body ? { body: JSON.stringify(init.body) } : {}),
            ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
            ...(requestOptions.cache ? { cache: requestOptions.cache } : {}),
            // Ignored outside Next.js, which is exactly what a plain fetch does.
            ...(Object.keys(next).length > 0 ? { next } : {}),
        });
        const raw = await response.json().catch(() => null);
        if (!response.ok)
            throw toStoreApiError(response.status, raw);
        if (!isRecord(raw) || !("data" in raw)) {
            throw new StoreApiError("INVALID_RESPONSE", response.status, "Unexpected response body");
        }
        return {
            data: raw["data"],
            ...(isRecord(raw["meta"]) ? { meta: raw["meta"] } : {}),
        };
    }
    return {
        getStore: (requestOptions) => request("/api/v1/store", {}, requestOptions),
        getCategories: (requestOptions) => request("/api/v1/categories", {}, requestOptions),
        getProducts: (query = {}, requestOptions) => request("/api/v1/products", {
            query: {
                category: query.category,
                search: query.search,
                page: query.page,
                limit: query.limit,
                sort: query.sort,
            },
        }, requestOptions),
        getProduct: (slug, requestOptions) => request(`/api/v1/products/${encodeURIComponent(slug)}`, {}, requestOptions),
        createOrder: (body, requestOptions) => request("/api/v1/orders", { method: "POST", body }, 
        // An order is never cached, whatever the client's defaults say.
        { ...requestOptions, cache: "no-store", next: { revalidate: 0 } }),
        getOrder: (id, phone, requestOptions) => request(`/api/v1/orders/${encodeURIComponent(id)}`, { query: { phone } }, { ...requestOptions, cache: "no-store", next: { revalidate: 0 } }),
    };
}
//# sourceMappingURL=client.js.map
import type { ApiCategory, ApiMeta, ApiOrder, ApiProduct, ApiStore } from "./types.js";
/** Next.js adds these to `RequestInit`; typed here so the SDK needs no deps. */
export type NextFetchOptions = {
    revalidate?: number | false;
    tags?: string[];
};
export type StoreClientOptions = {
    /** `sk_live_…` — server-side only. Never ship it to the browser. */
    apiKey: string;
    /** e.g. `https://admin.example.com` */
    baseUrl: string;
    /** Defaults applied to every request; override per call. */
    next?: NextFetchOptions;
    /** Swap in a custom fetch (tests, tracing, a proxy). */
    fetch?: typeof globalThis.fetch;
    headers?: Record<string, string>;
};
export type RequestOptions = {
    next?: NextFetchOptions;
    signal?: AbortSignal;
    /** `no-store` for anything that must not be cached. */
    cache?: RequestCache;
};
export type ProductListQuery = {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort?: "newest" | "oldest" | "price_asc" | "price_desc" | "name";
};
export type CreateOrderBody = {
    customer: {
        name: string;
        phone: string;
        email?: string;
    };
    items: {
        productId: string;
        variantId?: string;
        quantity: number;
    }[];
    shippingAddress: {
        city: string;
        address: string;
        zip?: string;
        note?: string;
    };
    paymentMethod: string;
    /**
     * Id of the delivery zone the customer picked, from
     * `getStore().shipping.zones`. Omit it and the store's base rate applies.
     */
    shippingZoneId?: string;
    note?: string;
};
export type Result<T> = {
    data: T;
    meta?: ApiMeta;
};
export type StoreClient = {
    getStore: (options?: RequestOptions) => Promise<Result<ApiStore>>;
    getCategories: (options?: RequestOptions) => Promise<Result<ApiCategory[]>>;
    getProducts: (query?: ProductListQuery, options?: RequestOptions) => Promise<Result<ApiProduct[]>>;
    getProduct: (slug: string, options?: RequestOptions) => Promise<Result<ApiProduct>>;
    createOrder: (body: CreateOrderBody, options?: RequestOptions) => Promise<Result<ApiOrder>>;
    getOrder: (id: string, phone: string, options?: RequestOptions) => Promise<Result<ApiOrder>>;
};
/**
 * Creates a client bound to one store's API key.
 *
 * Every method returns `{ data, meta? }` — the same envelope the API uses — and
 * throws {@link StoreApiError} on any non-2xx answer.
 */
export declare function createStoreClient(options: StoreClientOptions): StoreClient;
//# sourceMappingURL=client.d.ts.map
import { StoreApiError } from "./errors.js";
import type {
  ApiCategory,
  ApiMeta,
  ApiOrder,
  ApiProduct,
  ApiStore,
} from "./types.js";

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
  customer: { name: string; phone: string; email?: string };
  items: { productId: string; variantId?: string; quantity: number }[];
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

export type Result<T> = { data: T; meta?: ApiMeta };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Pulls `{ code, message, details }` out of an error body, however odd it is. */
function toStoreApiError(status: number, body: unknown): StoreApiError {
  if (isRecord(body) && isRecord(body["error"])) {
    const error = body["error"];
    return new StoreApiError(
      typeof error["code"] === "string" ? error["code"] : "UNKNOWN",
      status,
      typeof error["message"] === "string"
        ? error["message"]
        : `Request failed with status ${status}`,
      error["details"],
    );
  }

  return new StoreApiError(
    "UNKNOWN",
    status,
    `Request failed with status ${status}`,
  );
}

export type StoreClient = {
  getStore: (options?: RequestOptions) => Promise<Result<ApiStore>>;
  getCategories: (options?: RequestOptions) => Promise<Result<ApiCategory[]>>;
  getProducts: (
    query?: ProductListQuery,
    options?: RequestOptions,
  ) => Promise<Result<ApiProduct[]>>;
  getProduct: (
    slug: string,
    options?: RequestOptions,
  ) => Promise<Result<ApiProduct>>;
  createOrder: (
    body: CreateOrderBody,
    options?: RequestOptions,
  ) => Promise<Result<ApiOrder>>;
  getOrder: (
    id: string,
    phone: string,
    options?: RequestOptions,
  ) => Promise<Result<ApiOrder>>;
};

/**
 * Creates a client bound to one store's API key.
 *
 * Every method returns `{ data, meta? }` — the same envelope the API uses — and
 * throws {@link StoreApiError} on any non-2xx answer.
 */
export function createStoreClient(options: StoreClientOptions): StoreClient {
  if (!options.apiKey) throw new Error("createStoreClient: apiKey is required");
  if (!options.baseUrl)
    throw new Error("createStoreClient: baseUrl is required");

  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const doFetch = options.fetch ?? globalThis.fetch;

  async function request<T>(
    path: string,
    init: {
      method?: "GET" | "POST";
      body?: unknown;
      query?: Record<string, string | number | undefined>;
    } = {},
    requestOptions: RequestOptions = {},
  ): Promise<Result<T>> {
    const url = new URL(`${baseUrl}${path}`);

    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
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
    } as RequestInit);

    const raw: unknown = await response.json().catch(() => null);

    if (!response.ok) throw toStoreApiError(response.status, raw);

    if (!isRecord(raw) || !("data" in raw)) {
      throw new StoreApiError(
        "INVALID_RESPONSE",
        response.status,
        "Unexpected response body",
      );
    }

    return {
      data: raw["data"] as T,
      ...(isRecord(raw["meta"]) ? { meta: raw["meta"] as ApiMeta } : {}),
    };
  }

  return {
    getStore: (requestOptions) =>
      request<ApiStore>("/api/v1/store", {}, requestOptions),

    getCategories: (requestOptions) =>
      request<ApiCategory[]>("/api/v1/categories", {}, requestOptions),

    getProducts: (query = {}, requestOptions) =>
      request<ApiProduct[]>(
        "/api/v1/products",
        {
          query: {
            category: query.category,
            search: query.search,
            page: query.page,
            limit: query.limit,
            sort: query.sort,
          },
        },
        requestOptions,
      ),

    getProduct: (slug, requestOptions) =>
      request<ApiProduct>(
        `/api/v1/products/${encodeURIComponent(slug)}`,
        {},
        requestOptions,
      ),

    createOrder: (body, requestOptions) =>
      request<ApiOrder>(
        "/api/v1/orders",
        { method: "POST", body },
        // An order is never cached, whatever the client's defaults say.
        { ...requestOptions, cache: "no-store", next: { revalidate: 0 } },
      ),

    getOrder: (id, phone, requestOptions) =>
      request<ApiOrder>(
        `/api/v1/orders/${encodeURIComponent(id)}`,
        { query: { phone } },
        { ...requestOptions, cache: "no-store", next: { revalidate: 0 } },
      ),
  };
}

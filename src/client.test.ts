import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStoreClient } from "./client.js";
import { StoreApiError } from "./errors.js";

const API_KEY = "sk_live_test";
const BASE_URL = "https://admin.example.com";

const fetchMock = vi.fn();

const client = () =>
  createStoreClient({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: fetchMock });

/**
 * A `Response` body can only be read once, so every mocked call has to build a
 * fresh one — hence a factory rather than a shared instance.
 */
const respondWith = (body: unknown, status = 200): void => {
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
};

const lastCall = () => {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was not called");
  return { url: call[0] as string, init: (call[1] ?? {}) as RequestInit };
};

beforeEach(() => {
  fetchMock.mockReset();
  respondWith({ data: {} });
});

describe("createStoreClient", () => {
  it("requires an apiKey and a baseUrl", () => {
    expect(() => createStoreClient({ apiKey: "", baseUrl: BASE_URL })).toThrow(
      /apiKey/,
    );
    expect(() => createStoreClient({ apiKey: API_KEY, baseUrl: "" })).toThrow(
      /baseUrl/,
    );
  });

  it("sends the key on every request", async () => {
    await client().getStore();

    const headers = lastCall().init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(API_KEY);
  });

  it("tolerates a trailing slash in baseUrl", async () => {
    const store = createStoreClient({
      apiKey: API_KEY,
      baseUrl: `${BASE_URL}///`,
      fetch: fetchMock,
    });

    await store.getStore();
    expect(lastCall().url).toBe(`${BASE_URL}/api/v1/store`);
  });
});

describe("read methods", () => {
  it("hits the documented URLs", async () => {
    const store = client();

    await store.getStore();
    expect(lastCall().url).toBe(`${BASE_URL}/api/v1/store`);

    respondWith({ data: [] });
    await store.getCategories();
    expect(lastCall().url).toBe(`${BASE_URL}/api/v1/categories`);

    await store.getProducts();
    expect(lastCall().url).toBe(`${BASE_URL}/api/v1/products`);

    respondWith({ data: {} });
    await store.getProduct("burti-nike");
    expect(lastCall().url).toBe(`${BASE_URL}/api/v1/products/burti-nike`);
  });

  it("encodes a slug with awkward characters", async () => {
    await client().getProduct("ბურთი/nike?x=1");

    expect(lastCall().url).toBe(
      `${BASE_URL}/api/v1/products/${encodeURIComponent("ბურთი/nike?x=1")}`,
    );
  });

  it("passes list filters as query parameters and omits the rest", async () => {
    respondWith({ data: [] });

    await client().getProducts({
      category: "boots",
      search: "nike",
      page: 2,
      limit: 5,
      sort: "price_asc",
    });

    const url = new URL(lastCall().url);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      category: "boots",
      search: "nike",
      page: "2",
      limit: "5",
      sort: "price_asc",
    });

    await client().getProducts({ page: 3 });
    expect([...new URL(lastCall().url).searchParams.keys()]).toEqual(["page"]);
  });

  it("returns data and meta from the envelope", async () => {
    respondWith({
      data: [{ slug: "a" }],
      meta: { page: 1, limit: 20, total: 1, pageCount: 1 },
    });

    const result = await client().getProducts();

    expect(result.data).toEqual([{ slug: "a" }]);
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, pageCount: 1 });
  });

  it("omits meta when the response has none", async () => {
    const result = await client().getStore();
    expect(result.meta).toBeUndefined();
  });
});

describe("write methods", () => {
  const body = {
    customer: { name: "ნინო", phone: "+995555111222" },
    items: [{ productId: "p1", quantity: 2 }],
    shippingAddress: { city: "თბილისი", address: "ჭავჭავაძის 1" },
    paymentMethod: "bog",
  };

  it("posts an order as JSON", async () => {
    respondWith({ data: { id: "o1" } }, 201);

    const result = await client().createOrder(body);

    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/api/v1/orders`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(init.body as string)).toEqual(body);
    expect(result.data).toEqual({ id: "o1" });
  });

  it("never caches an order write or lookup", async () => {
    respondWith({ data: {} }, 201);
    await client().createOrder(body);
    expect(lastCall().init.cache).toBe("no-store");

    await client().getOrder("o1", "+995555111222");
    expect(lastCall().init.cache).toBe("no-store");
  });

  it("sends the phone as a query parameter when looking an order up", async () => {
    await client().getOrder("o1", "+995555111222");

    const url = new URL(lastCall().url);
    expect(url.pathname).toBe("/api/v1/orders/o1");
    expect(url.searchParams.get("phone")).toBe("+995555111222");
  });
});

describe("Next.js fetch options", () => {
  it("passes the client's defaults through", async () => {
    const store = createStoreClient({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetch: fetchMock,
      next: { revalidate: 60, tags: ["products"] },
    });

    await store.getProducts();

    expect(lastCall().init).toMatchObject({
      next: { revalidate: 60, tags: ["products"] },
    });
  });

  it("lets a single call override them", async () => {
    const store = createStoreClient({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetch: fetchMock,
      next: { revalidate: 60 },
    });

    await store.getProduct("a", { next: { revalidate: 5, tags: ["one"] } });

    expect(lastCall().init).toMatchObject({
      next: { revalidate: 5, tags: ["one"] },
    });
  });

  it("sends no `next` field when none was configured", async () => {
    await client().getStore();
    expect(lastCall().init).not.toHaveProperty("next");
  });
});

describe("error mapping", () => {
  it.each([
    [401, "UNAUTHORIZED", "isAuthError"],
    [403, "FORBIDDEN", "isAuthError"],
    [404, "NOT_FOUND", "isNotFound"],
    [409, "CONFLICT", "isConflict"],
    [429, "RATE_LIMITED", "isRateLimited"],
  ] as const)("maps %i to a typed error", async (status, code, flag) => {
    respondWith({ error: { code, message: "nope" } }, status);

    const error = await client()
      .getStore()
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(StoreApiError);
    const storeError = error as StoreApiError;
    expect(storeError.status).toBe(status);
    expect(storeError.code).toBe(code);
    expect(storeError.message).toBe("nope");
    expect(storeError[flag]).toBe(true);
  });

  it("carries validation details through", async () => {
    respondWith(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Validation failed",
          details: [{ path: "items", message: "კალათა ცარიელია" }],
        },
      },
      400,
    );

    const error = (await client()
      .getStore()
      .catch((thrown: unknown) => thrown)) as StoreApiError;

    expect(error.details).toEqual([
      { path: "items", message: "კალათა ცარიელია" },
    ]);
  });

  it("still throws when the error body is not the expected shape", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response("<html>502</html>", { status: 502 })),
    );

    const error = (await client()
      .getStore()
      .catch((thrown: unknown) => thrown)) as StoreApiError;

    expect(error).toBeInstanceOf(StoreApiError);
    expect(error.status).toBe(502);
    expect(error.code).toBe("UNKNOWN");
  });

  it("rejects a 200 that is missing `data`", async () => {
    respondWith({ products: [] });

    const error = (await client()
      .getStore()
      .catch((thrown: unknown) => thrown)) as StoreApiError;

    expect(error.code).toBe("INVALID_RESPONSE");
  });
});

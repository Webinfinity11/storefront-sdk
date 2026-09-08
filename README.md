# infinity-storefront-sdk

Typed client for the multi-store admin's public API. Zero runtime dependencies,
ESM only, ships its own types.

## Install

```bash
pnpm add github:Webinfinity11/storefront-sdk
```

The package is distributed through its own public repository,
[Webinfinity11/storefront-sdk](https://github.com/Webinfinity11/storefront-sdk),
which carries a built `dist/` so a consumer compiles nothing.

## `.env.local`

```env
STORE_API_URL=https://infinity.com.ge
STORE_API_KEY=sk_live_...
REVALIDATE_SECRET=<the same value as the webhook's secret in the admin>
```

`STORE_API_KEY` is a server-side secret. Keep it out of anything prefixed
`NEXT_PUBLIC_`, and never build the client inside a `"use client"` file.

## Getting started

```ts
import { createStoreClient } from "infinity-storefront-sdk";

export const store = createStoreClient({
  apiKey: process.env.STORE_API_KEY!,
  baseUrl: process.env.STORE_API_URL!,
  next: { revalidate: 60 }, // ISR: pages refresh at most once a minute
});
```

```ts
const { data: info } = await store.getStore();
const { data: categories } = await store.getCategories();
const { data: products, meta } = await store.getProducts({ limit: 20 });
const { data: product } = await store.getProduct("burti-nike");
```

Every method returns the API's `{ data, meta? }` envelope. `meta` is present
only where the endpoint paginates.

## Placing an order

```ts
const { data: order } = await store.createOrder({
  customer: { name: "ნინო ბერიძე", phone: "+995555111222" },
  items: [{ productId: product.id, quantity: 2 }],
  shippingAddress: { city: "თბილისი", address: "ჭავჭავაძის 1" },
  paymentMethod: "flitt",
});
```

Prices, shipping and the total are decided by the server from the store's own
data; anything the client sends is ignored. Order writes and lookups are never
cached.

```ts
const { data: status } = await store.getOrder(order.id, "+995555111222");
```

## Errors

```ts
import { StoreApiError } from "infinity-storefront-sdk";

try {
  await store.createOrder(body);
} catch (error) {
  if (error instanceof StoreApiError) {
    if (error.isConflict) return "ეს პროდუქტი ამოიწურა";
    if (error.isNotFound) return "პროდუქტი ვერ მოიძებნა";
    if (error.isRateLimited) return "სცადე ცოტა ხანში";
    if (error.isAuthError) throw error; // a configuration problem, not the user's
  }
  throw error;
}
```

`error.code` mirrors the API's code (`BAD_REQUEST`, `CONFLICT`, `NOT_FOUND`, …)
and `error.details` carries field errors for validation failures.

## ISR and on-demand revalidation

Tag the reads you want to invalidate later:

```ts
const { data: products } = await store.getProducts(
  { limit: 20 },
  { next: { revalidate: 60, tags: ["products"] } },
);
```

Then add a webhook in the admin (Settings → Webhooks) pointing at your route,
subscribed to `product.created`, `product.updated`, `product.deleted` and
`category.updated`:

```ts
// app/api/revalidate/route.ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";

  const expected = `sha256=${createHmac("sha256", process.env.REVALIDATE_SECRET!)
    .update(body, "utf8")
    .digest("hex")}`;

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response("bad signature", { status: 401 });
  }

  revalidateTag("products");
  return Response.json({ revalidated: true });
}
```

The admin signs the exact bytes it sends, so verify against the raw text — not
a re-serialised object.

## Reference

| Method | Endpoint | Notes |
| --- | --- | --- |
| `getStore()` | `GET /api/v1/store` | features, payment methods, shipping, contact |
| `getCategories()` | `GET /api/v1/categories` | active categories as a tree |
| `getProducts(query?)` | `GET /api/v1/products` | `category`, `search`, `page`, `limit`, `sort` |
| `getProduct(slug)` | `GET /api/v1/products/:slug` | throws `NOT_FOUND` when inactive |
| `createOrder(body)` | `POST /api/v1/orders` | needs the `orders:write` scope |
| `getOrder(id, phone)` | `GET /api/v1/orders/:id` | the phone must match the order |

## Development

```bash
pnpm --filter infinity-storefront-sdk test
pnpm --filter infinity-storefront-sdk build
```

`sdk/src/types.ts` is generated from the admin's `src/schemas/api.ts` — run
`pnpm sdk:sync-types` from the repository root after changing the API. A test
fails if the two drift apart.

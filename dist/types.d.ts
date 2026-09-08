export type ApiMeta = {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
};
export type ApiSuccess<T> = {
    data: T;
    meta?: ApiMeta;
};
export type ApiFailure = {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
};
export type LocalizedText = {
    ka?: string;
    en?: string;
    ru?: string;
};
export type ApiImage = {
    url: string;
    thumbUrl: string;
    mediumUrl: string;
    alt: string | null;
    width: number;
    height: number;
};
/**
 * A product video.
 *
 * Deliberately not an `ApiImage`: there is no thumbnail or poster (generating
 * one needs ffmpeg, which the admin does not have) and no dimensions, so a
 * storefront that treated it as an image would render nothing. Keeping it in
 * its own list means `images` still means exactly what it always did.
 */
export type ApiVideo = {
    url: string;
    /** `video/mp4` or `video/webm` — established from the file's own bytes. */
    mimeType: string;
    alt: string | null;
};
export type ApiOptionValue = {
    id: string;
    /** What the buyer sees on the picker — "39", "შავი". */
    label: string;
    /** `#rrggbb` swatch, or null when the option is not a colour. */
    color: string | null;
};
/** One axis the product varies along, with the choices it offers. */
export type ApiProductOption = {
    id: string;
    name: string;
    values: ApiOptionValue[];
};
export type ApiVariant = {
    id: string;
    /** The picked labels joined in option order — "39 / შავი". */
    name: string;
    sku: string | null;
    price: string;
    /**
     * The struck-through price for this combination, or null when it is not on
     * offer. Already resolved: the product's own old price is inherited when the
     * combination sets none, and it is dropped unless it really is above `price`.
     */
    compareAt: string | null;
    stock: number;
    /**
     * One value per option in `ApiProduct.options`. Match the buyer's picks
     * against these to find the variant they are about to order.
     */
    optionValueIds: string[];
    /** The swatch of whichever picked value carries one, or null. */
    color: string | null;
    /** Whether this exact combination can be ordered right now. */
    inStock: boolean;
    /** The variant's own main photo. Null means 'use the product's'. */
    featuredImage: ApiImage | null;
    /** The variant's own photos, featured one first. Empty when it has none. */
    images: ApiImage[];
};
export type ApiProduct = {
    id: string;
    slug: string;
    name: LocalizedText;
    description: LocalizedText;
    price: string;
    compareAt: string | null;
    sku: string | null;
    stock: number;
    trackStock: boolean;
    inStock: boolean;
    categories: {
        id: string;
        slug: string;
        name: LocalizedText;
    }[];
    /**
     * The main photo — the first entry of `images`, surfaced on its own so a
     * storefront listing does not have to know that convention. Null when the
     * product has no image at all.
     */
    featuredImage: ApiImage | null;
    /** Every image, featured one first. The gallery is the rest. */
    images: ApiImage[];
    /** Empty for a product with no video attached. */
    videos: ApiVideo[];
    /**
     * The axes to draw pickers for. Absent unless the store has the `variants`
     * feature switched on; empty when the product does not vary.
     */
    options?: ApiProductOption[];
    /** Absent unless the store has the `variants` feature switched on. */
    variants?: ApiVariant[];
};
export type ApiCategory = {
    id: string;
    slug: string;
    name: LocalizedText;
    productCount: number;
    children: ApiCategory[];
};
export type ApiStore = {
    name: string;
    slug: string;
    currency: string;
    locales: string[];
    features: Record<string, boolean>;
    payments: {
        enabled: string[];
    };
    shipping: {
        flatRate: number;
        freeAbove?: number;
        zones: {
            id: string;
            name: string;
            rate: number;
            freeAbove?: number;
        }[];
    };
    contact: {
        phone?: string;
        email?: string;
        address?: string;
    };
};
export type ApiOrderItem = {
    productId: string;
    variantId: string | null;
    name: string;
    price: string;
    quantity: number;
};
export type ApiOrder = {
    id: string;
    number: number;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    subtotal: string;
    shipping: string;
    total: string;
    currency: string;
    items: ApiOrderItem[];
    createdAt: string;
};
//# sourceMappingURL=types.d.ts.map
import { z } from "zod";
import defaults from "./defaults.json";
export const HOMEPAGE_KEY = "storefront-homepage:v1";
export function safeStorefrontLink(value: string) {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\s\u0000-\u001f]/.test(value)
  )
    return false;
  try {
    return (
      new URL(value, "https://rustic-halo.invalid").origin ===
      "https://rustic-halo.invalid"
    );
  } catch {
    return false;
  }
}
export function safeEditorialImage(value: string) {
  if (
    /^\/(brand|static)\/[A-Za-z0-9_./%-]+$/.test(value) &&
    !value.includes("..")
  )
    return true;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (url.protocol === "https:" && url.hostname === "cdn.rustichalo.com")
      return true;
    return (
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.pathname.startsWith("/static/")
    );
  } catch {
    return false;
  }
}
const short = z.string().trim().max(100);
const image = z
  .string()
  .trim()
  .max(2000)
  .refine(
    safeEditorialImage,
    "Upload an image to this store or use an existing Rustic Halo image.",
  );
const optionalImage = z.union([z.literal(""), image]);
const link = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    safeStorefrontLink,
    "Use a storefront path such as /collections/fall. External links and scripts are not allowed.",
  );
const copy = {
  enabled: z.boolean(),
  showText: z.boolean(),
  eyebrow: short,
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(600),
  href: link,
  action: z.string().trim().min(1).max(80),
  imageFit: z.enum(["cover", "contain"]),
};
export const homepageSchema = z
  .object({
    version: z.literal(1),
    hero: z
      .object({
        ...copy,
        textBoxOpacity: z.number().int().min(0).max(100).default(93),
        textBoxSize: z
          .enum(["compact", "standard", "wide"])
          .default("standard"),
        desktopImage: image,
        mobileImage: image,
        imageAlt: z.string().trim().min(1).max(300),
      })
      .strict(),
    explore: z
      .object({
        enabled: z.boolean(),
        showHeading: z.boolean(),
        heading: z.string().trim().min(1).max(100),
        items: z
          .array(
            z
              .object({
                ...copy,
                id: z.string().regex(/^[a-z0-9-]{1,60}$/),
                image,
                mobileImage: optionalImage,
                alt: z.string().trim().min(1).max(300),
              })
              .strict(),
          )
          .min(1)
          .max(6)
          .refine(
            (items) =>
              new Set(items.map((item) => item.id)).size === items.length,
            "Collection sections need unique IDs.",
          ),
      })
      .strict(),
    seo: z
      .object({
        title: z.string().trim().min(1).max(100),
        description: z.string().trim().min(1).max(320),
      })
      .strict(),
  })
  .strict();
export type HomepageContent = z.infer<typeof homepageSchema>;
export const defaultHomepage = homepageSchema.parse(defaults);

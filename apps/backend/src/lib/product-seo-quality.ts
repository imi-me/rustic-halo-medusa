import { Modules } from "@medusajs/framework/utils";
import {
  productSeoValues,
  readProductSeo,
  seoText,
  shortSeoText,
  type ProductSeo,
} from "./product-seo-values";
import type { SeoOptionFacts } from "./product-seo-options";
export type SeoDescription = { id: string; description: string };
export type SeoCopyFacts = {
  id: string;
  title: string;
  description: string;
  material: string;
  options?: SeoOptionFacts;
  brief?: string;
  preservedDescription?: string;
};
export const descriptionFingerprint = (value: string) =>
  seoText(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
const generic = new Set(
  "a an and the with for from by of in on at our your to is are rustic halo hair claw claws clip clips earrings earring dangle dangles stud studs coaster coasters wood wooden round sign signs door hanger hangers novelty collection decor simple design designs welcome hello hi".split(
    " ",
  ),
);
const dimensions = (value: string) =>
  [
    ...value
      .replace(/\btwo\b/gi, "2")
      .replace(/\bfour\b/gi, "4")
      .matchAll(
        /\b(\d+(?:\.\d+)?)\s*(?:[-–]\s*)?(?:inches\b|inch\b|in\b|["“”″])/gi,
      ),
  ].map((m) => m[1]);
export function seoQualityIssue(
  product: SeoCopyFacts,
  copy: ProductSeo,
  others: SeoDescription[],
  identity = true,
): string | null {
  const text = `${copy.title}. ${copy.description}`,
    options = product.options;
  if (/<\/?[a-z][^>]*>/i.test(text)) return "Use plain text, not HTML.";
  if (
    /\b(?:product description|noted in|details provided|not specified|placeholder|insert here)\b/i.test(
      copy.description,
    )
  )
    return "Write customer-facing product copy, not editorial notes.";
  if (
    /\b(?:available|comes? in|choose (?:from|between)|in stock|ships? (?:in|today)|every colou?r|all (?:sizes|colou?rs|finishes))\b/i.test(
      text,
    )
  )
    return "Describe confirmed product details without availability, stock or all-option promises.";
  if (options?.hairClaw || options?.sizes.length) {
    for (const size of dimensions(text))
      if (!options?.verified || !options.sizes.includes(size))
        return `Only confirmed sizes may be mentioned: ${options?.sizes.join(", ") || "none confirmed"}.`;
  }
  if (
    options?.hairClaw &&
    options.verified &&
    options.finishes.length &&
    !options.finishes.some((v) => /paint|colors by cate|cbc/i.test(v)) &&
    /hand[ -]?painted|painted finish|colors by cate/i.test(text)
  )
    return "A painted finish is not enabled for this product.";
  if (options?.verified && options.finishes.length) {
    for (const clause of text.split(/[.!?;]/)) {
      const sizes = dimensions(clause),
        finish = /colors by cate|painted finish/i.test(clause)
          ? "Colors by Cate"
          : /natural finish/i.test(clause)
            ? "Natural"
            : null;
      if (
        finish &&
        sizes.length &&
        sizes.some(
          (size) =>
            !options.combinations.some(
              (c) =>
                Object.values(c.choices).some((v) =>
                  dimensions(v).includes(size),
                ) &&
                Object.values(c.choices).some(
                  (v) => v.toLowerCase() === finish.toLowerCase(),
                ),
            ),
        )
      )
        return "That size and finish are not offered together.";
    }
  }
  const fingerprint = descriptionFingerprint(copy.description);
  if (
    others.some(
      (other) =>
        other.id !== product.id &&
        descriptionFingerprint(other.description) === fingerprint,
    )
  )
    return "The description repeats another product. Use this product’s specific name and distinguishing details.";
  const tokens = descriptionFingerprint(product.title)
      .split(" ")
      .filter((t) => t.length > 1 && !generic.has(t)),
    body = new Set(descriptionFingerprint(copy.description).split(" "));
  if (identity && tokens.length && !tokens.some((t) => body.has(t)))
    return "Include a distinguishing detail or name from this particular product.";
  return null;
}
export function conservativeSeoCopy(product: SeoCopyFacts): ProductSeo {
  const options = product.options;
  let name = seoText(product.title) || "Rustic Halo product";
  if (options?.hairClaw)
    name = name
      .replace(
        /\b(2|4|two|four)\s*[-–]?\s*(?:inches\b|inch\b|in\b|["“”″])/gi,
        (match, size) =>
          options.verified &&
          options.sizes.includes(
            size === "two" ? "2" : size === "four" ? "4" : size,
          )
            ? match
            : "",
      )
      .replace(/\s+/g, " ")
      .trim();
  const source = seoText(product.description + " " + product.material),
    facts: string[] = [];
  if (/baltic birch/i.test(source)) facts.push("Baltic birch wood");
  else if (/\bwalnut\b/i.test(source)) facts.push("walnut wood");
  else if (/\bwood(?:en)?\b/i.test(source)) facts.push("wood detail");
  if (/laser[ -]engraved/i.test(source)) facts.push("laser-engraved detail");
  if (/stainless[ -]steel/i.test(source)) facts.push("stainless steel details");
  if (
    /hand[ -]painted/i.test(source) &&
    !(
      options?.hairClaw &&
      options.finishes.length &&
      !options.finishes.some((f) => /paint|colors by cate|cbc/i.test(f))
    )
  )
    facts.push("hand-painted accents");
  const prefix =
    options?.hairClaw && options.verified && options.sizes.length === 1
      ? ` A ${options.sizes[0]}-inch design`
      : " A distinctive design";
  return {
    title: productSeoValues({ title: name }).title,
    description: shortSeoText(
      `${name} from Rustic Halo.${prefix}${facts.length ? " featuring " + facts.slice(0, 2).join(" and ") : " for everyday styling or display"}.`,
      320,
    ),
  };
}
export async function savedSeoDescriptions(
  scope: any,
): Promise<SeoDescription[]> {
  const result: SeoDescription[] = [];
  let offset = 0;
  while (true) {
    const [rows, count] = await scope
      .resolve(Modules.PRODUCT)
      .listAndCountProducts(
        {},
        { select: ["id", "metadata"], take: 100, skip: offset },
      );
    for (const row of rows) {
      const description = readProductSeo(row.metadata).description;
      if (description.trim()) result.push({ id: row.id, description });
    }
    offset += rows.length;
    if (offset >= count) return result;
    if (!rows.length || offset >= 10000)
      throw Error(
        "The catalog is too large to complete the description check safely.",
      );
  }
}

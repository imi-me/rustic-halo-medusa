import { Modules } from "@medusajs/framework/utils";
import {
  productSeoValues,
  readProductSeo,
  seoText,
  shortSeoText,
  type ProductSeo,
} from "./product-seo-values";
import type { SeoOptionFacts } from "./product-seo-options";
export type SeoDescription = {
  id: string;
  description: string;
  title?: string;
};
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
// Catch name-swapped boilerplate without treating a shared material or short
// product phrase as a duplicate. Longer copy must share most three-word phrases.
function repeatsDescriptionTemplate(left: string, right: string): boolean {
  const phrases = (value: string) => {
    const words = value.split(" ");
    return words.length < 14
      ? new Set<string>()
      : new Set(words.slice(2).map((_, i) => words.slice(i, i + 3).join(" ")));
  };
  const a = phrases(left),
    b = phrases(right);
  if (!a.size || !b.size) return false;
  const shared = [...a].filter((phrase) => b.has(phrase)).length;
  if (shared >= 8 && shared / Math.max(a.size, b.size) >= 0.8) return true;
  // A repeated material-led opening plus mostly shared phrasing can still sound
  // templated after a few verbs or connecting words have been changed.
  if (
    left.split(" ").slice(0, 4).join(" ") !==
    right.split(" ").slice(0, 4).join(" ")
  )
    return false;
  const pairs = (value: string) => {
    const words = value.split(" ");
    return new Set(
      words.slice(1).map((_, i) => words.slice(i, i + 2).join(" ")),
    );
  };
  const x = pairs(left),
    y = pairs(right),
    common = [...x].filter((phrase) => y.has(phrase)).length;
  return common >= 8 && common / Math.max(x.size, y.size) >= 0.6;
}
function onlySmallWordChanges(left: string, right: string): boolean {
  const a = left.split(" "),
    b = right.split(" ");
  if (Math.min(a.length, b.length) < 6) return false;
  const limit = Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.2));
  if (Math.abs(a.length - b.length) > limit) return false;
  let row = b.map((_, i) => i + 1);
  row.unshift(0);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(
        Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)),
      );
    row = next;
  }
  return row[b.length] <= limit;
}
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
  if (/^protects\b[^.!?]*,\s*(?:laser[ -])?engraved\b/i.test(copy.description))
    return "Give the sentence a clear subject. Start with the product name or a direct invitation such as Protect your table with [product], laser engraved on [confirmed material]. Do not write Protects tables, engraved ... in the product.";
  if (
    /\bprotect(?:s)?\b[^.!?]{0,65}\bwith (?:laser[ -])?engraving\b/i.test(
      copy.description,
    )
  )
    return "Separate the stated use from the decoration: the coaster protects the table, not its laser engraving. Describe the engraving as a product detail.";
  const bodyWithoutName = descriptionFingerprint(copy.description)
    .replaceAll(descriptionFingerprint(product.title), " ")
    .replace(/\brustic halo\b/g, " ");
  if ((bodyWithoutName.match(/\brustic\b/g) || []).length > 1)
    return "Do not repeat rustic as a sales adjective. State the product's concrete details in plain language.";
  if (
    /\badds? (?:a |an |some )?rustic (?:accent|touch|charm)\b|\brustic halo (?:gives|adds|brings|makes it for)\b|\b(?:tied to|associated with) (?:the |its )?[^.!?]*\bname\b/i.test(
      copy.description,
    )
  )
    return "Remove the generic sales ending or awkward brand/name explanation. Write a direct sentence about this product; omit seller-brand padding.";
  if (
    /\b(?:gives?|define[sd]?)\b[^.!?]{0,100}\b(?:look|character|finish)\b|\b(?:themed|inspired)[ -]finish\b/i.test(
      copy.description,
    )
  )
    return "Use a concrete product detail or stated use, not an abstract look/character claim. A design theme is not a verified surface finish.";
  if (
    /base colou?r option|verified[_ ]options?|enabled[_ ]variants?|option_id|variant_id/i.test(
      copy.description,
    )
  )
    return "Use natural product copy, not internal option labels.";
  if (
    options?.options.some(
      (option) =>
        option.values.length >= 4 &&
        option.values.filter((value) => {
          const phrase = descriptionFingerprint(value);
          return (
            phrase &&
            ` ${descriptionFingerprint(copy.description)} `.includes(
              ` ${phrase} `,
            )
          );
        }).length >= 4,
    )
  )
    return "Do not enumerate an option palette. Focus on the specific design and at most a few useful details.";
  if (/<\/?[a-z][^>]*>/i.test(text)) return "Use plain text, not HTML.";
  if (
    /\b(?:product description|noted in|details provided|not specified|placeholder|insert here|(?:is|as) described|with (?:an?|the) [^.!?]{1,60} name|distinctive design)\b/i.test(
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
  const withoutName = (description: string, title?: string) => {
    const name = descriptionFingerprint(title || "");
    return name
      ? descriptionFingerprint(description).replaceAll(name, "[product]")
      : descriptionFingerprint(description);
  };
  const masked = withoutName(copy.description, product.title);
  const nameSwap = others.find(
    (other) =>
      other.id !== product.id &&
      other.title &&
      masked.includes("[product]") &&
      onlySmallWordChanges(withoutName(other.description, other.title), masked),
  );
  if (nameSwap)
    return `This is the same sentence with only the product name or a few words changed. Use a different natural sentence structure based on supported facts. Avoid this wording: ${nameSwap.description.slice(0, 320)}`;
  if (
    others.some(
      (other) =>
        other.id !== product.id &&
        descriptionFingerprint(other.description) === fingerprint,
    )
  )
    return `The description repeats another product. Use a different sentence based on this product’s supported details. Avoid this wording: ${others.find((other) => other.id !== product.id && descriptionFingerprint(other.description) === fingerprint)!.description.slice(0, 320)}`;
  const repeatedTemplate = others.find(
    (other) =>
      other.id !== product.id &&
      repeatsDescriptionTemplate(
        fingerprint,
        descriptionFingerprint(other.description),
      ),
  );
  if (repeatedTemplate)
    return `The wording closely repeats another product; changing only its name is not enough. Rewrite the sentence structure and emphasize supported details differently. Avoid this wording: ${repeatedTemplate.description.slice(0, 320)}`;
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
  const size =
    options?.hairClaw &&
    options.verified &&
    options.sizes.length === 1 &&
    !dimensions(name).includes(options.sizes[0])
      ? `${options.sizes[0]}-inch `
      : "";
  const detail =
    facts.includes("laser-engraved detail") && /\bwood(?:en)?\b/i.test(source)
      ? `laser engraved on ${/natural wood/i.test(source) ? "natural wood" : facts[0] === "wood detail" ? "wood" : facts[0]}`
      : facts.length
        ? `with ${facts.slice(0, 2).join(" and ")}`
        : "";
  return {
    title: productSeoValues({ title: name }).title,
    description: shortSeoText(
      `${size}${name}${detail ? ", " + detail : ""}.`,
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
        { select: ["id", "title", "metadata"], take: 100, skip: offset },
      );
    for (const row of rows) {
      const description = readProductSeo(row.metadata).description;
      if (description.trim())
        result.push({ id: row.id, title: row.title, description });
    }
    offset += rows.length;
    if (offset >= count) return result;
    if (!rows.length || offset >= 10000)
      throw Error(
        "The catalog is too large to complete the description check safely.",
      );
  }
}

import { createHash } from "node:crypto";
import { Modules } from "@medusajs/framework/utils";
import { activeOfferVariantIds } from "./hair-claw-offers";
import {
  clawColorAvailable,
  variantClawColor,
  variantClawSize,
  type ClawColor,
} from "./hair-claw-colors";
import {
  orderChoiceColors,
  orderChoiceVariant,
} from "./hair-claw-order-choices";
import { seoText } from "./product-seo-values";

export type SeoOptionFacts = {
  source: "saved_variants" | "draft_variants" | "unknown";
  verified: boolean;
  hairClaw: boolean;
  sizes: string[];
  finishes: string[];
  options: Array<{ name: string; values: string[] }>;
  combinations: Array<{
    choices: Record<string, string>;
    colors?: { name: string; values: string[] };
  }>;
};
const unique = (values: string[]) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));
export function seoOptionFacts(
  product: any,
  palette: ClawColor[],
  source: SeoOptionFacts["source"] = "saved_variants",
): SeoOptionFacts {
  const config = product.metadata?.hair_claw_template_v2;
  const hairClaw =
    Boolean(config) ||
    /hair\s*(?:claw|clip)|claw\s*clip/i.test(product.title ?? "");
  const unknown = (): SeoOptionFacts => ({
    source: "unknown",
    verified: false,
    hairClaw,
    sizes: [],
    finishes: [],
    options: [],
    combinations: [],
  });
  if (!Array.isArray(product.variants) || !Array.isArray(product.options))
    return unknown();
  if (
    config &&
    (config.version !== 2 ||
      !Array.isArray(config.variant_ids) ||
      !Array.isArray(config.option_ids))
  )
    return unknown();
  const names = new Map<string, string>(
    (product.options ?? []).map((o: any) => [
      o.id,
      seoText(o.title).slice(0, 60),
    ]),
  );
  if (config)
    for (const id of config.option_ids)
      names.set(
        id,
        id === config.size_option_id
          ? "Size"
          : id === config.color_option_id
            ? "Color"
            : id === config.finish_option_id
              ? "Finish"
              : config.option_titles?.[id] || names.get(id) || "Style",
      );
  const exposed = config ? activeOfferVariantIds(product.metadata) : null;
  const colorId =
    config?.color_option_id ||
    product.options.find((o: any) => /colou?r/i.test(o.title))?.id;
  const groups = new Map<string, SeoOptionFacts["combinations"][number]>(),
    values = new Map<string, string[]>(),
    sizes: string[] = [],
    finishes: string[] = [];
  for (const original of product.variants) {
    if (original.deleted_at || (config && !exposed?.has(original.id))) continue;
    if (config?.color_mode === "order" && !config.order_choices?.[original.id])
      continue;
    const variant =
      config?.color_mode === "order"
        ? orderChoiceVariant(product, original)
        : original;
    const colors =
      config?.color_mode === "order"
        ? orderChoiceColors(product, variant, palette).map((c) => c.name)
        : [];
    if (
      config &&
      (config.color_mode === "order"
        ? !colors.length
        : !variantClawColor(product, variant) ||
          !clawColorAvailable(product, variant, palette))
    )
      continue;
    const choices: Record<string, string> = {};
    let colorValues = colors;
    for (const option of variant.options ?? []) {
      if (config && !config.option_ids.includes(option.option_id)) continue;
      const name = names.get(option.option_id),
        value = seoText(option.value).slice(0, 120);
      if (!name || !value || /^(?:default title|standard)$/i.test(value))
        continue;
      if (option.option_id === colorId) {
        if (!colors.length) colorValues = [value];
        continue;
      }
      choices[name] = value;
    }
    if (Object.keys(choices).length > 8) return unknown();
    if (config) {
      const size = variantClawSize(product, variant);
      if (size) {
        sizes.push(size);
        choices.Size = `${size} inch`;
      }
      const finish = variant.metadata?.claw_finish;
      if (finish)
        choices.Finish =
          finish === "cbc"
            ? "Colors by Cate"
            : finish === "natural"
              ? "Natural"
              : finish;
    } else
      for (const [name, value] of Object.entries(choices))
        if (/size|length/i.test(name)) {
          const match = value.match(
            /\b(\d+(?:\.\d+)?)\s*(?:inches|inch|in\b|["“”″])/i,
          );
          if (match) sizes.push(match[1]);
        }
    for (const [name, value] of Object.entries(choices)) {
      values.set(name, [...(values.get(name) || []), value]);
      if (/finish/i.test(name)) finishes.push(value);
    }
    const finish = variant.metadata?.claw_finish;
    if (config && finish)
      finishes.push(
        finish === "cbc"
          ? "Colors by Cate"
          : finish === "natural"
            ? "Natural"
            : finish,
      );
    const key = JSON.stringify(
        Object.entries(choices).sort(([a], [b]) => a.localeCompare(b)),
      ),
      group = groups.get(key) || {
        choices: Object.fromEntries(
          Object.entries(choices).sort(([a], [b]) => a.localeCompare(b)),
        ),
      };
    if (colorValues.length) {
      const name = names.get(colorId) || "Color";
      values.set(name, [...(values.get(name) || []), ...colorValues]);
      group.colors = {
        name,
        values: unique([...(group.colors?.values || []), ...colorValues]),
      };
    }
    groups.set(key, group);
    if (groups.size > 50) return unknown();
  }
  return {
    source,
    verified: true,
    hairClaw,
    sizes: unique(sizes),
    finishes: unique(finishes),
    options: [...values]
      .map(([name, entries]) => ({ name, values: unique(entries) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    combinations: [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value),
  };
}
export function draftSeoOptionFacts(
  title: string,
  variants: Array<Record<string, string>> = [],
): SeoOptionFacts {
  const names = unique(variants.flatMap((v) => Object.keys(v))),
    options = names.map((title, index) => ({ id: `draft_${index}`, title }));
  const facts = seoOptionFacts(
    {
      title,
      options,
      variants: variants.map((row, index) => ({
        id: `draft_variant_${index}`,
        options: options
          .filter((o) => row[o.title])
          .map((o) => ({ option_id: o.id, value: row[o.title] })),
      })),
    },
    [],
    variants.length ? "draft_variants" : "unknown",
  );
  return variants.length ? facts : { ...facts, verified: false };
}
export const seoOptionsRevision = (facts: SeoOptionFacts) =>
  createHash("sha256").update(JSON.stringify(facts)).digest("hex");
export async function readSeoProducts(scope: any, ids: string[]) {
  if (!ids.length) return [];
  return scope
    .resolve(Modules.PRODUCT)
    .listProducts(
      { id: ids },
      {
        relations: [
          "options",
          "options.values",
          "variants",
          "variants.options",
        ],
        take: ids.length,
      },
    );
}

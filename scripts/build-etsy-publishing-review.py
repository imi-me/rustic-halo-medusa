#!/usr/bin/env python3
"""Classify Medusa-only variants without performing Etsy or Medusa writes."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


def classify(report: dict) -> dict:
    comparison = report.get("comparison") or {}
    if comparison.get("readOnly") is not True:
        raise ValueError("Comparison must be read-only")
    if comparison.get("unresolved"):
        raise ValueError("Resolve unmatched Etsy variants before reviewing publication candidates")
    medusa_only = comparison.get("medusaOnly")
    matches = comparison.get("matches")
    if not isinstance(medusa_only, list) or not isinstance(matches, list):
        raise ValueError("Invalid comparison shape")
    expected = comparison.get("counts", {}).get("medusaOnlyVariants")
    if expected != len(medusa_only):
        raise ValueError("Medusa-only count does not match the rows")

    etsy_product_ids = {row["medusa"]["productId"] for row in matches}
    grouped: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for row in medusa_only:
        key = (row["productId"], row["productTitle"], row["productStatus"])
        grouped[key].append(row)

    products = []
    for (product_id, title, status), rows in grouped.items():
        if status != "published":
            relationship = "medusa_draft_or_unpublished"
            action = "exclude_from_etsy"
            reason = "The Medusa product is not published."
        elif product_id in etsy_product_ids:
            relationship = "etsy_product_has_other_matching_variants"
            action = "keep_current_etsy_scope"
            reason = "This product is already represented on Etsy; these sibling variants are intentionally deferred."
        else:
            relationship = "product_not_currently_on_etsy"
            action = "defer_until_owner_selects_product"
            reason = "No active Etsy variant currently maps to this Medusa product."
        products.append({
            "medusaProductId": product_id,
            "title": title,
            "medusaStatus": status,
            "relationship": relationship,
            "recommendedAction": action,
            "reason": reason,
            "variantCount": len(rows),
            "skus": sorted(row["sku"] for row in rows),
        })
    products.sort(key=lambda row: (row["recommendedAction"], row["title"].casefold(), row["medusaProductId"]))

    variant_counts = Counter()
    product_counts = Counter()
    for row in products:
        product_counts[row["recommendedAction"]] += 1
        variant_counts[row["recommendedAction"]] += row["variantCount"]
    return {
        "readOnly": True,
        "inventorySynchronizationEnabled": False,
        "publishingEnabled": False,
        "policy": "Match the current active Etsy catalog; defer every Medusa-only variant until the owner selects a product.",
        "sourceCounts": comparison.get("counts", {}),
        "summary": {
            "products": len(products),
            "variants": sum(row["variantCount"] for row in products),
            "productCountsByAction": dict(sorted(product_counts.items())),
            "variantCountsByAction": dict(sorted(variant_counts.items())),
        },
        "products": products,
        "medusaVariantsWithoutSku": comparison.get("medusaWithoutSku", []),
    }


def render_markdown(review: dict, source: Path) -> str:
    summary = review["summary"]
    actions = summary["variantCountsByAction"]
    lines = [
        "# Medusa-only Etsy publishing review",
        "",
        f"Source: `{source}`",
        "",
        "This is a read-only review. It did not publish products, change inventory, or enable synchronization.",
        "The default policy is to keep Etsy matching its current active catalog.",
        "",
        "## Decision summary",
        "",
        f"- **{summary['variants']} Medusa-only variants across {summary['products']} products.**",
        f"- **{actions.get('keep_current_etsy_scope', 0)} variants:** sibling variants on products already represented on Etsy; keep the current Etsy selection.",
        f"- **{actions.get('defer_until_owner_selects_product', 0)} variants:** published Medusa products absent from active Etsy; defer until individually selected.",
        f"- **{actions.get('exclude_from_etsy', 0)} variants:** draft or unpublished Medusa products; exclude from Etsy.",
        f"- **{len(review['medusaVariantsWithoutSku'])} Medusa variants without SKUs:** excluded from all publishing review.",
        "",
        "## Products already represented on Etsy",
        "",
        "These extra sibling variants remain internal unless explicitly approved.",
        "",
        "| Product | Extra variants | Example SKUs |",
        "|---|---:|---|",
    ]
    existing = [row for row in review["products"] if row["recommendedAction"] == "keep_current_etsy_scope"]
    for row in sorted(existing, key=lambda item: (-item["variantCount"], item["title"].casefold())):
        examples = ", ".join(f"`{sku}`" for sku in row["skus"][:5])
        lines.append(f"| {row['title']} | {row['variantCount']} | {examples} |")
    lines += [
        "",
        "## Future review",
        "",
        "The full product-level list is in `medusa-only-etsy-review.csv`. Selecting a future product should create a new bounded preview and approval step; this report is not a publish queue.",
        "",
    ]
    return "\n".join(lines)


def write_outputs(review: dict, source: Path, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    review = {"generatedAt": datetime.now().astimezone().isoformat(), "source": str(source), **review}
    (output_dir / "medusa-only-etsy-review.json").write_text(json.dumps(review, indent=2) + "\n")
    (output_dir / "medusa-only-etsy-review.md").write_text(render_markdown(review, source))
    with (output_dir / "medusa-only-etsy-review.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "recommended_action", "relationship", "medusa_status", "product_title",
            "medusa_product_id", "variant_count", "skus",
        ])
        writer.writeheader()
        for row in review["products"]:
            writer.writerow({
                "recommended_action": row["recommendedAction"],
                "relationship": row["relationship"],
                "medusa_status": row["medusaStatus"],
                "product_title": row["title"],
                "medusa_product_id": row["medusaProductId"],
                "variant_count": row["variantCount"],
                "skus": " | ".join(row["skus"]),
            })


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path(".local/etsy-review/etsy-listing-audit-post-color.json"))
    parser.add_argument("--output-dir", type=Path, default=Path(".local/etsy-review"))
    args = parser.parse_args()
    report = json.loads(args.input.read_text())
    review = classify(report)
    write_outputs(review, args.input, args.output_dir)
    print(json.dumps(review["summary"], sort_keys=True))


if __name__ == "__main__":
    main()

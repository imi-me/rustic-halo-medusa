#!/usr/bin/env python3
"""Build a read-only opening-catalog readiness report from the staging Store API."""

from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def get_json(base_url: str, key: str, path: str, params: dict | None = None) -> dict:
    url = f"{base_url.rstrip('/')}/store/{path.lstrip('/')}"
    if params:
        url += "?" + urlencode(params)
    request = Request(url, headers={"x-publishable-api-key": key, "accept": "application/json"})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def has_price(variant: dict) -> bool:
    calculated = variant.get("calculated_price") or {}
    amount = calculated.get("calculated_amount")
    return isinstance(amount, (int, float)) and amount > 0


def product_type(product: dict) -> str:
    metadata = product.get("metadata") or {}
    type_record = product.get("type") or {}
    return str(metadata.get("source_product_type") or type_record.get("value") or "Uncategorized")


def audit_product(product: dict, shipping_catalog: dict) -> dict:
    variants = product.get("variants") or []
    reasons: list[str] = []
    skus = [str(variant.get("sku") or "").strip() for variant in variants]

    if not str(product.get("description") or "").strip():
        reasons.append("customer_copy_missing")
    if not product.get("thumbnail") and not product.get("images"):
        reasons.append("photo_missing")
    if not variants:
        reasons.append("variants_missing")
    if variants and any(not sku for sku in skus):
        reasons.append("sku_missing")
    if variants and any(not has_price(variant) for variant in variants):
        reasons.append("price_missing")
    if variants and any(sku not in shipping_catalog for sku in skus if sku):
        reasons.append("shipping_rule_missing")

    return {
        "id": product.get("id"),
        "title": product.get("title"),
        "handle": product.get("handle"),
        "productType": product_type(product),
        "variantCount": len(variants),
        "skus": skus,
        "ready": not reasons,
        "reasons": reasons,
    }


def render_markdown(report: dict) -> str:
    counts = report["counts"]
    lines = [
        "# Opening catalog readiness",
        "",
        f"Checked: {report['checkedAt']}",
        "",
        "This is a read-only snapshot of products currently visible through the staging Store API. No products, inventory, prices, publication state, Etsy listings, or Market Suite records were changed.",
        "",
        "## Result",
        "",
        f"- Storefront products checked: **{counts['storefrontProducts']}**",
        f"- Ready for owner selection: **{counts['readyProducts']}**",
        f"- Needs review before launch: **{counts['reviewProducts']}**",
        f"- Variants checked: **{counts['variants']}**",
        "",
        "A product is ready when it has customer-facing copy, a photo, at least one variant, a SKU and positive USD price for every variant, and an approved shipping rule for every SKU.",
        "",
        "## Ready products by type",
        "",
        "| Type | Products |",
        "| --- | ---: |",
    ]
    for name, count in report["readyByType"].items():
        lines.append(f"| {name.replace('|', '/')} | {count} |")

    lines += ["", "## Products needing review", ""]
    if not report["reviewProducts"]:
        lines.append("None.")
    else:
        lines += ["| Product | Reason |", "| --- | --- |"]
        for product in report["reviewProducts"]:
            reasons = ", ".join(reason.replace("_", " ") for reason in product["reasons"])
            lines.append(f"| {str(product['title']).replace('|', '/')} | {reasons} |")

    lines += [
        "",
        "## Selection step",
        "",
        "Choose a small opening set from the ready products. Selection is an owner decision; this report does not publish or unpublish anything.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", type=Path, required=True)
    parser.add_argument("--shipping-catalog", type=Path, required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:9000")
    parser.add_argument("--json-output", type=Path, default=Path("/tmp/opening-catalog-readiness.json"))
    parser.add_argument("--markdown-output", type=Path, default=Path("/tmp/opening-catalog-readiness.md"))
    args = parser.parse_args()

    env = read_env(args.env)
    key = env.get("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY")
    if not key:
        raise SystemExit("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is unavailable")
    shipping_catalog = json.loads(args.shipping_catalog.read_text())
    regions = get_json(args.base_url, key, "regions").get("regions") or []
    if not regions:
        raise SystemExit("No Store API region is available")
    region_id = regions[0]["id"]

    products: list[dict] = []
    offset = 0
    while True:
        page = get_json(
            args.base_url,
            key,
            "products",
            {
                "region_id": region_id,
                "limit": 100,
                "offset": offset,
                "fields": "+description,+metadata,+images.url,+variants.sku,+variants.calculated_price",
            },
        )
        batch = page.get("products") or []
        products.extend(batch)
        offset += len(batch)
        if not batch or offset >= int(page.get("count", offset)):
            break
        if offset > 10_000:
            raise SystemExit("Store API product limit exceeded")

    rows = [audit_product(product, shipping_catalog) for product in products]
    ready = [row for row in rows if row["ready"]]
    review = [row for row in rows if not row["ready"]]
    reason_counts = Counter(reason for row in review for reason in row["reasons"])
    ready_by_type = Counter(row["productType"] for row in ready)
    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "readOnly": True,
        "source": f"{args.base_url.rstrip('/')}/store/products",
        "criteria": [
            "customer_copy",
            "photo",
            "variant",
            "variant_sku",
            "positive_usd_price",
            "approved_shipping_rule",
        ],
        "counts": {
            "storefrontProducts": len(rows),
            "readyProducts": len(ready),
            "reviewProducts": len(review),
            "variants": sum(row["variantCount"] for row in rows),
        },
        "reviewReasonCounts": dict(sorted(reason_counts.items())),
        "readyByType": dict(sorted(ready_by_type.items(), key=lambda item: (-item[1], item[0]))),
        "readyProducts": ready,
        "reviewProducts": review,
    }
    args.json_output.write_text(json.dumps(report, indent=2) + "\n")
    args.markdown_output.write_text(render_markdown(report))
    print("OPENING_CATALOG_READINESS " + json.dumps(report["counts"], sort_keys=True))


if __name__ == "__main__":
    main()

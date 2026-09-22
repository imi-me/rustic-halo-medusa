#!/usr/bin/env python3
"""Validate the approved opening-catalog manifest against a read-only audit."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def validate(manifest: dict[str, Any], report: dict[str, Any]) -> dict[str, int]:
    if manifest.get("schemaVersion") != 1 or manifest.get("approved") is not True:
        raise ValueError("opening-catalog manifest is not approved schema version 1")
    safety = manifest.get("safety")
    if not isinstance(safety, dict) or any(
        safety.get(flag) is not False
        for flag in ("inventorySyncAuthorized", "etsyWritesAuthorized", "productionPublishAuthorized")
    ):
        raise ValueError("opening-catalog manifest must not authorize external writes")

    selected = manifest.get("products")
    ready = report.get("readyProducts")
    if not isinstance(selected, list) or not isinstance(ready, list):
        raise ValueError("manifest products and report readyProducts must be arrays")

    ready_by_handle = {}
    for product in ready:
        if not isinstance(product, dict) or not isinstance(product.get("handle"), str):
            raise ValueError("audit contains an invalid product")
        handle = product["handle"]
        if handle in ready_by_handle:
            raise ValueError(f"audit contains duplicate handle: {handle}")
        ready_by_handle[handle] = product

    seen_handles: set[str] = set()
    seen_skus: set[str] = set()
    variants = 0
    core = 0
    seasonal = 0
    for product in selected:
        if not isinstance(product, dict) or not isinstance(product.get("handle"), str):
            raise ValueError("manifest contains an invalid product")
        handle = product["handle"]
        if handle in seen_handles:
            raise ValueError(f"manifest contains duplicate handle: {handle}")
        seen_handles.add(handle)
        current = ready_by_handle.get(handle)
        if current is None or current.get("ready") is not True:
            raise ValueError(f"selected product is absent or no longer ready: {handle}")
        expected_skus = product.get("skus")
        current_skus = current.get("skus")
        if not isinstance(expected_skus, list) or expected_skus != current_skus:
            raise ValueError(f"SKU drift detected: {handle}")
        if len(expected_skus) != len(set(expected_skus)):
            raise ValueError(f"duplicate SKU within product: {handle}")
        duplicate_skus = seen_skus.intersection(expected_skus)
        if duplicate_skus:
            raise ValueError(f"SKU reused across selected products: {sorted(duplicate_skus)[0]}")
        seen_skus.update(expected_skus)
        if product.get("variantCount") != current.get("variantCount") or len(expected_skus) != product.get("variantCount"):
            raise ValueError(f"variant-count drift detected: {handle}")
        variants += product["variantCount"]
        if product.get("group") == "core":
            core += 1
        elif product.get("group") == "seasonal":
            seasonal += 1
        else:
            raise ValueError(f"invalid assortment group: {handle}")

    summary = {"products": len(selected), "variants": variants, "core": core, "seasonal": seasonal}
    if manifest.get("selection") != summary:
        raise ValueError("manifest selection totals do not match its products")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=Path("deploy/production/opening-catalog.json"))
    parser.add_argument("--report", type=Path, default=Path(".local/opening-catalog-readiness.json"))
    args = parser.parse_args()
    summary = validate(load_object(args.manifest), load_object(args.report))
    print("OPENING_CATALOG_VALID " + " ".join(f"{key}={value}" for key, value in summary.items()))


if __name__ == "__main__":
    main()

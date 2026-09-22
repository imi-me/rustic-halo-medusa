#!/usr/bin/env python3
import argparse
import json


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("plan")
    parser.add_argument("preflight")
    args = parser.parse_args()
    plan = load(args.plan)
    preflight = load(args.preflight)

    colors = plan["colors"]
    planned = [row for row in plan["listings"] if row["status"] == "planned"]
    preflight_by_id = {row["listingId"]: row for row in preflight["listings"]}
    assert len(colors) == 12
    assert len(planned) == 19
    assert len(preflight_by_id) == 19

    expected_suffixes = {
        "CREAM": "CREAM", "SKY BLUE": "SKY-BL", "OCEAN BLUE": "OCEAN-BL",
        "MINT": "MINT", "SAGE": "SAGE", "BLUSH": "BLUSH", "TAUPE": "TAUPE",
        "TERRACOTTA": "TERRACOTTA", "ESPRESSO": "ESPRESSO", "SLATE": "SLATE",
        "NAVY": "NAVY", "Black": "BLK",
    }
    assert {row["name"]: row["suffix"] for row in colors} == expected_suffixes

    all_child_skus = set()
    total = 0
    image_count = 0
    for listing in planned:
        listing_id = listing["listingId"]
        source = preflight_by_id[listing_id]
        source_products = source["inventory"]["products"]
        source_by_sku = {row["sku"]: row for row in source_products}
        assert len(source_by_sku) == len(source_products) == len(listing["baseProducts"])
        assert all(len(row["offerings"]) == 1 for row in source_products)
        assert all(row["offerings"][0]["price"]["divisor"] > 0 for row in source_products)
        assert all(row["offerings"][0]["quantity"] >= 0 for row in source_products)
        assert all(row["offerings"][0]["readiness_state_id"] for row in source_products)
        for field in (
            "price_on_property", "quantity_on_property", "readiness_state_on_property"
        ):
            values = source["inventory"].get(field, [])
            expanded = sorted(set(values + ([listing["colorPropertyId"]] if values else [])))
            if values:
                assert set(expanded) == set(values) | {listing["colorPropertyId"]}
            else:
                assert expanded == []

        for base in listing["baseProducts"]:
            assert base["baseSku"] in source_by_sku
            assert len(base["children"]) == len(colors)
            expected_children = {
                (name, f'{base["baseSku"]}-{suffix}')
                for name, suffix in expected_suffixes.items()
            }
            actual_children = {(row["color"], row["sku"]) for row in base["children"]}
            assert actual_children == expected_children
            for _, sku in actual_children:
                assert sku not in all_child_skus
                all_child_skus.add(sku)
            total += len(actual_children)

        images = source["variationImages"].get("results", [])
        assert all(row["property_id"] != listing["colorPropertyId"] for row in images)
        image_count += len(images)
        assert len(source_products) * len(colors) <= 400

    assert total == 372
    print(f"ETSY_HAIR_CLAW_BATCH_VALID 19 {total} {image_count}")


if __name__ == "__main__":
    main()

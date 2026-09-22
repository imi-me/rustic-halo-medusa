#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def offering(value):
    price = value["price"]
    return {
        "quantity": value["quantity"],
        "is_enabled": value["is_enabled"],
        "price": (price["amount"], price["divisor"], price["currency_code"]),
        "readiness_state_id": value["readiness_state_id"],
    }


def properties(values):
    return sorted(
        (row["property_id"], row["property_name"], tuple(row["values"]))
        for row in values
    )


def images(value):
    return sorted(
        (row["property_id"], row["value_id"], row["value"], row["image_id"])
        for row in value.get("results", [])
    )


def expanded(values, color_property):
    return sorted(set(values + ([color_property] if values else [])))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("plan")
    parser.add_argument("preflight")
    parser.add_argument("postflight")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    plan = load(args.plan)
    before = {row["listingId"]: row for row in load(args.preflight)["listings"]}
    after = {row["listingId"]: row for row in load(args.postflight)["listings"]}
    planned = [row for row in plan["listings"] if row["status"] == "planned"]
    assert set(before) == set(after) == {row["listingId"] for row in planned}

    total = 0
    image_count = 0
    rows = []
    for listing in planned:
        listing_id = listing["listingId"]
        old = before[listing_id]
        new = after[listing_id]
        old_products = {row["sku"]: row for row in old["inventory"]["products"]}
        new_products = {row["sku"]: row for row in new["inventory"]["products"]}
        expected_skus = {
            child["sku"]
            for base in listing["baseProducts"]
            for child in base["children"]
        }
        assert set(new_products) == expected_skus

        for base in listing["baseProducts"]:
            source = old_products[base["baseSku"]]
            assert len(source["offerings"]) == 1
            old_properties = properties(source["property_values"])
            for child in base["children"]:
                product = new_products[child["sku"]]
                assert len(product["offerings"]) == 1
                assert offering(product["offerings"][0]) == offering(source["offerings"][0])
                expected_properties = sorted(old_properties + [
                    (listing["colorPropertyId"], "Color", (child["color"],))
                ])
                assert properties(product["property_values"]) == expected_properties

        for field in ("price_on_property", "quantity_on_property", "readiness_state_on_property"):
            assert sorted(new["inventory"].get(field, [])) == expanded(
                old["inventory"].get(field, []), listing["colorPropertyId"]
            )
        assert sorted(new["inventory"].get("sku_on_property", [])) == sorted(set(
            old["inventory"].get("sku_on_property", []) + [listing["colorPropertyId"]]
        ))
        assert images(new["variationImages"]) == images(old["variationImages"])

        count = len(new_products)
        preserved_images = len(images(old["variationImages"]))
        total += count
        image_count += preserved_images
        rows.append({
            "listingId": listing_id,
            "productCount": count,
            "pricesPreserved": True,
            "quantitiesPreserved": True,
            "readinessPreserved": True,
            "variationImagesPreserved": preserved_images,
        })

    assert len(rows) == 19 and total == 372 and image_count == 22
    result = {
        "complete": True,
        "listings": rows,
        "listingCount": len(rows),
        "totalColorProducts": total,
        "variationImagesPreserved": image_count,
        "pricesPreserved": True,
        "quantitiesPreserved": True,
        "readinessPreserved": True,
        "inventorySynchronizationEnabled": False,
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("ETSY_HAIR_CLAW_POSTFLIGHT_VERIFIED 19 372 22")


if __name__ == "__main__":
    main()

import copy
import unittest

from validate_opening_catalog import validate


def fixtures():
    product = {
        "group": "core",
        "handle": "example",
        "variantCount": 1,
        "skus": ["EX-1"],
    }
    manifest = {
        "schemaVersion": 1,
        "approved": True,
        "safety": {
            "inventorySyncAuthorized": False,
            "etsyWritesAuthorized": False,
            "productionPublishAuthorized": False,
        },
        "selection": {"products": 1, "variants": 1, "core": 1, "seasonal": 0},
        "products": [product],
    }
    report = {"readyProducts": [{"handle": "example", "ready": True, "variantCount": 1, "skus": ["EX-1"]}]}
    return manifest, report


class OpeningCatalogValidationTests(unittest.TestCase):
    def test_accepts_exact_read_only_selection(self):
        manifest, report = fixtures()
        self.assertEqual(validate(manifest, report), manifest["selection"])

    def test_rejects_sku_drift(self):
        manifest, report = fixtures()
        report["readyProducts"][0]["skus"] = ["EX-2"]
        with self.assertRaisesRegex(ValueError, "SKU drift"):
            validate(manifest, report)

    def test_rejects_write_authorization(self):
        manifest, report = fixtures()
        manifest["safety"]["inventorySyncAuthorized"] = True
        with self.assertRaisesRegex(ValueError, "must not authorize external writes"):
            validate(manifest, report)

    def test_rejects_duplicate_selected_handles(self):
        manifest, report = fixtures()
        manifest["products"].append(copy.deepcopy(manifest["products"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate handle"):
            validate(manifest, report)


if __name__ == "__main__":
    unittest.main()

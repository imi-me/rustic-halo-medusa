import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("build-etsy-publishing-review.py")
SPEC = importlib.util.spec_from_file_location("publishing_review", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class PublishingReviewTest(unittest.TestCase):
    def test_classifies_every_medusa_only_variant_without_enabling_writes(self):
        report = {"comparison": {
            "readOnly": True,
            "counts": {"medusaOnlyVariants": 3},
            "unresolved": [],
            "matches": [{"medusa": {"productId": "represented"}}],
            "medusaOnly": [
                {"productId": "represented", "productTitle": "A", "productStatus": "published", "variantId": "v1", "sku": "A-2"},
                {"productId": "unlisted", "productTitle": "B", "productStatus": "published", "variantId": "v2", "sku": "B-1"},
                {"productId": "draft", "productTitle": "C", "productStatus": "draft", "variantId": "v3", "sku": "C-1"},
            ],
            "medusaWithoutSku": [],
        }}
        result = MODULE.classify(report)
        self.assertFalse(result["publishingEnabled"])
        self.assertFalse(result["inventorySynchronizationEnabled"])
        self.assertEqual(result["summary"]["variants"], 3)
        self.assertEqual(set(result["summary"]["variantCountsByAction"].values()), {1})

    def test_refuses_an_unresolved_or_writable_comparison(self):
        base = {"comparison": {"readOnly": False, "counts": {"medusaOnlyVariants": 0}, "unresolved": [], "matches": [], "medusaOnly": []}}
        with self.assertRaisesRegex(ValueError, "read-only"):
            MODULE.classify(base)
        base["comparison"]["readOnly"] = True
        base["comparison"]["unresolved"] = [{"reason": "missing"}]
        with self.assertRaisesRegex(ValueError, "Resolve"):
            MODULE.classify(base)


if __name__ == "__main__":
    unittest.main()

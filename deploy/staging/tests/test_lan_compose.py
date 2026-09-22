import copy
import importlib.util
from pathlib import Path
import unittest


HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location(
    "validate_lan_compose", HERE.parent / "validate-lan-compose.py"
)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


def config():
    return {
        "services": {
            "storefront": {
                "ports": [
                    {"host_ip": "127.0.0.1", "published": 18000, "target": 8000},
                    {"host_ip": "10.20.69.159", "published": 18000, "target": 8000},
                ]
            },
            "backend": {
                "ports": [
                    {"host_ip": "127.0.0.1", "published": 19000, "target": 9000}
                ]
            },
            "postgres": {},
            "redis": {},
        }
    }


class LanComposeTests(unittest.TestCase):
    def test_expected_exposure_is_accepted(self):
        validator.validate(config(), "10.20.69.159")

    def test_missing_storefront_binding_is_rejected(self):
        value = config()
        value["services"]["storefront"]["ports"].pop()
        with self.assertRaisesRegex(ValueError, "LAN storefront"):
            validator.validate(value, "10.20.69.159")

    def test_backend_lan_binding_is_rejected(self):
        value = config()
        value["services"]["backend"]["ports"][0]["host_ip"] = "10.20.69.159"
        with self.assertRaisesRegex(ValueError, "backend"):
            validator.validate(value, "10.20.69.159")

    def test_database_and_redis_lan_bindings_are_rejected(self):
        for service in ("postgres", "redis"):
            with self.subTest(service=service):
                value = copy.deepcopy(config())
                value["services"][service]["ports"] = [
                    {"host_ip": "0.0.0.0", "published": 5432, "target": 5432}
                ]
                with self.assertRaisesRegex(ValueError, service):
                    validator.validate(value, "10.20.69.159")


if __name__ == "__main__":
    unittest.main()

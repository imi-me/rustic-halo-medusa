"""Synthetic weights test arithmetic only, not business product weights."""
import unittest
from shipping_parcels import build_parcels, pack_counts

class PackingTests(unittest.TestCase):
    def test_confirmed_catalog_mixed_box(self):
        import json
        from pathlib import Path
        mapping = json.loads((Path(__file__).resolve().parents[1] / 'apps/backend/src/lib/shipping-catalog.json').read_text())
        items = [{**mapping['38462-2'], 'quantity': 2}, {**mapping['38425'], 'quantity': 4}]
        parcels = build_parcels(items)
        self.assertEqual(len(parcels), 1)
        self.assertEqual(parcels[0]['weight'], '5.600')
        self.assertEqual((parcels[0]['length'], parcels[0]['width'], parcels[0]['height']), ('6', '4', '3'))

    def item(self, kind='hair-claw-box', quantity=1, weight=2):
        return {'package_id': kind, 'quantity': quantity, 'weight_oz': weight}

    def test_capacity_and_packaging_added_once_per_box(self):
        self.assertEqual([p['weight'] for p in build_parcels([self.item(quantity=3)])], ['7.600'])
        self.assertEqual([p['weight'] for p in build_parcels([self.item(quantity=4)])], ['7.600', '3.600'])

    def test_same_category_different_item_weights(self):
        self.assertEqual(build_parcels([self.item(weight=2), self.item(weight=1)])[0]['weight'], '4.600')

    def test_earring_capacity(self):
        self.assertEqual([p['weight'] for p in build_parcels([self.item('earring-box', 9, '.5')])], ['5.600', '2.100'])

    def test_one_sign_per_box(self):
        parcels = build_parcels([self.item('14-inch-sign-box', 2, 10)])
        self.assertEqual(len(parcels), 2)
        self.assertTrue(all(p['weight'] == '17.000' and p['length'] == '14' for p in parcels))

    def test_missing_or_unknown_packages_rejected(self):
        for items in [[], [self.item('coasters')]]:
            with self.assertRaises(ValueError): build_parcels(items)

    def test_confirmed_mixed_limits(self):
        for c, e in [(3, 0), (2, 4), (1, 6), (0, 8)]:
            self.assertEqual(len(pack_counts(c, e)), 1)
        self.assertEqual(len(pack_counts(3, 2)), 2)
        parcels = build_parcels([self.item(quantity=2, weight=1), self.item('earring-box', 4, '.5')])
        self.assertEqual(len(parcels), 1)
        self.assertEqual(parcels[0]['weight'], '5.600')
        self.assertEqual(parcels[0]['height'], '3')

    def test_every_item_packed_within_confirmed_limits(self):
        for c in range(9):
            for e in range(17):
                plan = pack_counts(c, e)
                self.assertEqual(sum(x for x, _ in plan), c)
                self.assertEqual(sum(y for _, y in plan), e)
                for x, y in plan:
                    self.assertTrue(any(x <= mc and y <= me for mc, me in [(3, 0), (2, 4), (1, 6), (0, 8)]))

    def test_sign_is_separate_from_accessories(self):
        parcels = build_parcels([self.item(weight=1), self.item('14-inch-sign-box', 1, 40)])
        self.assertEqual([p['weight'] for p in parcels], ['2.600', '47.000'])

    def test_bad_weights_and_quantities_rejected(self):
        for weight in [None, 0, -1, 'NaN', 'Infinity', 'unknown']:
            with self.assertRaises(ValueError): build_parcels([self.item(weight=weight)])
        for quantity in [0, -1, 1.5, True, 101]:
            with self.assertRaises(ValueError): build_parcels([self.item(quantity=quantity)])

if __name__ == '__main__': unittest.main()

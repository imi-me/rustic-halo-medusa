"""Build parcels from verified item weights. Does not purchase labels or enable rates."""
from decimal import Decimal, ROUND_CEILING
import json
from pathlib import Path

PACKAGE_FILE = Path(__file__).resolve().parents[1] / 'apps/backend/src/scripts/data/shipping-packages.json'


def pack_counts(claws, earrings):
    """Minimize box count using only owner-confirmed combinations."""
    from functools import lru_cache
    # Three claws plus earrings has not been confirmed to fit.
    limits = [(r['hair_claws'], r['earring_pairs']) for r in json.loads(PACKAGE_FILE.read_text())['accessory_box_limits']]
    options = sorted({(c, e) for mc, me in limits for c in range(mc + 1)
                      for e in range(me + 1) if c + e},
                     key=lambda pair: (sum(pair), pair[0]), reverse=True)
    @lru_cache(None)
    def solve(c, e):
        if not c and not e:
            return ()
        best = None
        for pc, pe in options:
            if pc <= c and pe <= e:
                plan = ((pc, pe),) + solve(c - pc, e - pe)
                if best is None or len(plan) < len(best):
                    best = plan
        return best
    return solve(claws, earrings)


def build_parcels(items):
    packages = {p['id']: p for p in json.loads(PACKAGE_FILE.read_text())['packages']}
    if not items:
        raise ValueError('An empty order cannot be quoted.')
    groups = {kind: [] for kind in packages}
    for item in items:
        kind = item.get('package_id')
        if kind not in groups:
            raise ValueError('No confirmed package for these items.')
        quantity = item.get('quantity')
        if type(quantity) is not int or not 1 <= quantity <= 100:
            raise ValueError('Quantity must be an integer from 1 to 100.')
        try:
            weight = Decimal(str(item.get('weight_oz')))
        except Exception:
            raise ValueError('A verified item weight in ounces is required.') from None
        if not weight.is_finite() or weight <= 0:
            raise ValueError('A verified positive item weight is required.')
        groups[kind].extend([weight] * quantity)
    if sum(len(g) for g in groups.values()) > 100:
        raise ValueError('Orders over 100 items require a packing review.')
    parcels = []
    def add_parcel(package, weights):
        total = sum(weights) + Decimal(str(package['packaging_weight']))
        parcels.append({
            'length': str(package['length']), 'width': str(package['width']),
            'height': str(package['height']), 'distance_unit': 'in',
            'weight': str(total.quantize(Decimal('0.001'), rounding=ROUND_CEILING)),
            'mass_unit': 'oz',
        })
    claws, earrings = groups['hair-claw-box'], groups['earring-box']
    ci = ei = 0
    for c, e in pack_counts(len(claws), len(earrings)):
        add_parcel(packages['hair-claw-box'], claws[ci:ci+c] + earrings[ei:ei+e])
        ci += c
        ei += e
    # Signs never share a box with accessories or another sign.
    for weight in groups['14-inch-sign-box']:
        add_parcel(packages['14-inch-sign-box'], [weight])
    return parcels


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('items_file', help='JSON list with package_id, quantity and verified weight_oz per item')
    args = parser.parse_args()
    print(json.dumps(build_parcels(json.loads(Path(args.items_file).read_text())), indent=2))

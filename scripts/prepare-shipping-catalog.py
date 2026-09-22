"""Generate explicit checkout SKU mappings from owner-approved accessory weights."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
approved = json.loads((root / '.local/confirmed-accessory-weights.json').read_text())
overrides = json.loads((root / 'scripts/studio-sku-overrides.json').read_text())
mapping = {}
missing = []
for row in approved['approved']:
    sku = overrides.get(row['shopify_variant_id'], row['sku'])
    if row['sku'] and sku != row['sku']:
        raise ValueError('SKU override conflicts with source catalog')
    if not sku:
        missing.append(row['shopify_variant_id'])
        continue
    if sku in mapping:
        raise ValueError('Duplicate SKU')
    expected = 1 if row['package_id'] == 'hair-claw-box' else 0.5
    if row['package_id'] not in ('hair-claw-box', 'earring-box') or row['weight_oz'] != expected:
        raise ValueError('Unconfirmed accessory weight')
    mapping[sku] = {'package_id': row['package_id'], 'weight_oz': row['weight_oz']}
# Only the two previously confirmed pilot signs; never infer other sign dimensions.
for sku in ('38432', '38409'):
    if sku in mapping:
        raise ValueError('Sign SKU collision')
    mapping[sku] = {'package_id': '14-inch-sign-box', 'weight_oz': 40}
target = root / 'apps/backend/src/lib/shipping-catalog.json'
target.write_text(json.dumps(dict(sorted(mapping.items())), indent=2) + '\n')
print(json.dumps({'mapped_skus': len(mapping), 'accessories_missing_sku': len(missing)}))

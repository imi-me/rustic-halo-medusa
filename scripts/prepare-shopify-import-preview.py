"""Offline source preview only: never connects to or changes either store."""
import json
from pathlib import Path
from collections import Counter

root = Path(__file__).resolve().parents[1]
files = sorted((root / '.local').glob('shopify-import-page-*.json'),
               key=lambda p: int(p.stem.rsplit('-', 1)[1]))
assert files, 'No export pages found'
assert [int(p.stem.rsplit('-', 1)[1]) for p in files] == list(range(1, len(files)+1)), 'Missing page'
pages = [json.loads(p.read_text()) for p in files]
assert all(p['pageInfo']['hasNextPage'] for p in pages[:-1])
assert not pages[-1]['pageInfo']['hasNextPage'], 'Export incomplete'
products = [p for page in pages for p in page['nodes']]
assert len({p['id'] for p in products}) == len(products), 'Duplicate product'
pilot = json.loads((root / 'apps/backend/src/scripts/data/rustic-halo-pilot.json').read_text())
pilot_ids = {p['id'] for p in pilot['products']}
variants = []
preview = []
for p in products:
    assert not p['media']['pageInfo']['hasNextPage'], p['id']
    assert not p['variants']['pageInfo']['hasNextPage'], p['id']
    vs = p['variants']['nodes']
    assert len(vs) == p['variantsCount']['count'], p['id']
    variants.extend(vs)
    coaster = 'coaster' in p['productType'].lower() or 'coaster' in p['title'].lower()
    issues = []
    if any(not v['sku'] for v in vs): issues.append('missing_sku')
    if not any(m.get('image') for m in p['media']['nodes']): issues.append('missing_image')
    if not p['productType']: issues.append('missing_product_type')
    for v in vs:
        assert not v['inventoryItem']['inventoryLevels']['pageInfo']['hasNextPage'], v['id']
    preview.append({
        'shopify_id': p['id'], 'title': p['title'], 'handle': p['handle'],
        'variant_count': len(vs), 'include_in_catalog': True,
        'candidate_action': 'preserve_existing_pilot' if p['id'] in pilot_ids else 'review_for_draft_import',
        'shipping_setup': 'packaging_pending' if coaster else 'requires_shipping_profile_mapping',
        'publish_automatically': False, 'review_issues': issues,
    })
assert len({v['id'] for v in variants}) == len(variants), 'Duplicate variant'
skus = Counter(v['sku'] for v in variants if v['sku'])
duplicates = [sku for sku, count in skus.items() if count > 1]
assert not duplicates, f'Duplicate SKUs: {duplicates}'
snapshot = {'captured_from': pages[0]['capturedAt'], 'captured_through': pages[-1]['capturedAt'],
            'atomic_inventory_snapshot': False, 'products': products}
result = {'mode': 'offline_source_preview_not_destination_diff',
          'products': len(products), 'variants': len(variants),
          'media_references': sum(len(p['media']['nodes']) for p in products),
          'coasters_packaging_pending': sum(p['shipping_setup'] == 'packaging_pending' for p in preview),
          'known_pilot_products_preserved': sum(p['candidate_action'] == 'preserve_existing_pilot' for p in preview),
          'missing_sku_variants': sum(not v['sku'] for v in variants),
          'inventory_policy': 'Preserve location IDs and quantities separately; refresh and compare before any inventory writes.',
          'items': preview}
for filename, data in [('shopify-import-snapshot.json', snapshot), ('shopify-import-preview.json', result)]:
    (root / '.local' / filename).write_text(json.dumps(data, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'items'}, indent=2))

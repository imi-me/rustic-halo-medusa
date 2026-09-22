"""Build an offline, owner-confirmed weight plan; never infer size from SKU."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def build(products):
    approved, unresolved = [], []
    for p in products:
        earrings = p['productType'] in ('Stud Earrings', 'Dangle Earrings', 'Drop Earrings', 'Dangle', 'Earrings') or p['id'] in ('gid://shopify/Product/8583756742852', 'gid://shopify/Product/8626033983684')
        claws = p['productType'] in ('Hair Claw', 'Hair Accessories') or p['id'] == 'gid://shopify/Product/8697606996164'
        if not earrings and not claws:
            continue
        for v in p['variants']['nodes']:
            row = {'shopify_product_id': p['id'], 'shopify_variant_id': v['id'], 'title': p['title'], 'variant': v['title'], 'sku': v['sku']}
            oz = 0.5 if earrings else 1
            approved.append({**row, 'weight_oz': oz, 'weight_grams': round(oz * 28.349523125, 6), 'package_id': 'earring-box' if earrings else 'hair-claw-box'})
    return {'source': 'Owner confirmed 0.5 oz per earring pair and 1 oz for ALL hair claws regardless of size; item only, packaging additional.', 'approved': approved, 'size_review': unresolved}

if __name__ == '__main__':
    source = json.loads((ROOT / '.local/shopify-import-snapshot.json').read_text())
    plan = build(source['products'])
    (ROOT / '.local/confirmed-accessory-weights.json').write_text(json.dumps(plan, indent=2) + '\n')
    lines = ['# Hair claws needing size confirmation', '', 'Size confirmation is no longer needed for item weight: the owner selected 1 oz for every hair claw, including 2-inch variants. Packaging fit remains a separate check.', '', '| Product | Variant | SKU |', '| --- | --- | --- |']
    lines.extend(f"| {r['title'].replace('|', '/')} | {r['variant'].replace('|', '/')} | {r['sku'] or '(missing)'} |" for r in plan['size_review'])
    (ROOT / 'docs/hair-claw-size-review.md').write_text('\n'.join(lines) + '\n')
    print(json.dumps({'approved': len(plan['approved']), 'earrings': sum(r['package_id']=='earring-box' for r in plan['approved']), 'claws': sum(r['package_id']=='hair-claw-box' for r in plan['approved']), 'size_review': len(plan['size_review'])}))

#!/usr/bin/env python3
import argparse
import json
import os
import re
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--audit', default='.local/etsy-review/etsy-listing-audit.json')
    parser.add_argument('--policy', default='integrations/etsy/hair-claw-color-policy.json')
    parser.add_argument('--output', default='.local/etsy-review/hair-claw-color-plan.json')
    args = parser.parse_args()
    audit = json.loads(Path(args.audit).read_text())
    policy = json.loads(Path(args.policy).read_text())
    if audit.get('truncated') or audit.get('fetchedListings') != audit.get('totalActiveListings') or audit.get('fetchedInventories') != audit.get('totalActiveListings'):
        raise SystemExit('Audit is incomplete')
    listings = {int(row['id']): row for row in audit['listings']}
    matches = {int(row['etsy']['productId']): row for row in audit['comparison']['matches']}
    all_etsy_skus = {str(product.get('sku') or '').casefold() for inv in audit['inventories'] for product in inv['products'] if product.get('sku')}
    all_medusa_skus = {str(row['medusa'].get('sku') or '').casefold() for row in audit['comparison']['matches'] if row['medusa'].get('sku')}
    all_medusa_skus.update(str(row.get('sku') or '').casefold() for row in audit['comparison']['medusaOnly'] if row.get('sku'))
    plans, generated = [], set()
    for inv in audit['inventories']:
        listing_id = int(inv['listingId'])
        title = listings.get(listing_id, {}).get('title', '')
        if not re.search(r'claw', title, re.I):
            continue
        active = [product for product in inv['products'] if any(offering.get('enabled') for offering in product.get('offerings', []))]
        if listing_id == 4339026366:
            if len(active) != len(policy['colors']):
                raise SystemExit('Boho Birds color set is incomplete')
            plans.append({'listingId': listing_id, 'title': title, 'status': 'etsy_ready_medusa_pending', 'baseProducts': []})
            continue
        bases = []
        used_property_ids = {int(prop['propertyId']) for product in active for prop in product.get('properties', [])}
        color_property_id = next((value for value in (513, 514, 516) if value not in used_property_ids), None)
        if color_property_id is None:
            raise SystemExit(f'No custom color property available for {listing_id}')
        for product in active:
            match = matches.get(int(product['productId']))
            if not match or match['etsy'].get('sku') != product.get('sku'):
                raise SystemExit(f'Active claw product is not an exact Medusa match: {listing_id}/{product["productId"]}')
            child_skus = []
            for color in policy['colors']:
                sku = f'{product["sku"]}-{color["suffix"]}'
                folded = sku.casefold()
                if len(sku) > 32 or folded in generated or folded in all_etsy_skus or folded in all_medusa_skus:
                    raise SystemExit(f'SKU collision or invalid child SKU: {sku}')
                generated.add(folded)
                child_skus.append({'color': color['name'], 'sku': sku})
            bases.append({
                'etsyProductId': int(product['productId']),
                'baseSku': product['sku'],
                'existingProperties': product.get('properties', []),
                'availableQuantity': match['etsy']['availableQuantity'],
                'medusaProductId': match['medusa']['productId'],
                'medusaVariantId': match['medusa']['variantId'],
                'children': child_skus,
            })
        plans.append({'listingId': listing_id, 'title': title, 'status': 'planned', 'colorPropertyId': color_property_id, 'baseProducts': bases})
    output = {
        'schemaVersion': 1,
        'sourceAudit': str(Path(args.audit)),
        'readOnlyPreview': True,
        'inventorySynchronizationEnabled': False,
        'colors': policy['colors'],
        'counts': {
            'activeHairClawListings': len(plans),
            'etsyListingsReady': sum(plan['status'] == 'etsy_ready_medusa_pending' for plan in plans),
            'etsyListingsPlanned': sum(plan['status'] == 'planned' for plan in plans),
            'baseVariantsToExpand': sum(len(plan['baseProducts']) for plan in plans),
            'newColorVariantsPlanned': len(generated) + len(policy['colors']),
        },
        'listings': plans,
    }
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, indent=2) + '\n')
    os.chmod(target, 0o600)
    print(json.dumps(output['counts'], sort_keys=True))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Render the private read-only Etsy-to-Medusa comparison as Markdown."""
import argparse
import json
from collections import Counter
from pathlib import Path


def cell(value):
    return str(value if value is not None else '').replace('|', '/').replace('\n', ' ').strip()


def options(product):
    values = []
    for prop in product.get('properties', []):
        selected = ', '.join(cell(value) for value in prop.get('values', []))
        if selected:
            values.append(f"{cell(prop.get('name'))}: {selected}")
    return '; '.join(values)


parser = argparse.ArgumentParser()
parser.add_argument('input', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
report = json.loads(args.input.read_text())
comparison = report['comparison']
resolution = report.get('identityResolution')
counts = comparison['counts']
reasons = Counter(row['reason'] for row in comparison['unresolved'])

lines = [
    '# Etsy-to-Medusa read-only catalog comparison',
    '',
    ('This report began as a read-only comparison of active Etsy inventory products to current Medusa variants using a case-insensitive exact SKU match. The owner subsequently authorized the orphan cleanup recorded below. No Medusa or inventory values were changed.' if resolution else 'This report compares active Etsy inventory products to current Medusa variants using a case-insensitive exact SKU match. It is a review artifact only. It did not change Etsy, Medusa, or inventory synchronization.'),
    '',
    ('## Baseline comparison summary' if resolution else '## Summary'),
    '',
    f"- Active Etsy listings: {report['totalActiveListings']}",
    f"- Etsy inventory products: {counts['etsyProducts']} ({counts['etsyProductsWithSku']} with SKUs)",
    f"- Medusa products and variants: {counts['medusaProducts']} products / {counts['medusaVariants']} variants",
    f"- Exact SKU matches: {counts['matched']}",
    f"- Etsy products needing review: {counts['unresolved']}",
    f"- Medusa variants absent from active Etsy inventory: {counts['medusaOnlyVariants']}",
    f"- Medusa variants without SKUs: {counts['medusaVariantsWithoutSku']}",
    f"- Unresolved reasons: {', '.join(f'{name}={count}' for name, count in sorted(reasons.items())) or 'none'}",
    '',
    'Etsy quantities such as 998 or 999 are preserved as observed values and should not be treated as synchronized physical stock.',
]

if resolution:
    changes = resolution['catalogChanges']
    verification = resolution['verification']
    lines.extend([
        '',
        '## Reviewed identity resolution',
        '',
        'The owner directed that the 12 Etsy variants without Medusa identities be treated as orphans. Five all-orphan listings were moved to inactive, while only the Burnt Orange option was hidden from Falling Leaves so its valid Natural sibling remains active.',
        '',
        f"- Etsy orphan variants removed from active sale: {sum(row['orphanVariants'] for row in changes['deactivatedListings']) + len(changes['hiddenVariants'])}",
        f"- Fully deactivated Etsy listings: {len(changes['deactivatedListings'])}",
        f"- Individually hidden Etsy variants: {len(changes['hiddenVariants'])}",
        f"- Etsy Shop Manager active listings: {changes['etsyManagerActiveBefore']} before / {changes['etsyManagerActiveAfter']} after",
        f"- Etsy Shop Manager inactive listings after cleanup: {changes['etsyManagerInactiveAfter']}",
        f"- Browser verification time: {changes['browserVerifiedAt']}",
        f"- Missing-SKU evidence rows reviewed: {verification['missingEvidenceCoverage']}",
        f"- Boho Birds unique SKU proposals: {verification['bohoProposalCoverage']}",
        '- Medusa and inventory changes: none',
        '',
        f"A post-cleanup API read still returned the pre-cleanup active count of {changes['postCleanupApiActiveCount']}. Etsy Shop Manager showed the completed changes and an active count of {changes['etsyManagerActiveAfter']}; the baseline API rows below are retained for traceability until Etsy's API view catches up.",
        '',
        '### Missing Etsy SKU evidence and disposition',
        '',
        '| Etsy SKU | Etsy product | Evidence | Disposition |',
        '| --- | --- | --- | --- |',
    ])
    for row in resolution['missingSkuEvidence']:
        lines.append(f"| {cell(row['etsySku'])} | {cell(row['etsyTitle'])} | {cell(row['evidence'])} | {cell(row['recommendation'])} |")
    lines.extend([
        '',
        '### Boho Birds unique SKU proposals',
        '',
        'These proposals are review-only. They have not been written to Etsy or Medusa. The Blue and Black suffixes follow the owner-provided `BL` and `BLK` convention.',
        '',
        '| Etsy product ID | Color | Current SKU | Proposed SKU |',
        '| ---: | --- | --- | --- |',
    ])
    for row in resolution['bohoBirdsSkuProposals']:
        lines.append(f"| {cell(row['productId'])} | {cell(row['color'])} | {cell(row['currentSku'])} | {cell(row['proposedSku'])} |")

lines.extend([
    '',
    ('## Baseline Etsy products needing review' if resolution else '## Etsy products needing review'),
    '',
    '| Reason | Etsy listing | Etsy product ID | SKU | Variation | Observed quantity |',
    '| --- | --- | ---: | --- | --- | ---: |',
])
for row in comparison['unresolved']:
    item = row['etsy']
    lines.append(f"| {cell(row['reason'])} | {cell(item.get('listingTitle'))} ({cell(item.get('listingId'))}) | {cell(item.get('productId'))} | {cell(item.get('sku'))} | {cell(options(item))} | {cell(item.get('availableQuantity'))} |")

lines.extend([
    '',
    '## Confirmed exact SKU matches',
    '',
    '| SKU | Etsy listing | Etsy variation | Medusa product | Medusa variant ID | Status |',
    '| --- | --- | --- | --- | --- | --- |',
])
for row in comparison['matches']:
    etsy, medusa = row['etsy'], row['medusa']
    lines.append(f"| {cell(etsy.get('sku'))} | {cell(etsy.get('listingTitle'))} ({cell(etsy.get('listingId'))}) | {cell(options(etsy))} | {cell(medusa.get('productTitle'))} | {cell(medusa.get('variantId'))} | {cell(medusa.get('productStatus'))} |")

lines.extend([
    '',
    '## Medusa variants absent from active Etsy inventory',
    '',
    '| SKU | Medusa product | Medusa variant ID | Status |',
    '| --- | --- | --- | --- |',
])
for row in comparison['medusaOnly']:
    lines.append(f"| {cell(row.get('sku'))} | {cell(row.get('productTitle'))} | {cell(row.get('variantId'))} | {cell(row.get('productStatus'))} |")

lines.extend([
    '',
    '## Medusa variants without SKUs',
    '',
    '| Medusa product | Medusa variant ID | Status |',
    '| --- | --- | --- |',
])
for row in comparison['medusaWithoutSku']:
    lines.append(f"| {cell(row.get('productTitle'))} | {cell(row.get('variantId'))} | {cell(row.get('productStatus'))} |")

args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text('\n'.join(lines) + '\n')
print(json.dumps({'output': str(args.output), 'matches': counts['matched'], 'unresolved': counts['unresolved']}))

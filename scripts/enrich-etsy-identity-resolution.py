#!/usr/bin/env python3
"""Add reviewed identity evidence to the private Etsy comparison report."""
import argparse
import json
import os
import tempfile
from pathlib import Path


parser = argparse.ArgumentParser()
parser.add_argument('comparison', type=Path)
parser.add_argument('plan', type=Path)
args = parser.parse_args()

report = json.loads(args.comparison.read_text())
plan = json.loads(args.plan.read_text())

unresolved = report.get('comparison', {}).get('unresolved', [])
missing = [row for row in unresolved if row.get('reason') == 'medusa_sku_not_found']
duplicates = [row for row in unresolved if row.get('reason') == 'etsy_sku_duplicate']

evidence_by_sku = {row['etsySku'].upper(): row for row in plan['missingSkuEvidence']}
missing_skus = {str(row.get('etsy', {}).get('sku', '')).upper() for row in missing}
if missing_skus != set(evidence_by_sku):
    raise SystemExit('Resolution evidence does not cover the current missing Etsy SKU set exactly.')

proposal_by_product = {row['productId']: row for row in plan['bohoBirdsSkuProposals']}
duplicate_ids = {row.get('etsy', {}).get('productId') for row in duplicates}
if duplicate_ids != set(proposal_by_product):
    raise SystemExit('Boho Birds proposals do not cover the current duplicate Etsy product set exactly.')

proposed = [row['proposedSku'].strip().upper() for row in plan['bohoBirdsSkuProposals']]
if len(proposed) != len(set(proposed)):
    raise SystemExit('Proposed Boho Birds SKUs are not unique.')

existing = set()
for section in ('matches', 'unresolved', 'medusaOnly'):
    for row in report['comparison'].get(section, []):
        value = row.get('etsy', row).get('sku')
        if isinstance(value, str) and value.strip():
            existing.add(value.strip().upper())
collisions = sorted(set(proposed) & existing)
if collisions:
    raise SystemExit(f'Proposed SKUs collide with the comparison catalog: {collisions}')

plan['verification'] = {
    'missingEvidenceCoverage': len(evidence_by_sku),
    'bohoProposalCoverage': len(proposal_by_product),
    'bohoProposalUnique': True,
    'bohoProposalCollisions': [],
    'medusaChanged': False,
    'inventoryChanged': False
}
report['identityResolution'] = plan

fd, temporary = tempfile.mkstemp(prefix='.etsy-resolution-', dir=str(args.comparison.parent))
with os.fdopen(fd, 'w') as stream:
    json.dump(report, stream, indent=2)
    stream.write('\n')
os.chmod(temporary, 0o600)
os.replace(temporary, args.comparison)
print(json.dumps(plan['verification']))

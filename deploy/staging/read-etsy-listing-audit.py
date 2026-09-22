#!/usr/bin/env python3
"""Read the local Etsy audit endpoint and save a private, sanitized report."""
import json
import os
import tempfile
import urllib.request
from pathlib import Path

URL = 'http://127.0.0.1:19000/integrations/etsy/audit'
OUTPUT = Path('/home/shawnhouse/etsy-listing-audit.json')

request = urllib.request.Request(URL, headers={'Accept': 'application/json'})
with urllib.request.urlopen(request, timeout=120) as response:
    if response.status != 200:
        raise RuntimeError(f'Audit returned HTTP {response.status}')
    result = json.load(response)

required = {'shopId', 'totalActiveListings', 'fetchedListings', 'fetchedInventories', 'truncated', 'listings', 'inventories', 'comparison'}
if not required.issubset(result):
    raise RuntimeError(f'Audit response is incomplete; fields={sorted(result) if isinstance(result, dict) else type(result).__name__}')
if not isinstance(result['listings'], list):
    raise RuntimeError('Audit listings are invalid')
if result['fetchedListings'] != len(result['listings']):
    raise RuntimeError('Audit listing count does not match the returned rows')
if result['fetchedInventories'] != len(result['inventories']):
    raise RuntimeError('Audit inventory count does not match the returned rows')
comparison = result['comparison']
if not isinstance(comparison, dict) or comparison.get('readOnly') is not True or not isinstance(comparison.get('counts'), dict):
    raise RuntimeError('Audit comparison is incomplete')

fd, temporary = tempfile.mkstemp(prefix='.etsy-listing-audit-', dir=str(OUTPUT.parent))
with os.fdopen(fd, 'w') as stream:
    json.dump(result, stream, indent=2)
    stream.write('\n')
os.chmod(temporary, 0o600)
os.replace(temporary, OUTPUT)

print(json.dumps({
    'state': 'verified',
    'totalActiveListings': result['totalActiveListings'],
    'fetchedListings': result['fetchedListings'],
    'fetchedInventories': result['fetchedInventories'],
    'truncated': result['truncated'],
    'comparison': comparison['counts'],
    'report': str(OUTPUT),
}))

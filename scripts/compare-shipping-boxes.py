"""Compare live quotes only. Never calls Shippo's label-purchase endpoint."""
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]

def read_env(path):
    return {k.strip(): v.strip().strip('\"\'') for k, v in
            (line.split('=', 1) for line in path.read_text().splitlines()
             if '=' in line and not line.lstrip().startswith('#'))}

def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination_file')
    args = parser.parse_args()
    token = read_env(ROOT / '.local/shippo-live.env').get('SHIPPO_API_KEY', '')
    if not token.startswith('shippo_live_'):
        raise SystemExit('A saved live quote token is required.')
    origin_env = read_env(ROOT / '.local/shippo.env')
    origin = {k: origin_env.get('SHIPPO_FROM_' + k.upper(), '') for k in ['name', 'street1', 'city', 'state', 'zip', 'country']}
    destination = json.loads(Path(args.destination_file).read_text())
    if not all(origin.values()) or destination.get('country') != 'US':
        raise SystemExit('Complete US addresses are required.')
    headers = {'Authorization': 'ShippoToken ' + token, 'Content-Type': 'application/json', 'SHIPPO-API-VERSION': '2018-02-08'}
    def request(path, body=None):
        try:
            with urlopen(Request('https://api.goshippo.com/' + path, data=json.dumps(body).encode() if body is not None else None, headers=headers), timeout=60) as response:
                return json.load(response)
        except HTTPError as error:
            raise SystemExit(f'Shippo HTTP {error.code}. No label purchased.') from None
    accounts = request('carrier_accounts/?results=100')
    carriers = [a['object_id'] for a in accounts.get('results', []) if a.get('active') and a.get('carrier') in ['usps', 'ups']]
    if not carriers:
        raise SystemExit('No active USPS or UPS account returned for live quotes.')
    results = []
    from decimal import Decimal
    for quantity in [1, 4]:
        for height, packaging in [('1.5', '1.3'), ('3', '1.6')]:
            weight = str(Decimal(quantity) * Decimal('0.5') + Decimal(packaging))
            parcel = {'length': '6', 'width': '4', 'height': height, 'distance_unit': 'in', 'weight': weight, 'mass_unit': 'oz'}
            shipment = request('shipments/', {'address_from': origin, 'address_to': destination, 'parcels': [parcel], 'carrier_accounts': carriers, 'async': False})
            if shipment.get('test') is True:
                raise SystemExit('Unexpected test shipment in live comparison.')
            rates = [{'carrier': r['provider'], 'service': r['servicelevel']['name'], 'amount': r['amount'], 'currency': r['currency']} for r in shipment.get('rates', [])]
            row = {'earring_pairs': quantity, 'box_inches': '6x4x' + height, 'packed_oz': weight, 'destination_zip': destination['zip'], 'rates': rates}
            results.append(row)
            print(json.dumps(row), flush=True)
    (ROOT / '.local/shipping-tests/live-box-comparison.json').write_text(json.dumps(results, indent=2))

if __name__ == '__main__':
    main()

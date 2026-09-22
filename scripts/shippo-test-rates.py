"""Preview Shippo test rates from verified item weights and a destination JSON file."""
import argparse
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from shipping_parcels import build_parcels


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('items_file')
    parser.add_argument('destination_file', help='Shippo address JSON; US only for this local pilot')
    args = parser.parse_args()
    parcels = build_parcels(json.loads(Path(args.items_file).read_text()))
    destination = json.loads(Path(args.destination_file).read_text())
    if destination.get('country', '').upper() != 'US':
        raise SystemExit('Only US destinations are configured for this pilot.')
    if not all(destination.get(k) for k in ['street1', 'city', 'state', 'zip']):
        raise SystemExit('A complete destination address is required.')
    values = {}
    for line in (root / '.local/shippo.env').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('\"\'')
    token = values.get('SHIPPO_API_KEY', '')
    if not token.startswith('shippo_test_'):
        raise SystemExit('This preview only accepts a Shippo test token.')
    origin = {key: values.get('SHIPPO_FROM_' + key.upper(), '') for key in ['name', 'street1', 'city', 'state', 'zip', 'country']}
    if not all(origin.values()):
        raise SystemExit('Complete the saved ship-from address first.')
    headers = {'Authorization': 'ShippoToken ' + token, 'Content-Type': 'application/json', 'SHIPPO-API-VERSION': '2018-02-08'}
    try:
        with urlopen(Request('https://api.goshippo.com/carrier_accounts/?results=100', headers=headers), timeout=30) as response:
            accounts = json.load(response)
        carriers = [a['object_id'] for a in accounts.get('results', []) if a.get('active') and a.get('carrier') in ['usps', 'ups']]
        if not carriers:
            raise SystemExit('No active USPS or UPS carrier account is available.')
        shipments = []
        for parcel in parcels:
            payload = {'address_from': origin, 'address_to': destination, 'parcels': [parcel], 'carrier_accounts': carriers, 'async': False}
            request = Request('https://api.goshippo.com/shipments/', data=json.dumps(payload).encode(), headers=headers)
            with urlopen(request, timeout=60) as response:
                shipments.append(json.load(response))
    except HTTPError as error:
        raise SystemExit(f'Shippo returned HTTP {error.code}; no label was purchased.') from None
    from decimal import Decimal
    # Separate boxes need separate labels; offer only services available for every box.
    rate_maps = []
    for shipment in shipments:
        by_service = {}
        for rate in shipment.get('rates', []):
            key = (rate['provider'], rate['servicelevel']['token'], rate['currency'])
            if key not in by_service or Decimal(rate['amount']) < Decimal(by_service[key]['amount']):
                by_service[key] = rate
        rate_maps.append(by_service)
    shared = set.intersection(*(set(m) for m in rate_maps))
    rates = []
    for key in sorted(shared):
        selected = [m[key] for m in rate_maps]
        days = [r.get('estimated_days') for r in selected]
        rates.append({'carrier': key[0], 'service': selected[0]['servicelevel']['name'],
                      'amount': str(sum(Decimal(r['amount']) for r in selected)), 'currency': key[2],
                      'box_amounts': [r['amount'] for r in selected],
                      'estimated_transit_days': max(days) if all(d is not None for d in days) else None})
    print(json.dumps({'mode': 'test only; not actual postage prices', 'parcels': parcels, 'rates': rates, 'no_rates': not bool(rates)}, indent=2))



if __name__ == '__main__':
    main()

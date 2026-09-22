"""Read-only verification of the local pilot catalog against its source snapshot."""
import json
from pathlib import Path
from urllib.request import Request, urlopen
root = Path(__file__).resolve().parents[1]
env = dict(line.split('=', 1) for line in (root/'apps/storefront/.env.local').read_text().splitlines() if '=' in line and not line.startswith('#'))
def get(path):
    request = Request('http://127.0.0.1:9000/store/' + path, headers={'x-publishable-api-key': env['NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY'].strip().strip('"')})
    with urlopen(request) as response: return json.load(response)
region = get('regions')['regions'][0]['id']
products = get('products?region_id=' + region + '&fields=*variants.calculated_price,+variants.inventory_quantity&limit=100')['products']
snapshot = json.loads((root/'apps/backend/src/scripts/data/rustic-halo-pilot.json').read_text())
for source in snapshot['products']:
    matches = [p for p in products if p['handle'] == source['handle']]
    assert len(matches) == 1, 'Missing or duplicate product'
    product = matches[0]
    assert len(product['variants']) == source['totalVariants']
    for variant in source['variants']:
        imported = next(v for v in product['variants'] if v['sku'] == variant['sku'])
        assert imported['allow_backorder'], 'Online product must allow made-to-order purchasing'
        assert imported['calculated_price']['calculated_amount'] == float(variant['price'])
        online = next(i['available'] for i in source['inventory'] if i['sku'] == variant['sku'] and i['locationId'].endswith('/68049862852'))
        assert imported['inventory_quantity'] == online, (variant['sku'], imported['inventory_quantity'], online)
    print('Verified product, variants, USD prices, and online-only inventory:', source['handle'])
assert len(get('products?q=Floral&region_id=' + region)['products']) == 1
print('Verified search filtering')

# Optional local made-to-order check: buyable at zero physical online stock.
if '--check-made-to-order-cart' in __import__('sys').argv:
    def request(path, body=None, method='POST'):
        req = Request('http://127.0.0.1:9000/store/' + path,
                      data=json.dumps(body).encode() if body is not None else None, method=method,
                      headers={'Content-Type': 'application/json', 'x-publishable-api-key': env['NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY'].strip().strip('"')})
        with urlopen(req) as response: return json.load(response)
    made_to_order = next(v for p in products for v in p['variants'] if v['sku'] == '38432')
    assert made_to_order['inventory_quantity'] == 0 and made_to_order['allow_backorder']
    cart = request('carts', {'region_id': region})['cart']
    cart = request('carts/' + cart['id'] + '/line-items', {'variant_id': made_to_order['id'], 'quantity': 1})['cart']
    assert len(cart['items']) == 1 and cart['items'][0]['unit_price'] == 48
    request('carts/' + cart['id'] + '/line-items/' + cart['items'][0]['id'], method='DELETE')
    assert not get('carts/' + cart['id'])['cart']['items']
    print('Verified made-to-order product can be added at zero stock; test item removed, no order placed')

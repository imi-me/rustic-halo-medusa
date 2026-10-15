exports.default = async ({ container }) => {
  const fs = require('node:fs/promises'), assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
  if (process.env.APP_ENV !== 'staging' || process.env.ETSY_HISTORICAL_LINKS !== 'approved') throw Error('This reviewed order-link operation is staging only.');
  const { etsyWorkspaceAccess } = require('../lib/etsy/listing-workspace');
  const { historicalMatchesKey, historicalMatchesSchema, historicalTransactionFingerprint, resolveHistoricalPacking } = require('../lib/etsy/historical-order-matches');
  const plan = JSON.parse(await fs.readFile('/tmp/rh-etsy-historical-plan.json', 'utf8'));
  assert.equal(plan.rows.length, 7); assert.equal(new Set(plan.rows.map(r => r.transactionId)).size, 7);
  const access = await etsyWorkspaceAccess(container); assert.equal(access.shopId, plan.shopId);
  await container.resolve('locking').execute(`etsy-order-workspace:${access.shopId}`, async () => {
    const ops = container.resolve('admin_operations'), key = historicalMatchesKey(access.shopId);
    const [prior] = await ops.listAdminOperations({ operation_key: key });
    assert.equal(prior?.payload?.revision ?? null, plan.expectedRevision, 'Existing links changed; review before applying.');
    const receipts = new Map();
    for (const id of new Set(plan.rows.map(row => row.receiptId))) {
      const response = await fetch(`https://openapi.etsy.com/v3/application/shops/${access.shopId}/receipts/${id}?legacy=true`, { headers: access.headers, signal: AbortSignal.timeout(20000) });
      assert.equal(response.status, 200, 'Etsy receipt could not be read.');
      const receipt = await response.json(); assert.equal(receipt.receipt_id, id); receipts.set(id, receipt);
    }
    const links = [];
    for (const row of plan.rows) {
      const receipt = receipts.get(row.receiptId), source = receipt.transactions.find(t => t.transaction_id === row.transactionId);
      assert.ok(source); assert.equal(source.sku, row.sku); assert.equal(source.listing_id, row.listingId); assert.equal(source.product_id, row.etsyProductId); assert.equal(source.quantity, row.quantity); assert.equal(source.is_digital, false);
      const choices = (source.variations || []).filter(v => /^(size|style|finish|colou?r|length|claw)/i.test(v.formatted_name || '')).map(v => ({ propertyId:v.property_id,valueId:v.value_id,name:v.formatted_name,value:v.formatted_value }));
      assert.deepEqual(choices, row.variations, 'Order size/finish/color choices changed.');
      const products = container.resolve('product');
      const references = await products.listProductVariants({ id: row.packingVariantIds }, { relations: ['product'], take: 100 });
      assert.equal(references.length, row.packingVariantIds.length); assert.ok(references.some(v => v.id === row.originalVariantId));
      for (const variant of references) { assert.equal(variant.product.id, row.productId); assert.equal(variant.product.title, row.productTitle); assert.equal(variant.metadata?.base_sku, row.sku); assert.equal(Number(variant.weight), row.expectedWeightGrams); }
      await resolveHistoricalPacking([{ packing_product_id: row.productId, packing_variant_ids: row.packingVariantIds, legacy_sku: row.sku, quantity: row.quantity }], products);
      links.push({ receiptId:row.receiptId,transactionId:row.transactionId,listingId:row.listingId,etsyProductId:row.etsyProductId,sku:row.sku,productId:row.productId,productTitle:row.productTitle,originalVariantId:row.originalVariantId,packingVariantIds:row.packingVariantIds,sourceFingerprint:historicalTransactionFingerprint(row.receiptId,source),evidence:row.evidence });
    }
    const payload = historicalMatchesSchema.parse({ version:1,revision:randomUUID(),links });
    await fs.writeFile('/tmp/rh-etsy-historical-links-before.json', JSON.stringify(prior?.payload ?? null));
    if (prior) await ops.updateAdminOperations({ id:prior.id,status:'configured',payload });
    else await ops.createAdminOperations({ operation_key:key,kind:'etsy-order-matches',resource_id:String(access.shopId),status:'configured',payload });
    const report = { checkedAt:new Date().toISOString(),shopId:access.shopId,revision:payload.revision,links:links.map(l=>({receiptId:l.receiptId,transactionId:l.transactionId,sku:l.sku,productId:l.productId,productTitle:l.productTitle,packingReferences:l.packingVariantIds.length})),productWrites:0,providerOrderWrites:0,labelsPurchased:0 };
    await fs.writeFile('/tmp/rh-etsy-historical-links-report.json',JSON.stringify(report));
    console.log('HISTORICAL_ETSY_LINKS_APPLIED');
  }, {timeout:5,expire:300});
};

#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { buildHairClawDraft } = require('../integrations/etsy/hair-claw-catalog.cjs')

const specPath = process.argv[2]
if (!specPath) throw Error('Usage: node scripts/preview-hair-claw-product.cjs PRODUCT_SPEC.json [OUTPUT.json]')
const policyPath = path.join(__dirname, '..', 'integrations', 'etsy', 'hair-claw-color-policy.json')
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'))
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'))
const product = buildHairClawDraft(spec, policy)
const preview = {
  generatedAt: new Date().toISOString(), mode: 'preview', writesPerformed: false,
  summary: {
    title: product.title, handle: product.handle, status: product.status,
    optionCount: product.options.length, variantCount: product.variants.length,
    colors: product.options.find(row => row.title === 'Color').values,
  },
  product,
}
const output = JSON.stringify(preview, null, 2) + '\n'
if (process.argv[3]) fs.writeFileSync(process.argv[3], output, { mode: 0o600 })
else process.stdout.write(output)

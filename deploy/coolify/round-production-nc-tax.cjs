// Medusa 2.21 keeps fractional-cent line tax. Stripe rounds each extended
// line before summing. Limit this build patch to our exclusive NC provider.
const fs=require('node:fs'),path=require('node:path')
const marker='// Rustic Halo: round exclusive NC tax per extended line.'
function patchTaxSource(source){
 if(source.includes(marker))return source
 const needle='        let taxAmount = math_1.MathBN.mult(taxableAmount, rate);'
 if(source.split(needle).length!==2)throw Error('Medusa tax implementation changed; review required')
 return source.replace(needle,needle+'\n        '+marker+'\n        if (process.env.APP_ENV === "production" && process.env.STRIPE_TAX_LIVE_ENABLED === "true" && taxLines.length === 1 && taxLine.code === "NC-SALES-TAX") {\n            taxAmount = taxAmount.decimalPlaces(2, 4);\n        }')
}
exports.patchTaxSource=patchTaxSource
if(require.main===module){
 if(process.argv[2]!=='--apply'||!process.argv[3])throw Error('Explicit build root required')
 const modules=path.join(process.argv[3],'node_modules/.pnpm')
 const targets=fs.readdirSync(modules).filter(n=>n.startsWith('@medusajs+utils@2.21.0_')).map(n=>path.join(modules,n,'node_modules/@medusajs/utils/dist/totals/tax/index.js'))
 if(!targets.length)throw Error('Pinned Medusa 2.21 tax implementation missing')
 for(const file of targets)fs.writeFileSync(file,patchTaxSource(fs.readFileSync(file,'utf8')))
 console.log('Guarded production NC tax rounding prepared in '+targets.length+' utility copies')
}

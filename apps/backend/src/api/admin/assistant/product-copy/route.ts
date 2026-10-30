import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ADMIN_OPERATIONS } from '../../../../modules/admin-operations'
import { readClawPalette } from '../../../../lib/hair-claw-color-store'
import { draftSeoOptionFacts, readSeoProducts, seoOptionFacts } from '../../../../lib/product-seo-options'
import { savedSeoDescriptions } from '../../../../lib/product-seo-quality'
import { readBulkSeo } from '../../../../lib/bulk-product-seo'
import { generateSeoBatch } from '../../../../lib/admin-assistant/product-seo-batch'
import { seoText } from '../../../../lib/product-seo-values'
import { CopyPhotoError } from '../../../../lib/admin-assistant/photos'
import { allowedOrigin } from '../route'
import { acquire, isReady } from '../../../../lib/admin-assistant'
import { copyInputSchema, generateProductCopy } from '../../../../lib/admin-assistant/product-copy'
export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const actor = req.auth_context?.actor_id
  if (!actor || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  if (!isReady()) return res.status(503).json({ message: 'Ask Rusty needs its backend project key and model before AI suggestions are available.' })
  const parsed = copyInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues.some(issue => issue.message.includes('photo previews are too large')) ? 'Selected photo previews are too large together. Use smaller photos or select fewer newly added images.' : 'Provide a title and bounded product facts; no buyer information or credentials.' })
  const release = acquire(actor)
  if (!release) return res.status(429).json({ message: 'One AI request at a time, up to 10 per hour.' })
  try {
    if(parsed.data.action==='product-seo'){
      const value=parsed.data
      let options=draftSeoOptionFacts(value.title,value.draft_options)
      if(value.product_id){const [product]=await readSeoProducts(req.scope,[value.product_id]);if(!product)return res.status(404).json({message:'Product not found. Reload before generating search wording.'});const palette=await readClawPalette(req.scope.resolve(ADMIN_OPERATIONS));options=seoOptionFacts(product,palette.colors)}
      const state=await readBulkSeo(req.scope),library=[...await savedSeoDescriptions(req.scope),...(state.run?.rows.filter(r=>r.suggestion&&r.status==='ready').map(r=>({id:r.id,title:r.source.title,description:r.suggestion!.description}))||[])]
      const [suggestion]=await generateSeoBatch([{id:value.product_id||'new_product',title:value.title,description:seoText(value.description),material:value.material,brief:value.facts,options}],fetch,library,25000)
      if(suggestion.error)throw Error(suggestion.error)
      return res.json({suggestion:{title:suggestion.title,description:suggestion.description,tags:[],explanation:options.source==='saved_variants'?'Based on current saved product options and checked against other product descriptions.':'Based on the new product draft; no stock or availability is promised.'},option_source:options.source})
    }
    return res.json({ suggestion: await generateProductCopy(parsed.data) })
  }
  catch (error) { if (error instanceof CopyPhotoError) return res.status(400).json({ message: error.message }); return res.status(502).json({ message: 'AI could not produce a valid suggestion. Your draft is unchanged.' }) }
  finally { release() }
}

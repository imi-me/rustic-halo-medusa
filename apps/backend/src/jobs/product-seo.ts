import type { MedusaContainer } from '@medusajs/framework/types'
import { isReady } from '../lib/admin-assistant'
import { processBulkSeo } from '../lib/bulk-product-seo'
export default async function productSeo(container:MedusaContainer) {
  if(!isReady())return
  try{const deadline=Date.now()+45000;for(let batch=0;batch<2;batch++){if(!await processBulkSeo(container)||Date.now()>=deadline)break}}catch{container.resolve('logger').warn('Bulk product search wording paused; review its Admin status.')}
}
export const config={name:'product-seo-drafts',schedule:'* * * * *'}

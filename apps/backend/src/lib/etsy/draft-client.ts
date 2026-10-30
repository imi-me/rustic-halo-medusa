import sharp from 'sharp'
import { etsyWorkspaceAccess } from './listing-workspace'
export type DraftAccess = Awaited<ReturnType<typeof etsyWorkspaceAccess>>
const base = 'https://openapi.etsy.com/v3/application'
export const draftCreationEnabled = () => ['local','staging'].includes(process.env.APP_ENV ?? '') || process.env.ETSY_DRAFT_CREATION_ENABLED === 'true'
export class EtsyDraftClient {
  private lastRead = 0
  constructor(public access: DraftAccess, private request: typeof fetch = fetch) {}
  async call(path: string, method = 'GET', body?: BodyInit, contentType?: string): Promise<any> {
    for (let attempt=0;attempt<3;attempt++) {
      const delay=1150-(Date.now()-this.lastRead);if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));this.lastRead=Date.now()
      const response=await this.request(base+path,{method,headers:{...this.access.headers,...(contentType?{'Content-Type':contentType}:{})},...(body?{body}:{}),signal:AbortSignal.timeout(25000)})
      if(method==='GET'&&response.status===429){await new Promise(resolve=>setTimeout(resolve,Math.min(20000,Math.max(2000,Number(response.headers.get('retry-after'))*1000||5000))));continue}
      if(!response.ok){const error=new Error(`Etsy draft ${method==='GET'?'read':'save'} failed (HTTP ${response.status}). Your saved progress is kept.`);Object.assign(error,{definite:response.status>=400&&response.status<500,status:response.status});throw error}
      return response.json()
    }
    throw Error('Etsy is busy. Your saved draft preparation can be retried.')
  }
  async listings(state: string) {
    const rows:any[]=[]
    for(let offset=0;offset<2000;offset+=100){const page=await this.call(`/shops/${this.access.shopId}/listings?state=${state}&limit=100&offset=${offset}`);if(!Array.isArray(page.results)||!Number.isSafeInteger(page.count)||page.count>2000)throw Error('Etsy listing review reached its safe limit.');rows.push(...page.results);if(rows.length>=page.count)return rows;if(!page.results.length)break}
    throw Error('Etsy listing review is incomplete. No new listing was created.')
  }
  async ownedDraft(id: number) {
    const listing=await this.call('/listings/'+id)
    if(listing.shop_id!==this.access.shopId||listing.listing_id!==id||listing.state!=='draft')throw Error('This Etsy listing is no longer an unpublished draft. Review it in Etsy; no further changes were made.')
    return listing
  }
  inventory(id: number) {return this.call(`/listings/${id}/inventory?max_variations_supported=3`)}
  images(id: number) {return this.call(`/listings/${id}/images`)}
}
export function approvedDraftImage(url: string) {
  const source=new URL(url),hosts=['cdn.rustichalo.com',...(process.env.ETSY_EXPORT_IMAGE_HOSTS??'').split(',').map(h=>h.trim()).filter(Boolean)]
  if(source.protocol!=='https:'||source.port||source.username||source.password||!hosts.includes(source.hostname))throw Error('Use saved product photos from the approved media library for the Etsy draft.')
  return source
}
export async function draftImageBytes(url: string, request: typeof fetch=fetch) {
  const response=await request(approvedDraftImage(url),{redirect:'error',signal:AbortSignal.timeout(20000)})
  if(!response.ok||Number(response.headers.get('content-length')??0)>10000000||!/^image\/(png|jpeg|webp|gif)/.test(response.headers.get('content-type')??''))throw Error('The product photo could not be prepared for Etsy.')
  const reader=response.body?.getReader();if(!reader)throw Error('Product photo unavailable.')
  const chunks:Uint8Array[]=[];let size=0
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>10000000){await reader.cancel();throw Error('A product photo exceeds 10 MB.')}chunks.push(part.value)}
  // Normalize supported uploads without changing the artwork or cropping it.
  const image=sharp(Buffer.concat(chunks),{limitInputPixels:60_000_000,failOn:'error',animated:false}),metadata=await image.metadata(),prepared=image.rotate().resize({width:3000,height:3000,fit:'inside',withoutEnlargement:true})
  const bytes=await (metadata.hasAlpha?prepared.png():prepared.jpeg({quality:95})).toBuffer()
  if(bytes.length>10000000)throw Error('The prepared Etsy photo exceeds 10 MB. Use a smaller product photo.')
  return {bytes,mime:metadata.hasAlpha?'image/png':'image/jpeg',extension:metadata.hasAlpha?'png':'jpg'}
}

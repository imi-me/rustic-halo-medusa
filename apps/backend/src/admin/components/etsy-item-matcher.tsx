import { useEffect, useState } from 'react'
import type { PackedParcel } from '../../lib/shipping-plan'
import { productSearchDetail, productSearchParams, type SearchProduct } from '../lib/product-search'
type Choices={matchingRevision:string|null;product:{id:string;title:string};groups:Array<{key:string;label:string;variants:Array<{id:string;title:string;sku:string|null}>}>}
type Review={productTitle:string;groupLabel:string;variantLabel:string|null;parcels:PackedParcel[];reviewHash:string;packingOnly:boolean;canRemember:boolean}
async function request<T>(url:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const response=await fetch(url,{credentials:'include',signal,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})}),result=await response.json()
 if(!response.ok)throw new Error(result.message||'This product match is unavailable.')
 return result
}
export const EtsyItemMatcher=({receiptId,transactionId,revision,onSaved}:{receiptId:number;transactionId:number;revision:string;onSaved:()=>void})=>{
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[results,setResults]=useState<SearchProduct[]>([]),[product,setProduct]=useState(''),[choices,setChoices]=useState<Choices|null>(null),[groupKey,setGroupKey]=useState(''),[variant,setVariant]=useState(''),[remember,setRemember]=useState(false),[review,setReview]=useState<Review|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[searching,setSearching]=useState(false),[loading,setLoading]=useState(false)
 const endpoint=`/admin/integrations/etsy/workspace/${receiptId}/match`,group=choices?.groups.find(g=>g.key===groupKey)
 useEffect(()=>{
  const controller=new AbortController();setResults([])
  if(!open||query.trim().length<2){setSearching(false);return()=>controller.abort()}
  setSearching(true)
  const timer=setTimeout(()=>{void request<{products:SearchProduct[]}>(`/admin/products?${productSearchParams(query)}`,undefined,controller.signal).then(r=>{if(!controller.signal.aborted){setResults(r.products);setError('')}}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setSearching(false)})},250)
  return()=>{clearTimeout(timer);controller.abort()}
 },[query,open])
 useEffect(()=>{
  const controller=new AbortController();setChoices(null);setGroupKey('');setVariant('');setReview(null)
  if(!product){setLoading(false);return()=>controller.abort()}
  setLoading(true);setError('')
  void request<Choices>(`${endpoint}?${new URLSearchParams({transaction_id:String(transactionId),product_id:product})}`,undefined,controller.signal).then(r=>{if(!controller.signal.aborted)setChoices(r)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[product,endpoint,transactionId])
 async function submit(save=false){
  if(!choices||!group)return
  setBusy(true);setError('')
  try{
   const result=await request<Review>(endpoint,{action:save?'save':'review',transaction_id:transactionId,product_id:product,group_key:group.key,variant_id:variant||null,expected_revision:revision,matching_revision:choices.matchingRevision,remember,...(save?{confirm_match:true,review_hash:review?.reviewHash}:{})})
   if(save)onSaved();else setReview(result)
  }catch(e){setError((e as Error).message);setReview(null)}finally{setBusy(false)}
 }
 return <div className="ew-matcher">
  {!open?<button onClick={()=>setOpen(true)}>Match product and size</button>:<fieldset disabled={busy}><legend>Match this Etsy item</legend>
   <label>Find product<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, SKU or barcode…" /></label>
   {searching&&<small role="status">Searching products…</small>}
   {!!results.length&&<div className="ew-match-results" role="group" aria-label="Matching products">{results.map(p=><button type="button" key={p.id} aria-pressed={p.id===product} onClick={()=>{setProduct(p.id);setReview(null)}}>{p.title}<small>{productSearchDetail(p,query)}</small></button>)}</div>}
   {!searching&&query.trim().length>=2&&!results.length&&<small>No matching products found.</small>}
   {loading&&<p role="status">Loading sizes and finishes…</p>}
   {choices&&<><p><b>Product:</b> {choices.product.title}</p><label>Size and finish<select value={groupKey} onChange={e=>{const next=choices.groups.find(g=>g.key===e.target.value);setGroupKey(e.target.value);setVariant(next?.variants.length===1?next.variants[0].id:'');setReview(null)}}><option value="">Choose size and finish</option>{choices.groups.map(g=><option key={g.key} value={g.key}>{g.label}</option>)}</select></label>
    {group&&<label>Purchased color / variant<select value={variant} onChange={e=>{setVariant(e.target.value);setReview(null)}}><option value="">Not recorded — packing match only</option>{group.variants.map(v=><option key={v.id} value={v.id}>{v.title}{v.sku?` · ${v.sku}`:''}</option>)}</select></label>}
    <label className="ew-match-remember"><input type="checkbox" checked={remember} onChange={e=>{setRemember(e.target.checked);setReview(null)}} />Use for future orders with the same Etsy listing, SKU and options</label>
    <p className="ew-sync">Check the Etsy selections above. Leave the color unspecified if it wasn’t recorded. A packing-only match keeps an unshipped order in Needs review.</p>
    <button disabled={!group||loading} onClick={()=>void submit()}>{busy?'Checking…':'Review match'}</button>
   </>}
   {review&&<div className="ew-match-review" role="status"><strong>{review.productTitle} · {review.groupLabel}</strong><p>{review.variantLabel||'Color not recorded · packing match only'}</p>{review.parcels.map((p,i)=><p key={i}>{p.package_name} · {p.length} × {p.width} × {p.height} in · {p.weight} oz packed · {p.item_count} items</p>)}<small>This suggestion covers this item only. Saving recalculates packing for the full order.</small><p>{remember?'Future identical listing/SKU/options will reuse this match.':'This match applies to this order item only.'}</p><button className="ow-primary" onClick={()=>void submit(true)}>{busy?'Saving…':'Save match'}</button></div>}
   {error&&<p className="rh-error" role="alert">{error}</p>}
   <button onClick={()=>setOpen(false)}>Cancel matching</button>
  </fieldset>}
 </div>
}

import { useEffect, useState } from 'react'
import { adminRequest } from '../lib/inline-edit'
import { colorSupportsSize, type ClawSize } from '../../lib/hair-claw-colors'
export function NewClawChannels({enabled,setEnabled,sizes,change}: {enabled:boolean;setEnabled:(value:boolean)=>void;sizes:ClawSize[];change:(value:any)=>void}) {
  const [settings,setSettings]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[quantity,setQuantity]=useState(1),[excluded,setExcluded]=useState<Record<ClawSize,string[]>>({'2':[],'4':[]}),[reload,setReload]=useState(0)
  useEffect(()=>{if(!enabled)return;let live=true;setLoading(true);setError('');adminRequest('/admin/product-workspace/etsy-settings').then(value=>{if(live)setSettings(value)}).catch(failure=>{if(live)setError(failure.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[enabled,reload])
  useEffect(()=>{change({enabled,loading,error,ready:!enabled||Boolean(settings&&!loading&&!error),value:settings?{settings_revision:settings.settings_revision,palette_revision:settings.palette.revision,excluded_by_size:excluded,quantity}:null})},[enabled,settings,loading,error,excluded,quantity,change])
  return <div className="rh-claw-channel-create">
    <label className="rh-inline-check"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/>Prepare an unpublished Etsy draft too</label>
    {enabled&&<>
      <p>Enter the product once. Its name, description, photos, prices, SKUs and selected colors prepare both drafts. Review each before publishing.</p>
      {loading&&<p role="status">Loading your shared colors and Etsy hair-claw settings…</p>}
      {error&&<p role="alert">{error} <button type="button" onClick={()=>setReload(value=>value+1)}>Reload Etsy settings</button></p>}
      {settings&&!loading&&!error&&<>
        <p>Uses your existing Etsy hair-claw category, shipping, returns and processing settings.</p>
        <details><summary>Review Etsy settings source</summary><p>Based on <a href={`https://www.etsy.com/listing/${settings.settings.source_listing_id}`} target="_blank" rel="noopener noreferrer">{settings.settings.source_title}</a>. The new listing stays a draft.</p></details>
        <label className="rh-inline-field"><span>Etsy quantity for each size/finish</span><input aria-label="Etsy quantity for each size/finish" type="number" min={1} max={999} required value={quantity} onChange={event=>setQuantity(Number(event.target.value))}/><small>Shared across its colors. This does not copy or multiply physical location stock.</small></label>
        {sizes.map(size=><div key={size}><h3>{size}-inch order colors</h3><div style={{display:'flex',flexWrap:'wrap',gap:'10px 18px'}}>{settings.palette.colors.filter((color:any)=>color.active&&colorSupportsSize(color,size)).map((color:any)=><label className="rh-inline-check" key={color.slug}><input aria-label={`${size}-inch available in ${color.name}`} type="checkbox" checked={!excluded[size].includes(color.name)} onChange={event=>setExcluded(previous=>({...previous,[size]:event.target.checked?previous[size].filter(name=>name!==color.name):[...previous[size],color.name]}))}/>{color.name}</label>)}</div></div>)}
      </>}
    </>}
  </div>
}
export function ChannelDraftReview({preparation,retry,error}: {preparation:any;retry:()=>void;error:string}) {
  const done=preparation.status==='complete',failed=preparation.status==='failed'
  return <div className="rh-inline-editor rh-product-editor"><section className="rh-copy-proposal">
    <h1>{done?'Website and Etsy drafts ready':failed?'Your draft preparation needs attention':'Preparing both drafts'}</h1>
    <p role={failed?'alert':'status'}>{error||preparation.message||'Loading saved draft preparation…'}</p>
    <p>Both channels stay unpublished. Each actual size/finish has one SKU; color is an order choice.</p>
    {preparation.summary?.length>0&&<table><thead><tr><th>Size / finish</th><th>SKU</th><th>Order colors</th></tr></thead><tbody>{preparation.summary.map((offer:any)=><tr key={offer.variant_id}><td>{offer.value}</td><td>{offer.sku}</td><td>{offer.colors.join(', ')}</td></tr>)}</tbody></table>}
    <div className="rh-inline-buttons">{preparation.website_url&&<a className="rh-preview-button" href={preparation.website_url}>Review website draft</a>}{preparation.etsy_url&&<a className="rh-preview-button" href={preparation.etsy_url} target="_blank" rel="noopener noreferrer">Review Etsy draft ↗</a>}{!done&&<button type="button" onClick={retry}>{failed?'Retry saved preparation':'Check saved progress'}</button>}</div>
    <p>You can leave this page and return using this same address. Preparation keeps its saved progress.</p>
  </section></div>
}

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { TooltipProvider } from '@medusajs/ui'
import HairClawPhotoUpload from './hair-claw-photo-upload'
import HairClawCrop from './hair-claw-crop'
import { FitHelp, FitHint, FitIcon } from './hair-claw-ui'
import { adminFetch } from '../lib/admin-fetch'

type Crop = { top:number; bottom:number; left:number; right:number }
type Corner = {x:number;y:number}
type Recipe = { file_id?:string; image_id?:string; url:string; width:number; height:number; scale:number; x:number; y:number; vertical:boolean; enabled:boolean; editor_version?:2; rotation?:number; source_rotation?:0|90|180|270; skew_x?:number; skew_y?:number; corners?:Corner[]; mirror_x?:boolean; mirror_y?:boolean; fit?:'contain'|'cover'; side?:'left'|'right'; border?:'photo'|'template'|'none'; crop?:Crop }
type Settings = { revision:string|null; recipes:Record<string,Recipe>; drafts?:Record<string,Recipe> }
type OfferPrice = {amount:number|null;revision:string;enabled:boolean}
const offers=[['2-natural','2 inch · Natural'],['2-cbc','2 inch · Colors by Cate'],['4-natural','4 inch · Natural'],['4-cbc','4 inch · Colors by Cate']]
type ProductImage = { id:string; url:string }
const palette = ['Black','Espresso','Mocha','Chocolate','Caramel','Khaki','Taupe','Sand','Ivory','Gray','Terracotta','Rose','Purple']
const emptyCrop:Crop = {top:0,bottom:0,left:0,right:0}
const defaults = {editor_version:2 as const, scale:1, x:0, y:0, rotation:0, skew_x:0, skew_y:0, mirror_x:false, mirror_y:false, fit:'contain' as const, side:'left' as const, border:'photo' as const, crop:emptyCrop, enabled:false}
function validCorners(points:unknown):points is Corner[] {
  if (!Array.isArray(points)||points.length!==4||!points.every(p=>p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=240&&Math.abs(p.y)<=240)) return false
  return points.every((a,i)=>{const b=points[(i+1)%4],c=points[(i+2)%4];return (b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)>.01})
}
const savedFor = (settings:Settings,key:string) => settings.drafts?.[key] || settings.recipes[key]
function editable(saved?:Recipe):Recipe|null {
  if (!saved) return null
  if (saved.editor_version === 2) return {...defaults,...saved}
  // The legacy renderer uses 11.02 canvas units per mm and horizontal uploads.
  return {...defaults,...saved,editor_version:2,enabled:false,x:saved.x/11.02,y:saved.y/11.02,source_rotation:270}
}
function Numeric({label,value,min,max,step=.5,disabled=false,onChange}:{label:string;value:number;min:number;max:number;step?:number;disabled?:boolean;onChange:(n:number)=>void}) {
  const [draft,setDraft]=useState(String(value))
  useEffect(()=>setDraft(String(value)),[value])
  return <input className="rh-fit-number" disabled={disabled} aria-label={label} type="number" value={draft} min={min} max={max} step={step} onBlur={()=>setDraft(String(value))} onChange={e=>{const raw=e.target.value;setDraft(raw);if(raw==='')return;const n=Number(raw);if(Number.isFinite(n)&&n>=min&&n<=max)onChange(n)}}/>
}
async function api(path:string, body?:unknown) {
  return adminFetch(path,{...(body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})})
}
export default function HairClawEditor({productId,onStateChange,onRequestClose,headerAction,onSaved}:{productId:string;onStateChange?:(state:{dirty:boolean;busy:boolean})=>void;onRequestClose?:()=>void;headerAction?:ReactNode;onSaved?:()=>void}) {
  const [settings,setSettings] = useState<Settings>({revision:null,recipes:{}})
  const [images,setImages] = useState<ProductImage[]>([])
  const [slot,setSlot] = useState('4')
  const size=slot.split('-')[0]
  const [offerMode,setOfferMode]=useState(false)
  const [offerPrices,setOfferPrices]=useState<Record<string,OfferPrice>>({})
  const [price,setPrice]=useState('')
  const [recipe,setRecipe] = useState<Recipe|null>(null)
  const [origin,setOrigin] = useState('')
  const [color,setColor] = useState('taupe')
  const [notice,setNotice] = useState('Loading…')
  const [busy,setBusy] = useState(true)
  const [dirty,setDirty] = useState(false)
  const [interacting,setInteracting]=useState(false)
  const [guides,setGuides] = useState(true)
  const [errorLabel,setErrorLabel] = useState<string|null>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const previewRevision = useRef(0)
  const canvas = useRef<HTMLDivElement>(null)
  useEffect(()=>onStateChange?.({dirty,busy:busy||interacting}),[dirty,busy,interacting,onStateChange])
  useEffect(()=>{
    if(!dirty)return
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
    window.addEventListener('beforeunload',warn)
    return()=>window.removeEventListener('beforeunload',warn)
  },[dirty])
  let previewUrl=''
  try {const address=new URL(origin);if(['http:','https:'].includes(address.protocol)&&!address.username&&!address.password)previewUrl=`${address.origin}/previews/shared-hair-claw/embed.html?v=editor8`} catch {}
  const previewOrigin = previewUrl ? new URL(previewUrl).origin : ''
  useEffect(()=>{
    let active=true
    setBusy(true)
    api(`/admin/products/${productId}/hair-claw-media`).then(data=>{
      if (!active) return
      const nextSlot=data.offer_mode ? offers.find(([key])=>data.settings.recipes?.[key]?.enabled)?.[0] || '4-natural' : '4'
      setOfferMode(!!data.offer_mode);setOfferPrices(data.offer_prices||{});setPrice(data.offer_prices?.[nextSlot]?.amount==null?'':String(data.offer_prices[nextSlot].amount))
      setSettings(data.settings);setImages(data.images || []);setRecipe(editable(savedFor(data.settings,nextSlot)));setSlot(nextSlot);setDirty(false)
      setOrigin(data.preview_origin || '');setNotice('Choose a current product photo or upload wood artwork, then adjust its fit and save.')
      requestAnimationFrame(()=>{
        const studio=canvas.current?.closest('.rh-fit-studio')
        if(studio&&studio.clientWidth<700&&studio.getBoundingClientRect().top>80)studio.scrollIntoView({block:'start'})
      })
    }).catch(error=>{if(active){setNotice(error.message);setErrorLabel('Load failed')}}).finally(()=>active && setBusy(false))
    return ()=>{active=false}
  },[productId])
  useEffect(()=>{
    const element=canvas.current,studio=element?.closest('.rh-fit-studio')
    if(!element||!studio)return
    let animation=0
    const measure=()=>{
      cancelAnimationFrame(animation)
      animation=requestAnimationFrame(()=>{
        const viewport=Math.min(window.visualViewport?.height||window.innerHeight,element.closest('.rh-fit-dialog')?.getBoundingClientRect().bottom||Infinity)
        const foot=studio.querySelector('.rh-fit-canvas-foot')?.getBoundingClientRect().height||54
        const save=studio.querySelector('.rh-fit-savebar')?.getBoundingClientRect().height||65
        const available=viewport-Math.max(18,element.getBoundingClientRect().top)-foot-save-24
        const width=element.parentElement?.clientWidth||540
        const height=`${Math.floor(Math.max(240,Math.min(540,width,available)))}px`
        element.style.setProperty('--fit-canvas-size',height)
        element.closest('.rh-fit-edit-surfaces')?.setAttribute('style',`--fit-canvas-size:${height}`)
      })
    }
    const observer=new ResizeObserver(measure)
    observer.observe(studio)
    for(const target of [element.parentElement,studio.querySelector('.rh-fit-savebar')])if(target)observer.observe(target)
    window.addEventListener('resize',measure)
    window.addEventListener('scroll',measure,{passive:true})
    window.visualViewport?.addEventListener('resize',measure)
    measure()
    return()=>{cancelAnimationFrame(animation);observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure);window.visualViewport?.removeEventListener('resize',measure)}
  },[productId])
  const preview = useCallback(()=>{
    if (previewOrigin && recipe) frame.current?.contentWindow?.postMessage({type:'hair-claw-preview',recipe,size,color,outline:guides,editable:!busy,workspacePhoto:true,editRevision:previewRevision.current},previewOrigin)
  },[recipe,size,color,previewOrigin,busy,guides])
  const change = useCallback((patch:Partial<Recipe>)=>{
    setRecipe(current=>{
      if (!current) return null
      const next={...current,...patch,enabled:patch.enabled ?? false}
      if(current.corners&&!Object.prototype.hasOwnProperty.call(patch,'corners')&&(patch.x!==undefined||patch.y!==undefined)) {
        const dx=next.x-current.x,dy=next.y-current.y
        next.corners=current.corners.map(p=>({x:p.x+dx,y:p.y+dy}))
        if(!validCorners(next.corners))return current
      }
      return next
    });setDirty(true);setErrorLabel(null)
  },[])
  useEffect(()=>{
    preview()
    const receive=(event:MessageEvent)=>{
      if (event.source !== frame.current?.contentWindow || event.origin !== previewOrigin) return
      if (event.data?.type === 'hair-claw-interaction') {setInteracting(event.data.active===true);if(event.data.active)setDirty(true)}
      if (event.data?.type === 'hair-claw-editor-close') onRequestClose?.()
      if (event.data?.type === 'hair-claw-preview-ready') preview()
      if (event.data?.type === 'hair-claw-preview-error') {setNotice('Preview could not load. Choose another photo or check the preview connection.');setErrorLabel('Preview unavailable')}
      if (event.data?.type === 'hair-claw-placement' && !busy) {
        const revision=event.data.editRevision
        if (!Number.isSafeInteger(revision)||revision<previewRevision.current)return
        const p=event.data.patch
        if (!p || typeof p !== 'object') return
        const patch:Partial<Recipe>={}
        for (const [key,min,max] of [['x',-120,120],['y',-120,120],['scale',.1,3],['rotation',-180,180]] as const) {
          if (typeof p[key] === 'number' && Number.isFinite(p[key])) patch[key]=Math.min(max,Math.max(min,p[key]))
        }
        if (validCorners(p.corners)) patch.corners=p.corners.map((p:Corner)=>({x:p.x,y:p.y}))
        if (Object.keys(patch).length){previewRevision.current=revision;change(patch)}
      }
    }
    window.addEventListener('message',receive)
    return ()=>window.removeEventListener('message',receive)
  },[preview,previewOrigin,busy,change,onRequestClose])
  async function choosePhoto(photo:ProductImage) {
    setBusy(true)
    try {
      const dimensions=await new Promise<{width:number;height:number}>((resolve,reject)=>{
        const img=new Image();const timer=window.setTimeout(()=>reject(Error('Photo did not load. Try another image.')),15000)
        img.onload=()=>{window.clearTimeout(timer);resolve({width:img.naturalWidth,height:img.naturalHeight})}
        img.onerror=()=>{window.clearTimeout(timer);reject(Error('Photo could not load.'))};img.src=photo.url
      })
      if (!dimensions.width || !dimensions.height || Math.max(dimensions.width,dimensions.height)>6000) throw Error('Use a photo no larger than 6000 pixels per side.')
      setRecipe({...defaults,...dimensions,image_id:photo.id,url:photo.url,source_rotation:0,vertical:true})
      setDirty(true);setErrorLabel(null);setNotice('Crop the source photo and fit its corners in this workspace. One placement is shared by every preview color.')
    } catch(error) {setNotice((error as Error).message);setErrorLabel('Photo unavailable')} finally {setBusy(false)}
  }
  async function save(enable=false) {
    setBusy(true)
    try {
      const clean=recipe ? {...Object.fromEntries(Object.entries(recipe).filter(([key])=>!['url','template','finish'].includes(key))),enabled:enable&&size==='4'} : null
      if(offerMode&&(!price.trim()||!Number.isFinite(Number(price))||Number(price)<0))throw Error('Enter a valid USD price for this size and finish.')
      const result=await api(`/admin/products/${productId}/hair-claw-media`,{size,revision:settings.revision,recipe:clean,...(offerMode?{finish:slot.split('-')[1],price:Number(price),pricing_revision:offerPrices[slot]?.revision||null}:{})})
      setSettings(result.settings);setRecipe(editable(savedFor(result.settings,slot)));setDirty(false)
      if(result.offer_prices){setOfferPrices(result.offer_prices);setPrice(result.offer_prices[slot]?.amount==null?'':String(result.offer_prices[slot].amount))}
      setErrorLabel(null);onSaved?.()
      setNotice(!recipe ? offerMode?'Price saved. This option stays hidden without an enabled overlay.':'Overlay setting removed. Original photos and the approved gallery remain available.' : enable&&size==='4' ? offerMode?'Option saved with its own price and artwork. All claw colors use this fit.':'Image fit saved. All configured colors use the same artwork.' : 'Draft saved. The current storefront preview stays in place until you save the reviewed fit.')
    } catch(error) {setNotice((error as Error).message);setErrorLabel('Save failed')} finally {setBusy(false)}
  }
  const locked=!!recipe?.corners
  const state=errorLabel?'error':dirty?'dirty':recipe?.enabled?'enabled':'draft'
  const stateLabel=busy?'Working…':errorLabel|| (dirty?'Unsaved changes':recipe?.enabled?'Enabled':'Draft')
  const colorHex=['#222222','#3b302c','#6a5143','#81563f','#ae7d4e','#bd956b','#927f6f','#d4b995','#eee8dd','#929292','#b35e46','#bd8582','#735079'][palette.findIndex(name=>name.toLowerCase()===color)]
  const cornerHelp='Drag each square corner to its place. The other three stay pinned. Drag the image to move all four together. Arrow keys nudge the selected corner; hold Shift for larger steps.'
  const lockedHelp='Four-corner fitting is active. Reset corners to use scale, rotation, fit mode and skew again.'
  return <TooltipProvider><section className="rh-fit-studio" aria-label="Hair-claw image fitting">
    <header className={`rh-fit-header${offerMode?' rh-fit-offer-header':''}`}>
      <div className="rh-fit-heading"><span className="rh-fit-heading-mark"><FitIcon name="corners"/></span><h2>Image fitting</h2><FitHelp label="Image fitting">Choose a current product photo or upload artwork. Crop to the wood, place the corners, then save. Your original photos stay unchanged.</FitHelp></div>
      <div className="rh-fit-header-actions"><label className="rh-fit-size"><span>{offerMode?"Option":"Size"}</span><select aria-label={offerMode?"Size and finish":"Physical size"} disabled={busy||dirty} value={slot} onChange={e=>{setSlot(e.target.value);setRecipe(editable(savedFor(settings,e.target.value)));setPrice(offerPrices[e.target.value]?.amount==null?"":String(offerPrices[e.target.value].amount));setErrorLabel(null)}}>{offerMode?offers.map(([key,label])=><option key={key} value={key}>{label}{settings.recipes[key]?.enabled?" · Available":" · Hidden"}</option>):<><option value="2">2 inch</option><option value="4">4 inch</option></>}</select><FitHelp label="Physical size">{dirty?'Save or discard your changes before switching size.':size==='2'?'2-inch fits can be saved as drafts. Color previews are pending the measured plastic template.':'Each size and finish has its own fit and price.'}</FitHelp></label>{headerAction}</div>
    </header>
    {offerMode&&<div className="rh-fit-canvas-bar"><label className="rh-fit-field">Price (USD)<input aria-label="Option price USD" type="number" min="0" step="0.01" disabled={busy} value={price} onChange={e=>{setPrice(e.target.value);setDirty(true);setErrorLabel(null)}}/></label><span>{settings.recipes[slot]?.enabled?"Available with its own overlay":"Hidden until an overlay is enabled"}</span><FitHelp label="Option price">This price applies to every claw color for this size and finish. Save publishes the fit and price together. Save draft keeps the current storefront fit and price.</FitHelp></div>}
    <div className="rh-fit-workspace">
      <section className="rh-fit-canvas-panel" aria-label="Photo cropping and corner fitting">
        <div className="rh-fit-canvas-bar">
          <div className="rh-fit-mode"><FitIcon name="image"/><span>Source & fit</span><FitHelp label="Source and fit">Crop the untouched photo on the left, then drag the fitted artwork corners on the right. Both stay open; changing guides or color keeps this workspace.</FitHelp></div>
          <div className="rh-fit-color-select"><span className="rh-fit-swatch" style={{background:colorHex}}/><select aria-label="Preview color" value={color} onChange={e=>setColor(e.target.value)}>{palette.map(name=><option key={name} value={name.toLowerCase()}>{name}</option>)}</select><FitHelp label="Preview color">The same artwork fit is used for every claw color. The wood and engraving stay unchanged.</FitHelp></div>
        </div>
        <div className="rh-fit-edit-surfaces">
          <section className="rh-fit-surface" aria-label="Source crop">
            <div className="rh-fit-surface-title"><FitIcon name="crop"/><span>Crop photo</span><FitHelp label="Crop photo">Draw around the wood or drag the crop squares. The original file is preserved. Cropping updates the fitted artwork without moving its pinned corners.</FitHelp></div>
            <div className="rh-fit-source-canvas">{recipe?<HairClawCrop url={recipe.url} width={recipe.width} height={recipe.height} value={recipe.crop||emptyCrop} disabled={busy} onWorking={setInteracting} onCommit={crop=>change({crop})}/>:<div className="rh-fit-empty">Choose a photo</div>}</div>
          </section>
          <section className="rh-fit-surface" aria-label="Fitted artwork">
            <div className="rh-fit-surface-title"><FitIcon name="corners"/><span>Fit artwork</span><FitHelp label="Fit artwork">Drag one square at a time. Your photo stays visible over the fixed claw guides. Fit view changes only the camera.</FitHelp></div>
            <div className="rh-fit-canvas" ref={canvas}>
              {recipe&&size==='4'&&previewUrl&&<iframe ref={frame} src={previewUrl} title="Interactive hair-claw image fitting" onLoad={()=>{previewRevision.current=0;preview()}}/>}
              {(!recipe||size==='2'||!previewUrl)&&<div className="rh-fit-empty"><FitIcon name="image"/><span>{!recipe?'Choose a photo':size==='2'?'2-inch draft':'Connect preview'}</span><FitHelp label="Preview availability">{!recipe?'Choose a current product photo.':size==='2'?'Color previews await the measured 2-inch physical template.':'Set the storefront origin under Connection.'}</FitHelp></div>}
            </div>
          </section>
        </div>
        <div className="rh-fit-canvas-foot">
          <div className="rh-fit-mode"><FitIcon name="corners"/><span>{locked?'Corners pinned':'Place corners'}</span><FitHelp label="Corner fitting">{cornerHelp}</FitHelp></div>
          <div className="rh-fit-toolrow"><FitHint tip="Bring the claw and all four artwork corners into view. Crop and placement stay unchanged."><button type="button" className="rh-fit-button" disabled={busy||!recipe} onClick={()=>frame.current?.contentWindow?.postMessage({type:'hair-claw-fit-view'},previewOrigin)}>Fit view</button></FitHint><FitHint tip="Toggle fixed cut and engraving guides in this workspace."><button type="button" className="rh-fit-button" aria-pressed={guides} onClick={()=>setGuides(!guides)}>Guides</button></FitHint><FitHint tip="Remove corner pinning to use scale and rotation again."><button type="button" className="rh-fit-quiet" aria-label="Reset corner fit" disabled={busy||!locked} onClick={()=>change({corners:undefined})}><FitIcon name="reset"/>Reset corners</button></FitHint></div>
        </div>
      </section>
      <section className="rh-fit-inspector" aria-label="Image adjustments">
        <section className="rh-fit-card" aria-label="Current product pictures">
          <div className="rh-fit-card-title"><h3><FitIcon name="image"/>Photo</h3><FitHelp label="Source photo">Select a current product photo. Saved fits and drafts can be restored below. The original file is preserved.</FitHelp></div>
          <div className="rh-fit-photos">{images.map((image,i)=><FitHint key={image.id} tip={`Use product photo ${i+1}. Crop any background and original plastic before fitting.`}><button type="button" className="rh-fit-photo" disabled={busy} aria-label={`Use photo ${i+1}`} aria-pressed={recipe?.image_id===image.id} onClick={()=>void choosePhoto(image)}><img src={image.url} alt={`Product photo ${i+1}`}/>{recipe?.image_id===image.id&&<span className="rh-fit-photo-check"><FitIcon name="check"/></span>}</button></FitHint>)}</div>
          <div className="rh-fit-restore">{offerMode&&settings.recipes[size]&&<FitHint tip="Bring the previous size-only fit into this specific finish for review. Set its price and save to enable it."><button type="button" className="rh-fit-quiet" disabled={busy} onClick={()=>{setRecipe(editable(settings.recipes[size]));setDirty(true);setErrorLabel(null);setNotice("Previous size-only fit restored for this option. Review the finish and price before saving.")}}>Previous size-only fit</button></FitHint>}{settings.recipes[slot]&&<FitHint tip="Restore the currently enabled overlay for this size."><button type="button" className="rh-fit-quiet" disabled={busy} onClick={()=>{setRecipe(editable(settings.recipes[slot]));setDirty(true);setErrorLabel(null);setNotice('Saved overlay restored for review.')}}>Saved fit</button></FitHint>}{settings.drafts?.[slot]&&<FitHint tip="Restore your last saved draft for this size."><button type="button" className="rh-fit-quiet" disabled={busy} onClick={()=>{setRecipe(editable(settings.drafts?.[slot]));setDirty(true);setErrorLabel(null);setNotice('Saved draft restored for review.')}}>Saved draft</button></FitHint>}</div>
        </section>
        {recipe&&<>
          <section className="rh-fit-card" aria-label="Layout controls">
            <div className="rh-fit-card-title"><h3><FitIcon name="corners"/>Layout</h3><FitHelp label="Layout">Handle side mirrors the complete claw. Artwork mirroring below changes only the cropped design, keeping the handle and fitted corners in place.</FitHelp></div>
            <div className="rh-fit-fields">
              <label className="rh-fit-field">Handle<select aria-label="Handle side" disabled={busy} value={recipe.side} onChange={e=>change({side:e.target.value as Recipe['side']})}><option value="left">Left</option><option value="right">Right</option></select></label>
              <label className="rh-fit-field">View<select aria-label="Preview orientation" disabled={busy} value={recipe.vertical?'upright':'sideways'} onChange={e=>change({vertical:e.target.value==='upright'})}><option value="upright">Upright</option><option value="sideways">Sideways</option></select></label>
              <label className="rh-fit-field rh-fit-field-wide">Border<select aria-label="Engraved border" disabled={busy} value={recipe.border} onChange={e=>change({border:e.target.value as Recipe['border']})}><option value="photo">Photo engraving</option><option value="template">Template engraving</option><option value="none">No added border</option></select></label>
            </div>
            <div className="rh-fit-mirrors"><FitHint tip="Mirror the artwork horizontally. The handle side and corner placement stay unchanged."><button type="button" className="rh-fit-button" disabled={busy} aria-label="Mirror artwork horizontally" aria-pressed={recipe.mirror_x===true} onClick={()=>change({mirror_x:!recipe.mirror_x})}><FitIcon name="flipH"/>Flip H</button></FitHint><FitHint tip="Mirror the artwork vertically. The handle side and corner placement stay unchanged."><button type="button" className="rh-fit-button" disabled={busy} aria-label="Mirror artwork vertically" aria-pressed={recipe.mirror_y===true} onClick={()=>change({mirror_y:!recipe.mirror_y})}><FitIcon name="flipV"/>Flip V</button></FitHint></div>
          </section>
          <details className="rh-fit-accordion"><summary><span><FitIcon name="crop"/>Crop</span><FitIcon name="arrow"/></summary><div className="rh-fit-accordion-body">
            <div className="rh-fit-subtitle">Source edges<FitHelp label="Crop source">Trim the source background and original plastic handle before fitting the wood. Percentages are measured from the original photo. Your original stays unchanged.</FitHelp></div>
            {(['top','bottom','left','right'] as const).map(edge=>{
              const crop=recipe.crop||emptyCrop,other={top:'bottom',bottom:'top',left:'right',right:'left'}[edge] as keyof Crop
              return <label className="rh-fit-adjustment" key={edge}><span>{edge[0].toUpperCase()+edge.slice(1)} (%)</span><Numeric disabled={busy} label={`Crop ${edge} percent`} value={crop[edge]} min={0} max={Math.min(90,94-crop[other])} onChange={n=>change({crop:{...crop,[edge]:n}})}/><input disabled={busy} aria-label={`Crop ${edge}`} type="range" min="0" max={Math.min(90,94-crop[other])} step="0.5" value={crop[edge]} onChange={e=>change({crop:{...crop,[edge]:Number(e.target.value)}})}/></label>
            })}<button type="button" className="rh-fit-quiet" disabled={busy} onClick={()=>change({crop:emptyCrop})}><FitIcon name="reset"/>Reset crop</button>
          </div></details>
          <details className="rh-fit-accordion"><summary><span><FitIcon name="tune"/>Fine tune</span><FitIcon name="arrow"/></summary><div className="rh-fit-accordion-body">
            <div className="rh-fit-subtitle">Placement<FitHelp label="Placement">{locked?lockedHelp:'Scale, rotate or move the cropped image before placing its corners. Position is measured in millimetres.'}</FitHelp></div>
            <label className="rh-fit-field">Fit mode<select aria-label="Fit mode" disabled={busy||locked} value={recipe.fit} onChange={e=>change({fit:e.target.value as Recipe['fit']})}><option value="contain">Keep whole design</option><option value="cover">Fill to edges</option></select></label>
            <label className="rh-fit-adjustment"><span>Scale (%)</span><Numeric disabled={busy||locked} label="Scale percent" value={Math.round(recipe.scale*1000)/10} min={10} max={300} onChange={n=>change({scale:n/100})}/><input disabled={busy||locked} aria-label="Artwork scale" type="range" min="0.1" max="3" step="0.005" value={recipe.scale} onChange={e=>change({scale:Number(e.target.value)})}/></label>
            <label className="rh-fit-adjustment"><span>Rotation (°)</span><Numeric disabled={busy||locked} label="Rotation degrees" value={recipe.rotation||0} min={-180} max={180} onChange={rotation=>change({rotation})}/><input disabled={busy||locked} aria-label="Artwork rotation" type="range" min="-180" max="180" step="0.5" value={recipe.rotation} onChange={e=>change({rotation:Number(e.target.value)})}/></label>
            <div className="rh-fit-fields">{(['x','y'] as const).map(axis=><label className="rh-fit-field" key={axis}>{axis.toUpperCase()} (mm)<Numeric disabled={busy} label={`${axis==='x'?'Horizontal':'Vertical'} position`} value={recipe[axis]} min={-120} max={120} step={.1} onChange={n=>change({[axis]:n})}/></label>)}</div>
            <div className="rh-fit-toolrow"><FitHint tip={locked?lockedHelp:'Rotate the source photo by a quarter turn.'}><button type="button" className="rh-fit-button" disabled={busy||locked} onClick={()=>change({source_rotation:(((recipe.source_rotation||0)+90)%360) as Recipe['source_rotation']})}><FitIcon name="rotate"/>90°</button></FitHint><FitHint tip="Reset placement and corner fitting. Crop and artwork mirroring are kept."><button type="button" className="rh-fit-quiet" disabled={busy} onClick={()=>change({corners:undefined,scale:1,x:0,y:0,rotation:0,skew_x:0,skew_y:0})}><FitIcon name="reset"/>Reset placement</button></FitHint></div>
            <div className="rh-fit-divider"/><div className="rh-fit-subtitle">Skew<FitHelp label="Skew">{locked?lockedHelp:'Skew tilts the cropped image along one axis. Zero preserves the original proportions.'}</FitHelp></div>
            {(['skew_x','skew_y'] as const).map(axis=><label className="rh-fit-adjustment" key={axis}><span>{axis==='skew_x'?'Horizontal':'Vertical'} (°)</span><Numeric disabled={busy||locked} label={`${axis==='skew_x'?'Horizontal':'Vertical'} skew degrees`} value={recipe[axis]||0} min={-35} max={35} onChange={n=>change({[axis]:n})}/><input disabled={busy||locked} aria-label={`${axis==='skew_x'?'Horizontal':'Vertical'} skew`} type="range" min="-35" max="35" step="0.5" value={recipe[axis]} onChange={e=>change({[axis]:Number(e.target.value)})}/></label>)}
            <button type="button" className="rh-fit-quiet" disabled={busy||locked} onClick={()=>change({skew_x:0,skew_y:0})}><FitIcon name="reset"/>Reset skew</button>
          </div></details>
        </>}
        <details className="rh-fit-accordion"><summary><span><FitIcon name="upload"/>Upload photo</span><FitIcon name="arrow"/></summary><div className="rh-fit-accordion-body"><HairClawPhotoUpload key={`${productId}-${size}`} size={size} disabled={busy} onWorking={setBusy} onAccept={result=>{setRecipe({...result,...defaults,source_rotation:result.vertical?270:0,vertical:true});setDirty(true);setErrorLabel(null);setNotice('Prepared overlay loaded. Adjust its fit, then review and save.')}}/></div></details>
        <details className="rh-fit-accordion"><summary><span><FitIcon name="link"/>Connection</span><FitIcon name="arrow"/></summary><div className="rh-fit-accordion-body"><div className="rh-fit-subtitle">Storefront<FitHelp label="Preview connection">The storefront origin serves the shared fitting canvas. Use the local or staging storefront address.</FitHelp></div><label className="rh-fit-field">Origin<input type="url" aria-label="Storefront origin" value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="https://staging.rustichalo.com"/></label><FitHint tip="Remove only the saved fit for this size when you next save. Product photos and original files are kept."><button type="button" className="rh-fit-quiet" disabled={busy||(!recipe&&!savedFor(settings,slot))} onClick={()=>{setRecipe(null);setDirty(true);setErrorLabel(null)}}><FitIcon name="trash"/>Remove fit</button></FitHint></div></details>
      </section>
    </div>
    <footer className="rh-fit-savebar">
      <div className="rh-fit-status" data-state={state}><span className="rh-fit-status-dot"/><span>{stateLabel}</span><FitHelp label="Status">{notice}</FitHelp><span className="rh-fit-sr" role={errorLabel?'alert':'status'} aria-live={errorLabel?'assertive':'polite'}>{notice}</span></div>
      <div className="rh-fit-mode"><FitIcon name="check"/><span>{size==='4'?'One fit · all colors':'2-inch draft'}</span><FitHelp label="All colors">Save applies this artwork fit to the storefront. Every configured claw color, including colors added later, reuses the same corners, crop and mirrors. Save draft keeps unfinished adjustments private.</FitHelp></div>
      <div className="rh-fit-save-actions"><FitHint tip="Restore the last saved fit or draft."><button type="button" className="rh-fit-quiet" disabled={busy||interacting||!dirty} onClick={()=>{setRecipe(editable(savedFor(settings,slot)));setPrice(offerPrices[slot]?.amount==null?"":String(offerPrices[slot].amount));setDirty(false);setErrorLabel(null);setNotice('Saved settings restored.')}}>Discard</button></FitHint>{size==='4'&&recipe&&<button type="button" className="rh-fit-button" disabled={busy||interacting||!dirty} onClick={()=>void save(false)}>Save draft</button>}<button type="button" className="rh-fit-button rh-fit-primary" disabled={busy||interacting||!dirty} onClick={()=>void save(size==='4')}>{busy?'Working…':!recipe||size==='4'?'Save':'Save draft'}</button></div>
    </footer>
  </section></TooltipProvider>
}

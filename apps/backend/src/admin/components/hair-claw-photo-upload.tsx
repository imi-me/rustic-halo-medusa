import { useState } from 'react'
import { Button, Text } from '@medusajs/ui'

type Candidate={content:string;original_preview:string;width:number;height:number;vertical:boolean;warnings:string[]}
const initial={tolerance:40,rotation:0,crop:{top:0,bottom:0,left:0,right:0}}
const checker={backgroundColor:'#fff',backgroundImage:'conic-gradient(#ddd 25%, transparent 0 50%, #ddd 0 75%, transparent 0)',backgroundSize:'20px 20px',borderRadius:8,padding:12}
async function post(path:string,body:unknown) {
  const response=await fetch(path,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  const data=await response.json()
  if(!response.ok)throw Error(data.message || 'Photo processing failed.')
  return data
}
export default function HairClawPhotoUpload({size,disabled,onAccept,onWorking}:{size:string;disabled:boolean;onAccept:(value:any)=>void;onWorking:(busy:boolean)=>void}) {
  const [source,setSource]=useState(''),[name,setName]=useState(''),[candidate,setCandidate]=useState<Candidate|null>(null)
  const [options,setOptions]=useState(initial),[changed,setChanged]=useState(false),[reviewed,setReviewed]=useState(false)
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const working=(value:boolean)=>{setBusy(value);onWorking(value)}
  async function prepare(content=source,settings=options) {
    working(true);setMessage('Preparing photo…');setReviewed(false)
    try {
      const result=await post('/admin/hair-claw-media/prepare',{content,options:{...settings,size}})
      setCandidate(result);setChanged(false);setMessage('Review the cutout below. Nothing has replaced your saved overlay.')
    } catch(error){setCandidate(null);setMessage((error as Error).message)} finally{working(false)}
  }
  async function choose(file?:File) {
    if(!file)return
    if(file.size>24_000_000 || !(/\.(heic|heif|jpe?g|png)$/i.test(file.name)||['image/heic','image/heif','image/jpeg','image/png'].includes(file.type))){setMessage('Choose a HEIC, JPG or PNG under 24 MB.');return}
    setCandidate(null);setName(file.name);setOptions(initial);setReviewed(false)
    try {
      const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Could not read this photo.'));reader.readAsDataURL(file)})
      setSource(content);await prepare(content,initial)
    } catch(error){setMessage((error as Error).message)}
  }
  async function accept() {
    if(!candidate || !reviewed || changed)return
    working(true)
    try {
      const result=await post('/admin/hair-claw-media/upload',{content:candidate.content})
      onAccept({...result,vertical:candidate.vertical})
      setCandidate(null);setSource('');setName('');setMessage('Cutout ready. Review placement and save the overlay below.')
    } catch(error){setMessage((error as Error).message)}finally{working(false)}
  }
  function adjust(next:typeof options){setOptions(next);setChanged(true);setReviewed(false)}
  return <section aria-label="Upload and prepare a wood photo" className="space-y-4">
    <div style={{border:'2px dashed #aaa',borderRadius:12,padding:24}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy&&!disabled)void choose(e.dataTransfer.files[0])}}>
      <label style={{display:'block',fontWeight:600}}>Upload a photo
        <input className="block mt-3" disabled={busy||disabled} type="file" accept="image/heic,image/heif,image/jpeg,image/png,.heic,.heif,.jpg,.jpeg,.png" onChange={e=>{void choose(e.target.files?.[0]);e.target.value=''}} />
      </label>
      <Text>Choose from Photos or drop a HEIC, JPG, or PNG here (up to 24 MB / 60 MP).</Text>
      <Text>Photograph the wood alone, straight-on, on a plain contrasting surface. Leave background visible around every edge.</Text>
      <Text>Your original stays in Photos. The server processes it temporarily; only the approved, metadata-free cutout is stored as product media.</Text>
    </div>
    <p role="status" aria-live="polite">{message}{name ? ` — ${name}`:''}</p>
    {source && <details><summary>Adjust background cleanup or crop</summary>
      <label className="block">Cleanup strength: {options.tolerance}<input disabled={busy} type="range" min="10" max="100" value={options.tolerance} onChange={e=>adjust({...options,tolerance:Number(e.target.value)})}/></label>
      <label className="block">Straighten: {options.rotation}°<input disabled={busy} type="range" min="-15" max="15" step="0.5" value={options.rotation} onChange={e=>adjust({...options,rotation:Number(e.target.value)})}/></label>
      <Text>Crop percentages are measured from the upright original photo. Keep a little background around the wood.</Text>
      {(['top','bottom','left','right'] as const).map(edge=><label className="block" key={edge}>Crop {edge}: {options.crop[edge]}%<input disabled={busy} type="range" min="0" max="45" value={options.crop[edge]} onChange={e=>adjust({...options,crop:{...options.crop,[edge]:Number(e.target.value)}})}/></label>)}
      <Button disabled={busy} variant="secondary" onClick={()=>prepare()}>Apply cleanup</Button>
    </details>}
    {candidate && <>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>
        <figure><figcaption>Original photo (crop)</figcaption><img src={`data:image/png;base64,${candidate.original_preview}`} alt="Original wood photo before background removal" style={{width:'100%',maxHeight:350,objectFit:'contain'}}/></figure>
        <figure><figcaption>Prepared wood overlay</figcaption><div style={checker}><img src={`data:image/png;base64,${candidate.content}`} alt="Prepared transparent wood cutout for edge review" style={{width:'100%',maxHeight:350,objectFit:'contain'}}/></div></figure>
      </div>
      {candidate.warnings.map(w=><p key={w} style={{color:'#92400e'}}>{w}</p>)}
      <Text>Check all edges and engraving. Plain-background cleanup is not guaranteed on patterned backgrounds or photos of the whole assembled claw.</Text>
      {changed && <Text>Apply your cleanup changes before accepting.</Text>}
      <label className="block"><input type="checkbox" disabled={busy||changed} checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> I checked the edges and the complete wood design.</label>
      <Button disabled={busy||changed||!reviewed} onClick={accept}>Use this overlay</Button>
    </>}
    {source && <Button variant="secondary" disabled={busy} onClick={()=>{setCandidate(null);setSource('');setMessage('Photo discarded; saved overlay unchanged.');setName('')}}>Cancel photo</Button>}
  </section>
}

import { useState } from 'react'
import { FitHelp, FitIcon, FitHint } from './hair-claw-ui'

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
  return <section aria-label="Upload and prepare a wood photo" style={{display:'grid',gap:12}}>
    <label className="rh-fit-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy&&!disabled)void choose(e.dataTransfer.files[0])}}>
      <FitIcon name="upload"/><span>Choose or drop a photo</span>
      <input className="rh-fit-sr" aria-label="Upload a photo" disabled={busy||disabled} type="file" accept="image/heic,image/heif,image/jpeg,image/png,.heic,.heif,.jpg,.jpeg,.png" onChange={e=>{void choose(e.target.files?.[0]);e.target.value=''}}/>
    </label>
    <div className="rh-fit-upload-status"><span>{name||'HEIC · JPG · PNG'}</span><FitHelp label="Photo upload">Use a photo up to 24 MB / 60 MP. Photograph the wood alone, straight-on, on a plain contrasting surface with background around each edge. Your original stays unchanged; only the reviewed, metadata-free cutout is stored.</FitHelp></div>
    {message&&<div className="rh-fit-upload-status"><span>{busy?'Preparing…':candidate?'Ready to review':source?'Check photo':'Photo status'}</span><FitHelp label="Photo status">{message}</FitHelp><span className="rh-fit-sr" role="status" aria-live="polite">{message}</span></div>}
    {source&&<details className="rh-fit-accordion"><summary><span><FitIcon name="tune"/>Cleanup</span><FitIcon name="arrow"/></summary><div className="rh-fit-accordion-body">
      <div className="rh-fit-subtitle">Background<FitHelp label="Background cleanup">Crop percentages are measured from the upright original photo. Keep a little background around the wood. Apply changes before accepting the cutout.</FitHelp></div>
      <label className="rh-fit-adjustment"><span>Strength</span><span style={{textAlign:'right'}}>{options.tolerance}</span><input aria-label="Cleanup strength" disabled={busy} type="range" min="10" max="100" value={options.tolerance} onChange={e=>adjust({...options,tolerance:Number(e.target.value)})}/></label>
      <label className="rh-fit-adjustment"><span>Straighten (°)</span><span style={{textAlign:'right'}}>{options.rotation}</span><input aria-label="Photo straightening" disabled={busy} type="range" min="-15" max="15" step="0.5" value={options.rotation} onChange={e=>adjust({...options,rotation:Number(e.target.value)})}/></label>
      {(['top','bottom','left','right'] as const).map(edge=><label className="rh-fit-adjustment" key={edge}><span>{edge[0].toUpperCase()+edge.slice(1)} (%)</span><span style={{textAlign:'right'}}>{options.crop[edge]}</span><input aria-label={`Cleanup crop ${edge}`} disabled={busy} type="range" min="0" max="45" value={options.crop[edge]} onChange={e=>adjust({...options,crop:{...options.crop,[edge]:Number(e.target.value)}})}/></label>)}
      <button type="button" className="rh-fit-button" disabled={busy} onClick={()=>prepare()}>Apply cleanup</button>
    </div></details>}
    {candidate&&<>
      <div className="rh-fit-upload-comparison">
        <figure><figcaption>Original</figcaption><img src={`data:image/png;base64,${candidate.original_preview}`} alt="Original wood photo before background removal"/></figure>
        <figure><figcaption>Cutout</figcaption><div style={checker}><img src={`data:image/png;base64,${candidate.content}`} alt="Prepared transparent wood cutout for edge review"/></div></figure>
      </div>
      {candidate.warnings.length>0&&<div className="rh-fit-warning">Review edges<FitHelp label="Cutout warnings">{candidate.warnings.join(' ')}</FitHelp></div>}
      {changed&&<div className="rh-fit-warning">Cleanup changed<FitHelp label="Pending cleanup">Apply your cleanup changes before accepting the cutout.</FitHelp></div>}
      <div className="rh-fit-toolrow"><label className="rh-fit-publish"><input type="checkbox" disabled={busy||changed} checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>Edges reviewed</label><FitHelp label="Review cutout">Check every edge and the complete wood design. Plain-background cleanup may be unsuitable for patterned backgrounds or assembled-claw photos.</FitHelp></div>
      <FitHint tip="Use the reviewed cutout in the fitting canvas. Save the fit separately when ready."><button type="button" className="rh-fit-button rh-fit-primary" disabled={busy||changed||!reviewed} onClick={accept}>Use cutout</button></FitHint>
    </>}
    {source&&<button type="button" className="rh-fit-quiet" disabled={busy} onClick={()=>{setCandidate(null);setSource('');setMessage('Photo discarded; saved overlay unchanged.');setName('')}}>Cancel photo</button>}
  </section>
}

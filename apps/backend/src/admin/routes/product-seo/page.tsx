import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminFetch } from '../../lib/admin-fetch'
import '../../styles/blue-admin.css'
import './product-seo.css'
type Seo = {title:string;description:string}
type Row = {id:string;title:string;handle:string;productStatus:string;status:string;before:Seo;automatic:Seo;suggestion?:Seo;error?:string}
type State = {ready:boolean;revision:string;run:null|{id:string;rows:Row[]};catalog?:{total:number;needsWording:number}}
const statusLabel:Record<string,string>={pending:'Waiting',generating:'Rusty is writing',ready:'Ready to review',saved:'Saved',failed:'Needs retry',stale:'Product changed',skipped:'Kept unchanged'}
const icon=()=> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"/></svg>
const ProductSeoPage=()=>{
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[selected,setSelected]=useState<string[]>([]),[edits,setEdits]=useState<Record<string,Seo>>({}),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[page,setPage]=useState(0),[progress,setProgress]=useState('')
 const rows=state?.run?.rows||[],generating=rows.some(r=>r.status==='pending'||r.status==='generating'),ready=rows.filter(r=>r.status==='ready'),saved=rows.filter(r=>r.status==='saved'),attention=rows.filter(r=>r.status==='failed'||r.status==='stale')
 const load=async()=>{try{setState(await adminFetch('/admin/product-seo'));setError('')}catch(e){setError((e as Error).message)}}
 useEffect(()=>{void load()},[])
 useEffect(()=>{if(!generating||busy)return;const timer=setInterval(()=>void load(),15000);return()=>clearInterval(timer)},[generating,busy])
 const request=async(body:unknown):Promise<State>=>{return adminFetch('/admin/product-seo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
 const action=async(kind:'start'|'stop'|'discard'|'retry')=>{
  if(!state||busy)return
  if(kind==='discard'&&!window.confirm('Discard this review? Saved product wording will stay. Unsaved suggestions will be removed.'))return
  setBusy(kind);setError('');setProgress('')
  try{const next=await request({action:kind,revision:state.revision});setState(next);if(kind==='start'||kind==='discard'){setSelected([]);setEdits({});setPage(0)}if(kind==='discard')await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}
 }
 const save=async()=>{
  if(!state?.run||busy)return
  const values=ready.filter(r=>selected.includes(r.id)).map(r=>({id:r.id,...(edits[r.id]||r.suggestion!)}))
  if(!values.length)return
  if(values.some(v=>!v.title.trim()||!v.description.trim())){setError('Fill both fields for selected suggestions, or uncheck that product.');return}
  setBusy('apply');setError('');let completed=0
  try{for(let index=0;index<values.length;index+=20){const next=await request({action:'apply',run_id:state.run.id,products:values.slice(index,index+20)});setState(next);completed+=Math.min(20,values.length-index);setProgress(`Checked ${completed} of ${values.length} selected products.`)}setSelected([]);setEdits({});setProgress('Save finished. Any products that changed are marked for a fresh suggestion.')}catch(e){setError((e as Error).message);setProgress('Some products may already be saved. Refresh to check their status before continuing.');await load()}finally{setBusy('')}
 }
 const filtered=rows.filter(r=>(!query||r.title.toLowerCase().includes(query.toLowerCase()))&&(filter==='all'||filter==='attention'?filter!=='attention'||['failed','stale'].includes(r.status):r.status===filter)),visible=filtered.slice(page*25,page*25+25),count=ready.filter(r=>selected.includes(r.id)).length
 return <div className="rh-bulk-seo">
  <header><p className="rh-bulk-eyebrow">ASK RUSTY · PRODUCT SEARCH</p><h1>Search wording for your whole catalog</h1><p>Let Rusty draft missing search titles and descriptions, then review and save them together.</p><Link to="/assistant">Back to Ask Rusty</Link></header>
  {!state&&!error&&<p role="status">Loading your catalog…</p>}
  {error&&<p className="rh-bulk-error" role="alert">{error}</p>}
  {state&&!state.run&&<section className="rh-bulk-start"><h2>Give your products a head start</h2><p><strong>{state.catalog?.needsWording??'—'}</strong> of {state.catalog?.total??'—'} products have search fields Rusty can help fill.</p><ol><li>Generate suggestions for missing fields.</li><li>Review them here. Edit any wording you want.</li><li>Select the suggestions you like and save them together.</li></ol><p>Rusty uses saved product options and checks descriptions across the catalog. Existing custom wording stays. Until you save, the storefront keeps its current automatic wording.</p><button type="button" className="rh-bulk-primary" disabled={!!busy||!state.ready||!state.catalog?.needsWording} onClick={()=>void action('start')}>{busy==='start'?'Preparing products…':'Generate missing search wording'}</button>{!state.ready&&<p>Ask Rusty needs its configured connection before generation.</p>}<small>Uses your existing AI provider and product details. No product photos or customer details are sent. Up to 1,000 product suggestions per day, including retries.</small></section>}
  {state?.run&&<>
   <section className="rh-bulk-summary" aria-label="Generation progress"><div><strong>{rows.length}</strong><span>In this review</span></div><div><strong>{ready.length}</strong><span>Ready to review</span></div><div><strong>{saved.length}</strong><span>Saved</span></div><div><strong>{attention.length}</strong><span>Need attention</span></div><p role="status">{generating?`Rusty is working in the background · ${rows.filter(r=>['pending','generating'].includes(r.status)).length} remaining. You can leave this page and return later.`:'Generation finished. Review the suggestions below before saving.'}</p></section>
   <div className="rh-bulk-toolbar"><button disabled={!!busy} onClick={()=>void load()}>Refresh</button>{generating&&<button disabled={!!busy} onClick={()=>void action('stop')}>Stop generation</button>}{!!attention.length&&!generating&&<button disabled={!!busy} onClick={()=>void action('retry')}>Retry products needing attention</button>}<button disabled={!!busy} onClick={()=>void action('discard')}>Discard this review</button></div>
   <section className="rh-bulk-review"><div className="rh-bulk-filters"><label>Find a product<input aria-label="Find a product" value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} placeholder="Product name"/></label><label>Show<select aria-label="Show suggestions" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}}><option value="all">All products</option><option value="ready">Ready to review</option><option value="saved">Saved</option><option value="attention">Needs attention</option></select></label></div>
   <div className="rh-bulk-savebar"><div><button disabled={!!busy||!ready.length} onClick={()=>setSelected(ready.map(r=>r.id))}>Select all ready ({ready.length})</button><button disabled={!!busy||!selected.length} onClick={()=>setSelected([])}>Clear selection</button></div><button className="rh-bulk-primary" disabled={!!busy||!count} onClick={()=>void save()}>{busy==='apply'?'Saving…':`Save selected search wording (${count})`}</button></div>
   {progress&&<p role="status">{progress}</p>}
   <p className="rh-bulk-note">Only search titles and descriptions are saved. Existing custom fields are protected. Products changed since generation are marked for a fresh suggestion.</p>
   {!visible.length&&<p>No products match this view.</p>}
   {visible.map(row=>{const value=edits[row.id]||row.suggestion,editable=row.status==='ready';return <article className="rh-bulk-row" key={row.id} data-product-id={row.id}><div className="rh-bulk-row-head"><label><input aria-label={`Select ${row.title}`} type="checkbox" disabled={!!busy||!editable} checked={selected.includes(row.id)} onChange={e=>setSelected(previous=>e.target.checked?[...previous,row.id]:previous.filter(id=>id!==row.id))}/><strong>{row.title}</strong></label><span className={`rh-bulk-status ${row.status}`}>{statusLabel[row.status]}</span><Link to={`/products/${row.id}`}>Open product ↗</Link></div>{value?<div className="rh-bulk-fields"><label>Search title{row.before.title.trim()&&<small>Existing custom wording · kept</small>}<input aria-label={`Search title for ${row.title}`} value={value.title} maxLength={100} disabled={!!busy||!editable||!!row.before.title.trim()} onChange={e=>setEdits(previous=>({...previous,[row.id]:{...value,title:e.target.value}}))}/><small>{value.title.length} / 100</small></label><label>Search description{row.before.description.trim()&&<small>Existing custom wording · kept</small>}<textarea aria-label={`Search description for ${row.title}`} rows={3} value={value.description} maxLength={320} disabled={!!busy||!editable||!!row.before.description.trim()} onChange={e=>setEdits(previous=>({...previous,[row.id]:{...value,description:e.target.value}}))}/><small>{value.description.length} / 320</small></label></div>:<p>Current search preview: {row.automatic.title}<br/>{row.automatic.description}</p>}{row.error&&<p className="rh-bulk-error">{row.error}</p>}</article>})}
   <div className="rh-bulk-pagination"><button disabled={!page||!!busy} onClick={()=>setPage(page-1)}>Previous</button><span>{filtered.length?Math.min(page*25+1,filtered.length):0}–{Math.min(page*25+25,filtered.length)} of {filtered.length}</span><button disabled={(page+1)*25>=filtered.length||!!busy} onClick={()=>setPage(page+1)}>Next</button></div></section>
  </>}
 </div>
}
export const config=defineRouteConfig({label:'Product search wording',icon,rank:1.1})
export default ProductSeoPage

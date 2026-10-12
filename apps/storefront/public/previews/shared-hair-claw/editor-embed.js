import { renderClaw } from './compositor.js?v=editor7'
import { placement, updateInteractiveArtwork } from './editor-claw.js?v=editor7'
import { validCorners } from './editor-transform.js?v=editor7'
import { fittingView } from './editor-viewport.js?v=editor7'
import { mountEditorPhoto, updateEditorPhoto } from './editor-photo.js?v=editor7'
const stage=document.getElementById('preview')
let data=null,parentOrigin=null,drag=null
let renderedStructure=''
let animation=0,pendingPatch=null,renderedState='',editRevision=0,viewport=null,interactiveReady=false,ending=false
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n))
const round=n=>Math.round(n*1000)/1000
function send(type,extra={}) {if(parentOrigin)window.parent.postMessage({type,...extra},parentOrigin)}
function selection() {
  if(!data?.editable||data.recipe.editor_version!==2)return
  const group=stage.querySelector('[data-selection]'),assembly=stage.querySelector('[data-assembly]')
  if(!group||!assembly)return
  const {corners}=placement(data.recipe),matrix=assembly.getScreenCTM()
  if(!matrix)return
  const unit=Math.hypot(matrix.a,matrix.b);if(!unit)return
  const size=22/unit
  if(!group.querySelector('polygon'))group.innerHTML=`<polygon fill="none" stroke="#527c96" stroke-dasharray="1 1" pointer-events="none"/>${corners.map((p,i)=>`<rect data-action="corner" data-corner="${i}" tabindex="0" role="button" aria-label="Artwork corner ${i+1}. Drag or use arrow keys to place this corner." fill="white" stroke="#527c96"/>`).join('')}<circle data-action="rotate" fill="white" stroke="#527c96"/>`
  const polygon=group.querySelector('polygon');polygon.setAttribute('points',corners.map(p=>`${p.x},${p.y}`).join(' '));polygon.setAttribute('stroke-width',1/unit)
  group.querySelectorAll('[data-corner]').forEach((handle,i)=>{
    const p=corners[i]
    for(const [key,value] of Object.entries({x:p.x-size/2,y:p.y-size/2,width:size,height:size,rx:3/unit,'stroke-width':1.5/unit}))handle.setAttribute(key,value)
  })
  const rotate=group.querySelector('circle')
  rotate.style.display=data.recipe.corners?'none':''
  rotate.setAttribute('cx',(corners[0].x+corners[1].x)/2);rotate.setAttribute('cy',(corners[0].y+corners[1].y)/2-size)
  rotate.setAttribute('r',8/unit);rotate.setAttribute('stroke-width',1.5/unit)
}
function draw() {
  const signature=JSON.stringify([data?.recipe,data?.size,data?.color,data?.outline,data?.editable,Boolean(drag),data?.workspacePhoto])
  if(signature===renderedState)return
  renderedState=signature
  if(!data?.recipe){stage.textContent='Choose an image to begin fitting.';return}
  if(data.size!=='4'){stage.textContent='2-inch preview awaits its measured physical template. Save placement as a draft.';return}
  try {
    const photoMode=data.workspacePhoto===true&&data.recipe.editor_version===2
    const structure=JSON.stringify([data.size,data.color,data.outline,data.editable,data.recipe.url,data.recipe.side,data.recipe.vertical,data.recipe.border,photoMode])
    if(photoMode&&structure===renderedStructure&&stage.querySelector('[data-editor-photo]')) {
      if(!drag)stage.querySelector('svg').setAttribute('viewBox',fittingView(placement(data.recipe).corners,data.recipe).join(' '))
      stage.dataset.dragging=String(Boolean(drag));updateEditorPhoto(stage,data.recipe);selection();return
    }
    if(!photoMode&&drag&&interactiveReady&&updateInteractiveArtwork(stage,data.recipe)){selection();return}
    renderedStructure=structure
    const focusedCorner=stage.contains(document.activeElement)?document.activeElement?.dataset?.corner:undefined
    stage.innerHTML=renderClaw({colorSlug:data.color,uploaded:data.recipe,scale:data.recipe.scale,vertical:data.recipe.vertical,showOutline:data.outline===true,id:'uploaded',interactive:Boolean(drag),editing:photoMode})
    interactiveReady=Boolean(drag)
    stage.dataset.editable=String(data.editable===true)
    stage.dataset.photoWorkspace=String(photoMode)
    stage.dataset.dragging=String(Boolean(drag))
    const svg=stage.querySelector('svg')
    if(data.editable&&data.recipe.editor_version===2) {
      if(!drag||!viewport)viewport=fittingView(placement(data.recipe).corners,data.recipe)
      svg.setAttribute('viewBox',viewport.join(' '))
    }
    if(photoMode)mountEditorPhoto(stage,data.recipe)
    stage.querySelector('image,img')?.addEventListener('error',()=>{stage.textContent='Source image could not load.';send('hair-claw-preview-error')},{once:true})
    selection()
    if(focusedCorner!==undefined)stage.querySelector(`[data-corner="${focusedCorner}"]`)?.focus({preventScroll:true})
  } catch {stage.textContent='This overlay could not be displayed. Check its image and alignment.';send('hair-claw-preview-error')}
}
function scheduleDraw() {
  if(animation)return
  animation=requestAnimationFrame(()=>{
    animation=0
    draw()
    // Keep pointer work local; React receives one final fit per gesture.
    if(pendingPatch&&!drag){const patch=pendingPatch;pendingPatch=null;send('hair-claw-placement',{patch,editRevision})}
    if(ending){ending=false;send('hair-claw-interaction',{active:false})}
  })
}
window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.origin==='null')return
  if(event.data?.type==='hair-claw-fit-view'&&event.origin===parentOrigin){viewport=null;renderedState='';scheduleDraw();return}
  if(event.data?.type!=='hair-claw-preview')return
  if(parentOrigin&&event.origin!==parentOrigin)return
  parentOrigin=event.origin
  // A delayed parent echo must not rewind a newer move still being dragged.
  const older=Number.isSafeInteger(event.data.editRevision)&&event.data.editRevision<editRevision
  const recipe=(drag||pendingPatch||older)&&event.data.editable&&data ? data.recipe : event.data.recipe
  data={...event.data,recipe}
  if(!data.editable){drag=null;pendingPatch=null;interactiveReady=false}
  scheduleDraw()
})
function edit(patch) {
  data={...data,recipe:{...data.recipe,...patch}}
  editRevision++
  pendingPatch={...pendingPatch,...patch}
  scheduleDraw()
}
function point(event,matrix) {return new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix)}
function movePatch(r,dx,dy) {
  dx=clamp(dx,-120-r.x,120-r.x);dy=clamp(dy,-120-r.y,120-r.y)
  if(r.corners) {
    dx=clamp(dx,-240-Math.min(...r.corners.map(p=>p.x)),240-Math.max(...r.corners.map(p=>p.x)))
    dy=clamp(dy,-240-Math.min(...r.corners.map(p=>p.y)),240-Math.max(...r.corners.map(p=>p.y)))
  }
  return {x:round(r.x+dx),y:round(r.y+dy),...(r.corners?{corners:r.corners.map(p=>({x:p.x+dx,y:p.y+dy}))}:{})}
}
function cornerPatch(corners,index,dx,dy) {
  const next=corners.map((p,i)=>i===index?{x:round(clamp(p.x+dx,-240,240)),y:round(clamp(p.y+dy,-240,240))}:{...p})
  return validCorners(next)?{corners:next}:null
}
stage.addEventListener('pointerdown',event=>{
  if(!data?.editable||data.recipe.editor_version!==2||event.button!==0)return
  const assembly=stage.querySelector('[data-assembly]');if(!assembly)return
  const inverse=assembly.getScreenCTM().inverse(),start=point(event,inverse),r=data.recipe,p=placement(r)
  const handle=event.target.closest('[data-action]')
  drag={id:event.pointerId,inverse,start,recipe:{...r},corners:p.corners,corner:Number(handle?.dataset.corner),cx:p.cx,cy:p.cy,action:handle?.dataset.action||'move'}
  event.preventDefault();stage.setPointerCapture(event.pointerId);(handle?.dataset.corner!==undefined?handle:stage).focus({preventScroll:true})
  send('hair-claw-interaction',{active:true})
  scheduleDraw()
})
stage.addEventListener('pointermove',event=>{
  if(drag?.id!==event.pointerId)return
  const p=point(event,drag.inverse),r=drag.recipe
  if(drag.action==='corner') {
    const patch=cornerPatch(drag.corners,drag.corner,p.x-drag.start.x,p.y-drag.start.y)
    if(patch)edit(patch)
  } else if(drag.action==='rotate') {
    const delta=(Math.atan2(p.y-drag.cy,p.x-drag.cx)-Math.atan2(drag.start.y-drag.cy,drag.start.x-drag.cx))*180/Math.PI
    edit({rotation:round(((r.rotation||0)+delta+540)%360-180)})
  } else edit(movePatch(r,p.x-drag.start.x,p.y-drag.start.y))
})
for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(name,()=>{
  if(!drag)return
  drag=null;ending=true
  // Releasing a handle flushes the latest placement at full review quality.
  scheduleDraw()
})
stage.addEventListener('keydown',event=>{
  if(data?.editable&&event.key==='Escape'){event.preventDefault();send('hair-claw-editor-close');return}
  if(!data?.editable||!data.recipe||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return
  event.preventDefault();const r=data.recipe,n=event.shiftKey?1:.1
  const assembly=stage.querySelector('[data-assembly]');if(!assembly)return
  const inverse=assembly.getScreenCTM().inverse(),dx=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0,dy=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0
  const vx=inverse.a*dx+inverse.c*dy,vy=inverse.b*dx+inverse.d*dy,length=Math.hypot(vx,vy)
  const corner=event.target.closest('[data-corner]')
  const patch=corner?cornerPatch(placement(r).corners,Number(corner.dataset.corner),n*vx/length,n*vy/length):movePatch(r,n*vx/length,n*vy/length)
  if(patch) {
    edit(patch)
    if(corner)stage.querySelector(`[data-corner="${corner.dataset.corner}"]`)?.focus({preventScroll:true})
  }
})
new ResizeObserver(()=>{if(!drag&&data?.recipe){if(data.workspacePhoto)updateEditorPhoto(stage,data.recipe);selection()}}).observe(stage)
window.parent.postMessage({type:'hair-claw-preview-ready'},'*')

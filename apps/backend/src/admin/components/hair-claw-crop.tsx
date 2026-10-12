import { useEffect, useRef } from 'react'
type Crop = {top:number;bottom:number;left:number;right:number}
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n))

// Direct DOM updates keep cropping independent of the expensive claw preview.
export default function HairClawCrop({url,width,height,value,disabled,onCommit,onWorking}:{url:string;width:number;height:number;value:Crop;disabled:boolean;onWorking?:(active:boolean)=>void;onCommit:(crop:Crop)=>void}) {
  const outer=useRef<HTMLDivElement>(null),photo=useRef<HTMLDivElement>(null),box=useRef<HTMLDivElement>(null)
  const draft=useRef(value),frame=useRef(0)
  const drag=useRef<{id:number;corner:string;rect:DOMRect;start:{x:number;y:number};crop:Crop}|null>(null)
  const draw=()=>{
    if(!box.current)return
    const c=draft.current
    Object.assign(box.current.style,{top:`${c.top}%`,bottom:`${c.bottom}%`,left:`${c.left}%`,right:`${c.right}%`})
  }
  useEffect(()=>{draft.current=value;draw()},[value])
  useEffect(()=>{
    const measure=()=>{
      if(!outer.current||!photo.current)return
      const scale=Math.min((outer.current.clientWidth-48)/width,(outer.current.clientHeight-48)/height)
      Object.assign(photo.current.style,{width:`${width*scale}px`,height:`${height*scale}px`})
    }
    const observer=new ResizeObserver(measure)
    if(outer.current)observer.observe(outer.current)
    measure()
    return()=>{observer.disconnect();cancelAnimationFrame(frame.current)}
  },[width,height])
  const finish=()=>{
    if(!drag.current)return
    drag.current=null;cancelAnimationFrame(frame.current);frame.current=0;draw();onCommit({...draft.current});onWorking?.(false)
  }
  return <div className="rh-fit-crop-view" ref={outer}>
    <div className="rh-fit-crop-photo" ref={photo} onPointerDown={event=>{
      if(disabled||event.button!==0||!photo.current)return
      const rect=photo.current.getBoundingClientRect(),target=event.target as HTMLElement
      const corner=target.closest<HTMLElement>('[data-crop-corner]')?.dataset.cropCorner||'new'
      event.preventDefault();photo.current.setPointerCapture(event.pointerId);onWorking?.(true)
      drag.current={id:event.pointerId,corner,rect,crop:{...draft.current},start:{x:clamp((event.clientX-rect.left)/rect.width*100,0,100),y:clamp((event.clientY-rect.top)/rect.height*100,0,100)}}
    }} onPointerMove={event=>{
      const d=drag.current;if(!d||d.id!==event.pointerId)return
      const x=clamp((event.clientX-d.rect.left)/d.rect.width*100,0,100),y=clamp((event.clientY-d.rect.top)/d.rect.height*100,0,100),c={...d.crop}
      if(d.corner==='new') {
        c.left=clamp(Math.min(x,d.start.x),0,90);c.right=clamp(100-Math.max(x,d.start.x),0,Math.min(90,94-c.left))
        c.top=clamp(Math.min(y,d.start.y),0,90);c.bottom=clamp(100-Math.max(y,d.start.y),0,Math.min(90,94-c.top))
      } else {
        if(d.corner.includes('left'))c.left=clamp(d.crop.left+x-d.start.x,0,Math.min(90,94-c.right))
        if(d.corner.includes('right'))c.right=clamp(d.crop.right-x+d.start.x,0,Math.min(90,94-c.left))
        if(d.corner.includes('top'))c.top=clamp(d.crop.top+y-d.start.y,0,Math.min(90,94-c.bottom))
        if(d.corner.includes('bottom'))c.bottom=clamp(d.crop.bottom-y+d.start.y,0,Math.min(90,94-c.top))
      }
      draft.current=c
      if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;draw()})
    }} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
      <img src={url} alt="Original photo with adjustable crop" draggable={false}/>
      <div ref={box} className="rh-fit-crop-box">
        {['top-left','top-right','bottom-right','bottom-left'].map(corner=><button key={corner} type="button" disabled={disabled} data-crop-corner={corner} aria-label={`Crop ${corner} corner`} onKeyDown={event=>{
          if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||disabled)return
          event.preventDefault();const c={...draft.current},n=event.shiftKey?1:.2
          if(event.key==='ArrowLeft'||event.key==='ArrowRight') {
            const delta=event.key==='ArrowLeft'?-n:n
            if(corner.includes('left'))c.left=clamp(c.left+delta,0,Math.min(90,94-c.right))
            else c.right=clamp(c.right-delta,0,Math.min(90,94-c.left))
          } else {
            const delta=event.key==='ArrowUp'?-n:n
            if(corner.includes('top'))c.top=clamp(c.top+delta,0,Math.min(90,94-c.bottom))
            else c.bottom=clamp(c.bottom-delta,0,Math.min(90,94-c.top))
          }
          draft.current=c;draw();onCommit(c)
        }}/>) }
      </div>
    </div>
  </div>
}

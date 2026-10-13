import { placement } from './editor-claw.js?v=editor7'
import { perspectiveMatrix } from './editor-transform.js?v=editor7'

const ns='http://www.w3.org/2000/svg'
export function photoMatrix(corners,width,height,[a,b,c,d,e,f]) {
  const h=perspectiveMatrix(corners,width,height),result=[]
  for(let column=0;column<4;column++) {
    const i=column*4
    result.push(a*h[i]+c*h[i+1]+e*h[i+3],b*h[i]+d*h[i+1]+f*h[i+3],h[i+2],h[i+3])
  }
  return result
}
// Keep the real photo in an HTML plane. CSS projection preserves its natural
// engraving without the tile seams caused by SVG <use> clipping in WebKit.
// The saved millimetre corners and storefront renderer remain unchanged.
export function mountEditorPhoto(stage,recipe) {
  const svg=stage.querySelector('svg'),selection=svg.querySelector('[data-selection]')
  const photo=document.createElement('div');photo.dataset.editorPhoto='';
  const mirror=document.createElement('div');mirror.dataset.photoMirror='';
  const image=document.createElement('img');image.src=recipe.url;image.alt='Artwork fitted to the claw';image.draggable=false
  mirror.append(image);photo.append(mirror)
  // Keep this window fixed to the physical wood face while the photo moves
  // underneath it. The selection handles stay outside the clipped window.
  const photoWindow=document.createElement('div');photoWindow.dataset.photoWindow=''
  photoWindow.append(photo)
  const tools=document.createElementNS(ns,'svg');tools.dataset.editorTools='';tools.setAttribute('role','group');tools.setAttribute('aria-label','Artwork corner controls')
  const defs=document.createElementNS(ns,'defs'),mask=document.createElementNS(ns,'clipPath')
  mask.id='editor-photo-window';mask.setAttribute('clipPathUnits','userSpaceOnUse')
  const cut=svg.querySelector('[data-fixed-cut]'),edge=document.createElementNS(ns,'path')
  edge.dataset.photoWindowEdge='';edge.setAttribute('d',cut.getAttribute('d'))
  mask.append(edge);defs.append(mask);tools.append(defs)
  photoWindow.style.clipPath='url(#editor-photo-window)'
  const group=document.createElementNS(ns,'g');group.dataset.photoTools=''
  const border=svg.querySelector('[data-fixed-border]')
  if(border) {
    const clip=document.createElementNS(ns,'g')
    clip.setAttribute('clip-path',border.closest('[clip-path]').getAttribute('clip-path'))
    clip.append(border.parentElement.cloneNode(true));group.append(clip)
  }
  for(const guide of svg.querySelectorAll('[data-cut-guide],[data-border-guide]'))group.append(guide)
  group.append(selection);tools.append(group);stage.append(photoWindow,tools)
  updateEditorPhoto(stage,recipe)
}
export function updateEditorPhoto(stage,recipe) {
  const photo=stage.querySelector('[data-editor-photo]');if(!photo)return false
  const assembly=stage.querySelector('[data-assembly]'),matrix=assembly.getScreenCTM();if(!matrix)return false
  const bounds=stage.getBoundingClientRect(),p=placement(recipe)
  const screen=[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e-bounds.left,matrix.f-bounds.top]
  const projection=photoMatrix(p.corners,p.w,p.h,screen)
  Object.assign(photo.style,{width:`${p.w}px`,height:`${p.h}px`,transform:`matrix3d(${projection.join(',')})`})
  const image=photo.querySelector('img')
  Object.assign(image.style,{width:`${recipe.width}px`,height:`${recipe.height}px`,left:`${-p.x}px`,top:`${-p.y}px`})
  photo.querySelector('[data-photo-mirror]').style.transform=`scale(${recipe.mirror_x?-1:1},${recipe.mirror_y?-1:1})`
  stage.querySelector('[data-photo-tools]').setAttribute('transform',`matrix(${screen.join(' ')})`)
  const cut=stage.querySelector('[data-fixed-cut]').getScreenCTM()
  stage.querySelector('[data-photo-window-edge]').setAttribute('transform',`matrix(${cut.a} ${cut.b} ${cut.c} ${cut.d} ${cut.e-bounds.left} ${cut.f-bounds.top})`)
  const tools=stage.querySelector('[data-editor-tools]');tools.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`)
  return true
}

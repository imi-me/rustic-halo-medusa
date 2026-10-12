import { geometry as g } from './editor-geometry.js'
import { validCorners, projectiveTriangles } from './editor-transform.js?v=editor4'
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
const finite = (n,min,max) => Number.isFinite(n) && n >= min && n <= max
export function placement(recipe) {
  if (![recipe.width,recipe.height].every(n=>Number.isInteger(n)&&finite(n,1,6000)) || !finite(recipe.scale,.1,3) || !finite(recipe.x,-120,120) || !finite(recipe.y,-120,120)) throw Error('Invalid placement')
  const rotation=recipe.rotation??0,skewX=recipe.skew_x??0,skewY=recipe.skew_y??0,turn=recipe.source_rotation??0
  if (!finite(rotation,-180,180)||!finite(skewX,-35,35)||!finite(skewY,-35,35)||![0,90,180,270].includes(turn)) throw Error('Invalid rotation/skew')
  const crop=recipe.crop||{top:0,bottom:0,left:0,right:0}
  if (!['top','bottom','left','right'].every(k=>finite(crop[k],0,90))||crop.top+crop.bottom>=95||crop.left+crop.right>=95) throw Error('Invalid crop')
  const x=recipe.width*crop.left/100,y=recipe.height*crop.top/100,w=recipe.width*(1-(crop.left+crop.right)/100),h=recipe.height*(1-(crop.top+crop.bottom)/100)
  const sw=turn%180?h:w,sh=turn%180?w:h
  const factor=(recipe.fit==='cover'?Math.max:Math.min)(g.width/sw,g.height/sh)
  const cx=g.width/2+recipe.x,cy=g.height/2+recipe.y
  if (recipe.corners !== undefined && !validCorners(recipe.corners)) throw Error('Invalid artwork corners')
  if (['mirror_x','mirror_y'].some(k=>recipe[k]!==undefined&&typeof recipe[k]!=='boolean')) throw Error('Invalid artwork mirror')
  const radians=n=>n*Math.PI/180,angle=radians(rotation),quarter=radians(turn),s=factor*recipe.scale
  const corner=(px,py)=>{
    const tx=(px*Math.cos(quarter)-py*Math.sin(quarter))*s,ty=(px*Math.sin(quarter)+py*Math.cos(quarter))*s
    const sy=ty+Math.tan(radians(skewY))*tx,sx=tx+Math.tan(radians(skewX))*sy
    return {x:cx+sx*Math.cos(angle)-sy*Math.sin(angle),y:cy+sx*Math.sin(angle)+sy*Math.cos(angle)}
  }
  const corners=recipe.corners||[corner(-w/2,-h/2),corner(w/2,-h/2),corner(w/2,h/2),corner(-w/2,h/2)]
  return {x,y,w,h,cx,cy,corners,transform:`translate(${cx} ${cy}) rotate(${rotation}) skewX(${skewX}) skewY(${skewY}) scale(${s}) rotate(${turn}) translate(${-x-w/2} ${-y-h/2})`}
}
function artwork(recipe,p,id,url) {
  const mx=recipe.mirror_x?-1:1,my=recipe.mirror_y?-1:1
  if (!recipe.corners) return `<g data-artwork transform="${p.transform}"><g clip-path="url(#${id}-crop)"><image data-artwork-mirror="${mx},${my}" transform="translate(${p.x+p.w/2} ${p.y+p.h/2}) scale(${mx} ${my}) translate(${-p.x-p.w/2} ${-p.y-p.h/2})" href="${esc(url)}" width="${recipe.width}" height="${recipe.height}" preserveAspectRatio="xMidYMid meet"/></g></g>`
  const tiles=projectiveTriangles(p.corners,p.w,p.h)
  const face=p.corners.map(point=>`${point.x},${point.y}`).join(' ')
  const clips=tiles.map((tile,i)=>{
    const center=tile.target.reduce((sum,point)=>({x:sum.x+point.x/3,y:sum.y+point.y/3}),{x:0,y:0})
    // A tiny overlap prevents antialiasing seams; the outer face clip retains
    // the exact pinned perimeter and the fixed wood clip remains above it.
    const points=tile.target.map(point=>{const length=Math.hypot(point.x-center.x,point.y-center.y);return `${point.x+(point.x-center.x)*.012/length},${point.y+(point.y-center.y)*.012/length}`}).join(' ')
    return `<clipPath id="${id}-tile-${i}" clipPathUnits="userSpaceOnUse"><polygon points="${points}"/></clipPath>`
  }).join('')
  const mirror=`translate(${p.w/2} ${p.h/2}) scale(${mx} ${my}) translate(${-p.w/2} ${-p.h/2})`
  return `<g data-artwork data-corner-fit="true" pointer-events="none"><defs><clipPath id="${id}-face"><polygon points="${face}"/></clipPath><g id="${id}-source" data-artwork-mirror="${mx},${my}" transform="${mirror}"><image href="${esc(url)}" x="${-p.x}" y="${-p.y}" width="${recipe.width}" height="${recipe.height}" preserveAspectRatio="none"/></g>${clips}</defs><g clip-path="url(#${id}-face)">${tiles.map((tile,i)=>`<g clip-path="url(#${id}-tile-${i})"><use href="#${id}-source" transform="matrix(${tile.transform.join(' ')})"/></g>`).join('')}</g></g>`
}
export function renderEditorClaw({recipe,color,outline=false,id='uploaded'}) {
  if (!/^[a-z0-9-]+$/i.test(id)||!/^#[a-f0-9]{6}$/i.test(color.hex)) throw Error('Invalid renderer')
  const url=new URL(recipe.url)
  if (!['https:','http:'].includes(url.protocol)||url.username||url.password) throw Error('Invalid image URL')
  const p=placement(recipe)
  const cut=`translate(${g.width} ${g.height}) rotate(180) translate(${-g.originX} ${-g.originY}) ${g.cutTransform}`
  const border=`translate(${g.width} ${g.height}) rotate(180) translate(${-g.originX} ${-g.originY}) ${g.borderTransform}`
  const scale=(103-2*g.reveal)/g.height,length=g.height
  const handle=`M 4 ${length*.33} C -4 ${length*.34} -9 ${length*.30} -13 ${length*.28} Q -16 ${length*.27} -16 ${length*.31} L -16 ${length*.69} Q -16 ${length*.73} -13 ${length*.72} C -9 ${length*.70} -4 ${length*.66} 4 ${length*.67} Z`
  const side=recipe.side==='right'?`translate(${g.width} 0) scale(-1 1)`:''
  const orientation=recipe.vertical?'':`translate(0 ${g.width}) rotate(-90)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${recipe.vertical?'-38 -12 125 125':'-12 -40 125 125'}" role="img" aria-labelledby="${id}-title">
  <title id="${id}-title">Hair-claw fit in ${esc(color.name)}</title>
  <defs>
    <clipPath id="${id}-wood"><path d="${g.cutPath}" transform="${cut}"/></clipPath>
    <clipPath id="${id}-crop"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath>
    <mask id="${id}-outward" maskUnits="userSpaceOnUse" x="-20" y="-10" width="80" height="130"><rect x="-20" y="-10" width="80" height="130" fill="white"/><path d="${g.borderPath}" transform="${border}" fill="black" stroke="white" stroke-width=".6"/></mask>
    <linearGradient id="${id}-handle" gradientUnits="userSpaceOnUse" x1="-16" y1="0" x2="2" y2="0"><stop offset="0" stop-color="white" stop-opacity=".16"/><stop offset=".12" stop-color="black" stop-opacity=".05"/><stop offset=".4" stop-color="black" stop-opacity=".12"/><stop offset=".7" stop-color="black" stop-opacity="0"/></linearGradient>
    <filter id="${id}-rounded"><feGaussianBlur stdDeviation=".12"/></filter>
    <filter id="${id}-shadow" x="-80%" y="-20%" width="260%" height="160%"><feDropShadow dx="-3" dy="2" stdDeviation="3.5" flood-opacity=".22"/></filter>
    <filter id="${id}-grain"><feTurbulence type="fractalNoise" baseFrequency="2 .25" numOctaves="2" seed="8"/><feColorMatrix type="saturate" values="0"/><feComposite in2="SourceGraphic" operator="in" result="grain"/><feBlend in="SourceGraphic" in2="grain" mode="soft-light"/></filter>
  </defs>
  <g transform="${orientation}"><g transform="scale(${scale})"><g data-assembly transform="${side}">
    <g filter="url(#${id}-shadow)"><path d="${handle}" fill="${color.hex}" filter="url(#${id}-rounded)"/><path d="${handle}" fill="url(#${id}-handle)"/>
    <path data-fixed-cut d="${g.cutPath}" transform="${cut}" fill="${color.hex}" stroke="${color.hex}" stroke-width="${2*g.reveal/scale}" stroke-linejoin="round" filter="url(#${id}-rounded)"/>
    <g clip-path="url(#${id}-wood)"><path d="${g.cutPath}" transform="${cut}" fill="#e8d6ba"/>
      ${artwork(recipe,p,id,url.href)}
      ${recipe.border==='template'?`<g mask="url(#${id}-outward)"><path data-fixed-border d="${g.borderPath}" transform="${border}" fill="none" stroke="#956234" stroke-width="1.8" stroke-linejoin="round" filter="url(#${id}-grain)"/></g>`:''}
    </g></g>
    ${outline?`<path data-cut-guide d="${g.cutPath}" transform="${cut}" fill="none" stroke="#527c96" stroke-width=".2" stroke-dasharray="1.3 .8" pointer-events="none"/><path data-border-guide d="${g.borderPath}" transform="${border}" fill="none" stroke="#444344" stroke-width=".15" stroke-dasharray=".7 .7" pointer-events="none"/>`:''}
    <g data-selection></g>
  </g></g></g></svg>`
}

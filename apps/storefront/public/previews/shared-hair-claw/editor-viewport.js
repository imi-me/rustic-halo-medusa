import { geometry as g } from './editor-geometry.js'

// Editing view only: changing the camera never changes the saved artwork fit.
export function fittingView(corners,recipe) {
  const base=recipe.vertical?[-38,-12,125,125]:[-12,-40,125,125]
  const scale=(103-2*g.reveal)/g.height
  const points=corners.map(p=>{
    const x=(recipe.side==='right'?g.width-p.x:p.x)*scale,y=p.y*scale
    return recipe.vertical?{x,y}:{x:y,y:g.width-x}
  })
  const minX=Math.min(base[0],...points.map(p=>p.x)),maxX=Math.max(base[0]+base[2],...points.map(p=>p.x))
  const minY=Math.min(base[1],...points.map(p=>p.y)),maxY=Math.max(base[1]+base[3],...points.map(p=>p.y))
  const span=Math.max(maxX-minX,maxY-minY),pad=Math.max(8,span*.065)
  return [(minX+maxX-span)/2-pad,(minY+maxY-span)/2-pad,span+2*pad,span+2*pad]
}

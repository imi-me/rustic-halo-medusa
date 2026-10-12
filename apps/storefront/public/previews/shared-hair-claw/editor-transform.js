// Corners are stored in the fixed, unmirrored claw's millimetre coordinates.
export function validCorners(points) {
  if (!Array.isArray(points) || points.length !== 4 || !points.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= 240 && Math.abs(p.y) <= 240)) return false
  // Keep a convex, consistently ordered face: no folded or collapsed images.
  return points.every((a,i) => {
    const b=points[(i+1)%4],c=points[(i+2)%4]
    return (b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x) > .01
  })
}
export function perspectiveMatrix(points,width,height) {
  if (!validCorners(points) || !(width>0 && height>0)) throw Error('Invalid artwork corners')
  const [p0,p1,p2,p3]=points
  const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x
  const dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y
  const den=dx1*dy2-dx2*dy1
  const g=(dx3*dy2-dx2*dy3)/den,h=(dx1*dy3-dx3*dy1)/den
  const a=p1.x-p0.x+g*p1.x,b=p3.x-p0.x+h*p3.x,d=p1.y-p0.y+g*p1.y,e=p3.y-p0.y+h*p3.y
  return [a/width,d/width,0,g/width,b/height,e/height,0,h/height,0,0,1,0,p0.x,p0.y,0,1]
}

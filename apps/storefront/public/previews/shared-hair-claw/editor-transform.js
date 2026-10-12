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

// Render the same four-corner homography using native SVG triangles. Embedded
// HTML/CSS 3D transforms do not consistently respect SVG clipping in WebKit.
// The source photo is defined once and reused, without a canvas/CORS download.
export function projectiveTriangles(points,width,height,{interactive=false}={}) {
  const matrix=perspectiveMatrix(points,width,height)
  const map=({x,y})=>{
    const z=matrix[3]*x+matrix[7]*y+1
    return {x:(matrix[0]*x+matrix[4]*y+matrix[12])/z,y:(matrix[1]*x+matrix[5]*y+matrix[13])/z}
  }
  const middle=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2})
  const result=[]
  const add=(source,depth=0)=>{
    const target=source.map(map)
    const mids=source.map((p,i)=>middle(p,source[(i+1)%3]))
    const error=Math.max(...mids.map((p,i)=>{const actual=map(p),approx=middle(target[i],target[(i+1)%3]);return Math.hypot(actual.x-approx.x,actual.y-approx.y)}))
    // Fixed topology avoids rebuilding the SVG mesh during a drag.
    if(interactive ? depth<2 : error>.025&&depth<5) {
      const [a,b,c]=source,[ab,bc,ca]=mids
      for(const triangle of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])add(triangle,depth+1)
      return
    }
    const [a,b,c]=source,[p,q,r]=target,dx1=b.x-a.x,dy1=b.y-a.y,dx2=c.x-a.x,dy2=c.y-a.y,den=dx1*dy2-dx2*dy1
    const sx=((q.x-p.x)*dy2-(r.x-p.x)*dy1)/den,sy=((q.y-p.y)*dy2-(r.y-p.y)*dy1)/den
    const tx=(dx1*(r.x-p.x)-dx2*(q.x-p.x))/den,ty=(dx1*(r.y-p.y)-dx2*(q.y-p.y))/den
    result.push({source,target,transform:[sx,sy,tx,ty,p.x-sx*a.x-tx*a.y,p.y-sy*a.x-ty*a.y],error})
  }
  add([{x:0,y:0},{x:width,y:0},{x:width,y:height}])
  add([{x:0,y:0},{x:width,y:height},{x:0,y:height}])
  return result
}

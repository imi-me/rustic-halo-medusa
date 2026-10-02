// Code-native contour fitting: warp each narrow photo strip between its source
// boundaries and the fixed target boundaries. Originals are never rewritten.
export function polygon(path) {
  const tokens = path.match(/[MLCZ]|-?\d*\.?\d+/gi)
  const points = []; let i = 0; let p = [0, 0]
  const pair = () => [Number(tokens[i++]), Number(tokens[i++])]
  while (i < tokens.length) {
    const command = tokens[i++].toUpperCase()
    if (command === 'M' || command === 'L') { p = pair(); points.push(p) }
    else if (command === 'C') {
      const a = p, b = pair(), c = pair(), d = pair()
      for (let n = 1; n <= 40; n++) {
        const t = n / 40, u = 1 - t
        points.push([0, 1].map(k => u*u*u*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*d[k]))
      }
      p = d
    } else if (command !== 'Z') throw new Error('Unsupported outline command')
  }
  return points
}
export function bounds(points) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs)-Math.min(...xs), height: Math.max(...ys)-Math.min(...ys) }
}
function span(points, x) {
  const hits = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i+1)%points.length]
    if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x)) hits.push(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]))
  }
  return [Math.min(...hits), Math.max(...hits)]
}
export function fitPhoto(design, target) {
  let source = polygon(design.clip)
  if (design.rotateSource) source = source.map(([x,y])=>[design.height-y,x])
  if (design.cropInset) {
    const b = bounds(source), k = 1-design.cropInset
    source = source.map(([x,y])=>[b.x+b.width/2+(x-b.x-b.width/2)*k,b.y+b.height/2+(y-b.y-b.height/2)*k])
  }
  const s = bounds(source), t = bounds(target)
  const strips = 240, width = t.width / strips
  return Array.from({length: strips}, (_, i) => {
    const fraction = (i+0.5)/strips
    const sx = s.x+fraction*s.width, tx = t.x+fraction*t.width
    const [sy, sb] = span(source, sx), [ty, tb] = span(target, tx)
    const kx = t.width/s.width
    // Overlap neighboring strips slightly to avoid antialiased hairline seams.
    const x = t.x+i*width-1
    return `<svg x="${x}" y="${ty}" width="${width+2}" height="${tb-ty}" viewBox="${(x-tx)/kx+sx} ${sy} ${(width+2)/kx} ${sb-sy}" preserveAspectRatio="none" overflow="hidden"><image href="${design.source}" width="${design.width}" height="${design.height}"${design.rotateSource ? ` transform="translate(${design.height} 0) rotate(90)"` : ''}/></svg>`
  }).join('')
}

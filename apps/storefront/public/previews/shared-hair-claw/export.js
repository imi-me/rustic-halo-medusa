import { renderClaw, colors } from './compositor.js?v=editor7'
let parentOrigin = null
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]))
window.addEventListener('message', async event => {
  if (event.source !== window.parent || event.origin === 'null' || event.data?.type !== 'hair-claw-export') return
  if (parentOrigin && event.origin !== parentOrigin) return
  parentOrigin = event.origin
  const send = value => window.parent.postMessage({ type: 'hair-claw-export-result', requestId: event.data.requestId, ...value }, parentOrigin)
  try {
    const { recipe, color, size } = event.data
    if (size !== '4' || !recipe?.enabled || !colors.some(row => row.slug === color)) throw Error('Only approved 4-inch fits and supported palette colors can be exported.')
    const source = new URL(recipe.url)
    if (!['https:', 'http:'].includes(source.protocol) || source.username || source.password || ![location.origin, 'https://cdn.rustichalo.com'].includes(source.origin)) throw Error('The saved artwork must be served from the approved storefront or media origin.')
    const response = await fetch(source, { credentials: 'omit', signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw Error('The saved artwork could not be loaded for export.')
    const blob = await response.blob()
    if (blob.size > 10000000 || !/^image\/(png|jpeg|webp)$/.test(blob.type)) throw Error('Use a supported saved artwork image under 10 MB.')
    const embedded = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob) })
    const markup = renderClaw({ uploaded: recipe, colorSlug: color, scale: recipe.scale, vertical: recipe.vertical, showOutline: false, id: 'etsy-export' }).replaceAll(escape(source.href), embedded)
    // The shared inline renderer uses HTML boolean data attributes. Serialize
    // its parsed SVG as valid standalone XML before drawing to a canvas.
    const holder = document.createElement('div'); holder.innerHTML = markup
    const svg = holder.querySelector('svg'); if (!svg) throw Error('Missing preview SVG.')
    svg.setAttribute('width', '2000'); svg.setAttribute('height', '2000')
    const serialized = new XMLSerializer().serializeToString(svg)
    const url = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml' }))
    try {
      const image = new Image()
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(Error('Preview could not render.')); image.src = url })
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2000
      const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, 2000, 2000); context.drawImage(image, 0, 0, 2000, 2000)
      send({ image: canvas.toDataURL('image/png') })
    } finally { URL.revokeObjectURL(url) }
  } catch (error) { send({ error: error.message || 'Color preview export failed.' }) }
})

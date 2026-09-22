export type ConfirmationOrder = {
  number: string | number
  customerName: string
  currency: string
  items: Array<{ title: string; variant?: string; quantity: number; total: number }>
  subtotal: number
  shipping: number
  tax: number
  discount: number
  total: number
  addressLines: string[]
  shippingMethod: string
}

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export function orderConfirmation(order: ConfirmationOrder, options: { logoUrl?: string } = {}) {
  let logoUrl = ''
  if (options.logoUrl) {
    try {
      const url = new URL(options.logoUrl)
      if (url.protocol === 'https:' && !url.username && !url.password) logoUrl = url.href
    } catch { /* Keep the text header when the image URL is not usable. */ }
  }
  const header = logoUrl
    ? `<tr><td style="background:#f5f2ec;padding:24px 32px;border-bottom:1px solid #e3dfd5"><img src="${escape(logoUrl)}" alt="Rustic Halo" width="258" height="44" style="display:block;width:258px;max-width:100%;height:auto;border:0;color:#30362c;font-size:22px;font-weight:bold"></td></tr>`
    : '<tr><td style="background:#515c49;padding:24px 32px;color:#fff;font-size:23px;font-weight:bold;letter-spacing:4px">RUSTIC HALO</td></tr>'
  const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency.toUpperCase() }).format(amount)
  const subject = `Your Rustic Halo order #${order.number} is confirmed`
  const totals: Array<[string, number]> = [['Subtotal', order.subtotal], ...(order.discount > 0 ? [['Discount', -order.discount] as [string, number]] : []), ['Shipping', order.shipping], ['Tax', order.tax], ['Total', order.total]]
  const text = [
    'RUSTIC HALO', `Thank you, ${order.customerName}!`, `Your order #${order.number} is confirmed.`,
    'We make your order just for you. Online orders ship in 3–5 business days. Carrier transit time is additional.',
    '', ...order.items.map(i => `${i.quantity} × ${i.title}${i.variant ? ` (${i.variant})` : ''} — ${money(i.total)}`),
    '', ...totals.map(([label, amount]) => `${label}: ${money(amount)}`), '', 'Ship to', ...order.addressLines,
    `Shipping method: ${order.shippingMethod}`, '', 'Questions about your order? Contact contact@rustichalo.com and include your order number.',
    'Rustic Halo · https://rustichalo.com',
  ].join('\n')
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;background:#f5f2ec;color:#30362c;font-family:Arial,Helvetica,sans-serif;line-height:1.6">
<div style="display:none;max-height:0;overflow:hidden">Your order is confirmed. Made to order, shipping in 3–5 business days.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e3dfd5">
${header}
<tr><td style="padding:32px"><p style="font-size:12px;letter-spacing:2px;margin:0;color:#68705f">ORDER #${escape(order.number)}</p>
<h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2;margin:12px 0">Thank you, ${escape(order.customerName)}.</h1>
<p>Your order is confirmed. We’ll make it just for you.</p>
<p style="padding:16px;background:#f5f2ec"><strong>Made to order · Ships in 3–5 business days</strong><br>Carrier transit time is additional.</p>
<h2 style="font-family:Georgia,serif;font-size:22px">Your order</h2>
<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${order.items.map(i => `<tr><td style="padding:12px 0;border-bottom:1px solid #e3dfd5">${escape(i.title)}${i.variant ? `<br><span style="color:#68705f;font-size:13px">${escape(i.variant)}</span>` : ''}<br><span style="font-size:13px">Quantity: ${escape(i.quantity)}</span></td><td align="right" style="padding:12px 0;border-bottom:1px solid #e3dfd5;white-space:nowrap">${money(i.total)}</td></tr>`).join('')}</table>
<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px">${totals.map(([label, amount]) => `<tr><td style="padding:4px 0;${label === 'Total' ? 'font-weight:bold;font-size:20px' : ''}">${label}</td><td align="right" style="${label === 'Total' ? 'font-weight:bold;font-size:20px' : ''}">${money(amount)}</td></tr>`).join('')}</table>
<h2 style="font-family:Georgia,serif;font-size:22px;margin-top:28px">Ship to</h2><p>${order.addressLines.map(escape).join('<br>')}</p><p style="font-size:14px">${escape(order.shippingMethod)}</p>
<hr style="border:0;border-top:1px solid #e3dfd5;margin:28px 0"><p style="font-size:14px">Questions about your order?<br><a href="mailto:contact@rustichalo.com" style="color:#515c49">Contact Rustic Halo</a> and include your order number.</p>
<p style="font-size:12px;color:#68705f">Nature-inspired. Uniquely you.<br><a href="https://rustichalo.com" style="color:#515c49">rustichalo.com</a></p>
</td></tr></table></td></tr></table></body></html>`
  return { subject, text, html }
}

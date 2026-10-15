import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { WorkspaceReceipt, PreparationStage } from '../../lib/etsy/order-workspace'
import type { PackedParcel } from '../../lib/shipping-plan'
import type { receiptDetails } from '../../lib/etsy/order-workspace'
import '../styles/blue-admin.css'
import '../styles/orders-workspace.css'
import '../styles/etsy-orders.css'
type Order = WorkspaceReceipt & { stage: PreparationStage; revision: string; fetchedAt: string; fulfillment: string }
type Report = { orders: Order[]; sync: { lastSuccessAt?: string; startedAt?: string; error?: string; fetched?: number; truncated?: boolean } | null }
type Detail = { order: Order; details: ReturnType<typeof receiptDetails>; parcels: PackedParcel[]; packingMessage: string; readAt: string; etsyUrl: string }
const labels: Record<string, string> = { needs_making: 'Needs making', ready_to_pack: 'Ready to pack', shipped: 'Shipped', canceled: 'Canceled', needs_review: 'Needs review', awaiting_payment: 'Awaiting payment', digital: 'Digital order' }
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not supplied'
const money = (value: Order['grandTotal']) => { try { return value ? new Intl.NumberFormat(undefined, { style: 'currency', currency: value.currency }).format(value.amount / value.divisor) : 'Unavailable' } catch { return 'Unavailable' } }
async function read<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { credentials: 'include', signal, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || 'The Etsy workspace is unavailable.')
  return result
}
const endpoint = '/admin/integrations/etsy/workspace'
export function OrderChannels({ etsy = false }: { etsy?: boolean }) {
  return <nav className="ew-channels" aria-label="Order channel"><Link aria-current={!etsy ? 'page' : undefined} to="/orders-workspace">Website orders</Link><Link aria-current={etsy ? 'page' : undefined} to="/orders-workspace?source=etsy">Etsy orders</Link></nav>
}
function Address({ details }: { details: Detail['details'] }) {
  const a = details.address
  return details.addressAvailable ? <address>{a.name}<br />{a.line1}<br />{a.line2 && <>{a.line2}<br /></>}{[a.city, a.state, a.postalCode].filter(Boolean).join(', ')}<br />{a.country}</address> : <p className="ew-notice">Shipping address is unavailable or incomplete. Check the address in Etsy.</p>
}
function OrderItems({ detail }: { detail: Detail }) {
  return <ul className="ew-items">{detail.order.transactions.map(item => {
    const selection = detail.details.selections.find(s => s.transactionId === item.transactionId)
    return <li key={item.transactionId}><strong>{item.quantity} × {item.title || 'Untitled item'}</strong><small>SKU: {item.sku || 'Missing'}{item.digital ? ' · Digital' : ''}</small>
      {selection?.options.map((option, i) => <p key={i}><b>{option.name || 'Selection'}:</b> {option.value}</p>)}
      {selection?.shippingMethod && <small>Shipping: {selection.shippingMethod}{selection.shippingUpgrade ? ` · ${selection.shippingUpgrade}` : ''}</small>}
      {item.shipBy && <small>Ship by {date(item.shipBy)}</small>}
      {item.match === 'historical_product' && <p className="ew-sync">Matched product: <Link to={`/products/${item.productId}`}>{item.matchedProductTitle}</Link>. Original color was not recorded; packing uses the saved measurements for this size.</p>}
      {!['matched', 'digital', 'historical_product'].includes(item.match) && <p className="ew-notice">{item.match === 'duplicate_sku' ? 'This SKU matches multiple variants.' : 'This item needs a matching product SKU.'} Review before packing.</p>}
    </li>
  })}</ul>
}
export default function EtsyOrdersWorkspace() {
  const [report, setReport] = useState<Report | null>(null), [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState('')
  const [selected, setSelected] = useState<number | null>(null), [detail, setDetail] = useState<Detail | null>(null), [detailError, setDetailError] = useState(''), [saving, setSaving] = useState(false), [notice, setNotice] = useState(''), [detailVersion, setDetailVersion] = useState(0)
  const [filter, setFilter] = useState('all'), [query, setQuery] = useState(''), [page, setPage] = useState(0)
  const refresh = useCallback(async () => {
    setRefreshing(true); setError(''); setNotice('')
    try { setReport(await read<Report>(endpoint, { action: 'refresh' })); setDetailVersion(v => v + 1) }
    catch (cause) { setError((cause as Error).message); try { setReport(await read<Report>(endpoint)) } catch {} }
    finally { setRefreshing(false) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    read<Report>(endpoint, undefined, controller.signal).then(next => {
      if (controller.signal.aborted) return
      setReport(next)
      if (!next.sync?.lastSuccessAt || Date.now() - Date.parse(next.sync.lastSuccessAt) > 15 * 60000) void refresh()
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh])
  useEffect(() => {
    const controller = new AbortController(); setDetail(null); setDetailError(''); setNotice('')
    if (selected) read<Detail>(`${endpoint}/${selected}`, undefined, controller.signal).then(next => {
      if (controller.signal.aborted) return
      setDetail(next); setReport(current => current ? { ...current, orders: current.orders.map(o => o.receiptId === next.order.receiptId ? next.order : o) } : current)
    }).catch(cause => { if (!controller.signal.aborted) setDetailError(cause.message) })
    return () => controller.abort()
  }, [selected, detailVersion])
  useEffect(() => setPage(0), [filter, query])
  const orders = report?.orders ?? []
  const filtered = useMemo(() => orders.filter(order => (filter === 'all' || order.fulfillment === filter) && (!query.trim() || [String(order.receiptId), ...order.transactions.flatMap(t => [t.title, t.sku])].some(v => v?.toLowerCase().includes(query.trim().toLowerCase())))), [orders, filter, query])
  async function saveStage(stage: PreparationStage) {
    if (!detail) return
    setSaving(true); setDetailError(''); setNotice('')
    try {
      const result = await read<{ order: Order }>(`${endpoint}/${detail.order.receiptId}`, { stage, expected_revision: detail.order.revision })
      setDetail({ ...detail, order: result.order }); setReport(current => current ? { ...current, orders: current.orders.map(o => o.receiptId === result.order.receiptId ? result.order : o) } : current); setNotice('Preparation stage saved in Medusa.')
    } catch (cause) { setDetailError((cause as Error).message) }
    finally { setSaving(false) }
  }
  const canPrepare = detail && ['needs_making', 'ready_to_pack'].includes(detail.order.fulfillment)
  return <div className="ow-workspace ew-workspace" aria-busy={loading || refreshing}>
    <OrderChannels etsy />
    <header className="ow-header"><div><h1>Etsy orders</h1><p>Make, pack, and track your Etsy orders.</p></div><button onClick={() => void refresh()} disabled={loading || refreshing || saving}>{refreshing ? 'Refreshing…' : 'Refresh orders'}</button></header>
    <p className="ew-sync" role="status">{report?.sync?.lastSuccessAt ? `Last refreshed ${new Date(report.sync.lastSuccessAt).toLocaleString()}. ` : ''}Refreshes every 15 minutes. Labels are purchased in Etsy.</p>
    {(error || report?.sync?.error) && <p className="rh-error" role="alert">{error || report?.sync?.error}</p>}
    {report?.sync?.truncated && <p className="ew-notice">The refresh reached its order limit. Some orders may be missing; check Etsy for the full list.</p>}
    <section className="ow-metrics" aria-label="Etsy preparation summary">{['needs_making', 'ready_to_pack', 'shipped', 'needs_review'].map(key => <div className="ow-card" key={key}><span>{labels[key]}</span><strong>{orders.filter(o => o.fulfillment === key).length}</strong></div>)}</section>
    <div className="ew-layout"><section className="ow-card ow-list" aria-label="Etsy order list">
      <div className="ow-tabs" role="group" aria-label="Etsy order views">{['all', 'needs_making', 'ready_to_pack', 'shipped', 'needs_review'].map(key => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{labels[key] || 'All orders'}</button>)}</div>
      <div className="ow-filters"><input aria-label="Search Etsy orders" placeholder="Search receipt, product, or SKU…" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Etsy preparation filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All stages</option>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>
      <div className="ow-table"><table><thead><tr>{['Order', 'Placed', 'Ship by', 'Preparation', 'Items', 'Total'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{filtered.slice(page * 15, page * 15 + 15).map(order => <tr key={order.receiptId} className={selected === order.receiptId ? 'selected' : ''}>
        <td><button aria-label={`View Etsy order ${order.receiptId}`} aria-pressed={selected === order.receiptId} disabled={saving} onClick={() => setSelected(order.receiptId)}>#{order.receiptId}</button></td><td>{date(order.createdAt)}</td><td className={!order.shipped && order.shipBy && Date.parse(order.shipBy) < Date.now() ? 'ew-overdue' : ''}>{date(order.shipBy)}</td><td><span className={`ow-badge ${order.shipped ? 'good' : 'pending'}`}>{labels[order.fulfillment] || order.fulfillment}</span></td><td>{order.itemCount}</td><td>{money(order.grandTotal)}</td>
      </tr>)}</tbody></table></div>
      {loading ? <p className="ow-empty">Loading Etsy orders…</p> : !filtered.length && <p className="ow-empty">{orders.length ? 'No Etsy orders match this view.' : 'No Etsy orders have been loaded yet. Use Refresh orders.'}</p>}
      <footer className="ow-pagination"><span>{filtered.length} orders · last 90 days and older open orders</span><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><button disabled={(page + 1) * 15 >= filtered.length} onClick={() => setPage(p => p + 1)}>Next</button></footer>
    </section>
    <section className="ow-card ow-detail" aria-label="Etsy order details">
      {detailError && <p className="rh-error" role="alert">{detailError} <button disabled={saving} onClick={() => setDetailVersion(v => v + 1)}>Reopen order</button></p>}
      {notice && <p role="status">{notice}</p>}
      {!detail ? <p className="ow-muted">{selected ? detailError ? 'Order details are unavailable.' : 'Loading order details…' : 'Select an Etsy order to see items, shipping, and packing.'}</p> : <>
        <div className="ow-detail-title"><h2>Etsy #{detail.order.receiptId}</h2><span className="ow-badge">{labels[detail.order.fulfillment]}</span></div><p className="ow-muted">Placed {date(detail.order.createdAt)} · {money(detail.order.grandTotal)}</p>
        <p className="ew-sync">Payment managed by Etsy · {detail.order.paid ? 'Paid' : 'Awaiting payment'}</p>
        {detail.order.hasRefunds && <p className="ew-notice">This order has refunds. Review the remaining items in Etsy before packing.</p>}
        <h3>Preparation</h3><p className="ew-sync">These stages track your work in Medusa. Etsy supplies the shipped status.</p>
        <div className="ew-stage-actions">{(['needs_making', 'ready_to_pack'] as PreparationStage[]).map(stage => <button key={stage} disabled={!canPrepare || saving || refreshing || detail.order.stage === stage} onClick={() => void saveStage(stage)}>{stage === 'needs_making' ? 'Needs making' : 'Mark ready to pack'}</button>)}</div>
        <h3>Items · ship by {date(detail.order.shipBy)}</h3><OrderItems detail={detail} />
        {detail.details.buyerNote && <><h3>Buyer note</h3><p className="ew-message">{detail.details.buyerNote}</p></>}
        {(detail.details.gift || detail.details.giftMessage) && <><h3>Gift details</h3><p className="ew-message">{detail.details.giftMessage || 'Marked as a gift'}{detail.details.giftSender ? ` — ${detail.details.giftSender}` : ''}</p></>}
        <h3>Shipping address</h3><Address details={detail.details} />
        <h3>Suggested packing</h3>{detail.packingMessage ? <p className="ew-notice">{detail.packingMessage}</p> : <><ul className="ew-parcels">{detail.parcels.map((parcel, i) => <li key={i}><strong>Box {i + 1}: {parcel.package_name}</strong><p>{parcel.length} × {parcel.width} × {parcel.height} in · {parcel.weight} oz packed · {parcel.item_count} items</p></li>)}</ul><p className="ew-sync">Includes empty packaging weight. Confirm the actual packed weight before purchasing a label.</p></>}
        <div className="ew-detail-actions"><button disabled={!detail.details.addressAvailable || saving} onClick={() => window.print()}>Print packing slip</button><a className="ow-primary" href={detail.etsyUrl} target="_blank" rel="noopener noreferrer">Open in Etsy to buy label ↗</a></div>
        <h3>Tracking from Etsy</h3>{detail.details.shipments.length ? detail.details.shipments.map((shipment, i) => <p className="ew-tracking" key={shipment.id ?? i}><strong>{shipment.carrier || 'Carrier not supplied'}</strong><br />{shipment.tracking || 'Tracking not supplied'}{shipment.notifiedAt && <small>Reported {date(shipment.notifiedAt)}</small>}</p>) : <p className="ow-muted">No shipment reported yet. Refresh after buying the label in Etsy.</p>}
        <p className="ew-sync">Order details checked {new Date(detail.readAt).toLocaleString()}.</p>
      </>}
    </section></div>
    {detail && <section className="ew-print-sheet"><h1>Rustic Halo · Packing slip</h1><p>Etsy order #{detail.order.receiptId} · Placed {date(detail.order.createdAt)}</p><p>Ship by {date(detail.order.shipBy)}</p><h2>Ship to</h2><Address details={detail.details} /><h2>Items</h2><OrderItems detail={detail} />{detail.details.buyerNote && <><h2>Buyer note</h2><p className="ew-message">{detail.details.buyerNote}</p></>}{detail.details.giftMessage && <><h2>Gift message</h2><p className="ew-message">{detail.details.giftMessage}</p><p>{detail.details.giftSender}</p></>}<p>This is a packing slip. Purchase the shipping label in Etsy.</p></section>}
  </div>
}

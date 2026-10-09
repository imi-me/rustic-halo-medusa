import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadOverview, money, summarizeOrders, type OverviewReport } from '../../lib/overview'
import '../../styles/blue-admin.css'

function OverviewIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>
}

function CardIcon({ kind }: { kind: 'value' | 'orders' | 'average' | 'fulfillment' }) {
  const paths = { value: 'M5 20V10m7 10V4m7 16v-7', orders: 'M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2', average: 'M3 3h8l10 10-8 8L3 11V3Zm4 4h.01', fulfillment: 'm3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10' }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>
}

function OrderChart({ points, currency }: { points: Array<{ date: Date; value: number }>; currency: string }) {
  const ceiling = Math.max(...points.map(point => point.value), 1) * 1.15
  const x = (index: number) => 76 + index / Math.max(points.length - 1, 1) * 604
  const y = (value: number) => 190 - value / ceiling * 154
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.value)}`).join(' ')
  const hasOrders = points.some(point => point.value > 0)
  return <div className="rh-chart">
    <svg viewBox="0 0 720 238" role="img" aria-label={`Daily order value in ${currency.toUpperCase()}. ${hasOrders ? 'Values are shown in the chart and daily totals below.' : 'No order value in this period.'}`}>
      <defs><linearGradient id="rh-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2868b2" stopOpacity=".17" /><stop offset="100%" stopColor="#2868b2" stopOpacity=".02" /></linearGradient></defs>
      {[0, .25, .5, .75, 1].map(step => <g key={step}><line x1="76" x2="680" y1={y(step * ceiling)} y2={y(step * ceiling)} stroke="#e5edf7" /><text x="64" y={y(step * ceiling) + 4} textAnchor="end" fill="#6b7e98" fontSize="11">{money(step * ceiling, currency)}</text></g>)}
      <path d={`${line} L${x(points.length - 1)},190 L76,190 Z`} fill="url(#rh-chart-fill)" />
      <path d={line} fill="none" stroke="#2868b2" strokeWidth="2.7" strokeLinejoin="round" />
      {points.map((point, index) => <g key={point.date.toISOString()}>{points.length <= 7 && <circle cx={x(index)} cy={y(point.value)} r="3.5" fill="#2868b2" />}{(index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0) && <text x={x(index)} y="220" textAnchor="middle" fill="#6b7e98" fontSize="11">{point.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>}</g>)}
    </svg>
    {!hasOrders && <p className="rh-chart-empty">No orders in this period. Your activity will appear here.</p>}
    <details className="rh-daily"><summary>View daily totals</summary><ul>{points.map(point => <li key={point.date.toISOString()}><span>{point.date.toLocaleDateString()}</span><strong>{money(point.value, currency)}</strong></li>)}</ul></details>
  </div>
}

const statusLabels: Record<string, string> = { not_fulfilled: 'Awaiting fulfillment', partially_fulfilled: 'Partially fulfilled', fulfilled: 'Fulfilled', partially_shipped: 'Partially shipped', shipped: 'Shipped', delivered: 'Delivered', canceled: 'Canceled', not_paid: 'Unpaid', awaiting: 'Awaiting payment', captured: 'Paid', authorized: 'Authorized', partially_captured: 'Partially paid', partially_refunded: 'Partially refunded', refunded: 'Refunded', requires_action: 'Requires action' }
function Status({ status }: { status: string }) {
  const pending = ['not_fulfilled', 'partially_fulfilled', 'not_paid', 'awaiting', 'requires_action'].includes(status)
  return <span className={`rh-status ${pending ? 'rh-status-amber' : ''}`}>{statusLabels[status] || status.replace(/_/g, ' ')}</span>
}

const OverviewPage = () => {
  const [days, setDays] = useState(7)
  const [currency, setCurrency] = useState('usd')
  const [report, setReport] = useState<OverviewReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    setReport(null)
    try {
      const next = await loadOverview(days, controller.signal)
      if (!controller.signal.aborted) setReport(next)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The overview could not load.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [days])
  useEffect(() => { void refresh(); return () => request.current?.abort() }, [refresh])
  const currencies = useMemo(() => [...new Set(['usd', ...(report?.orders.map(order => order.currency_code.toLowerCase()) ?? [])])].sort(), [report])
  const stats = useMemo(() => report ? summarizeOrders(report.orders, currency, report.start, report.end) : null, [report, currency])
  const cards = stats ? [
    { title: 'Order value', value: money(stats.value, currency), hint: 'Includes tax & shipping · excludes canceled orders', kind: 'value' as const },
    { title: 'Total orders', value: String(stats.count), hint: 'Non-canceled orders in this period', kind: 'orders' as const },
    { title: 'Average order value', value: money(stats.average, currency), hint: `Per non-canceled ${currency.toUpperCase()} order`, kind: 'average' as const },
    { title: 'Awaiting fulfillment', value: String(stats.awaiting), hint: 'Unfulfilled or partly fulfilled in this period', kind: 'fulfillment' as const },
  ] : []

  return <div className="rh-overview" aria-busy={loading}>
    <header className="rh-overview-header">
      <div><div className="rh-eyebrow">RUSTIC HALO <span>Store overview</span></div><h1>Overview</h1><p>Welcome back. Here’s what’s happening at Rustic Halo.</p></div>
      <div className="rh-controls"><label><span className="rh-sr-only">Reporting period</span><select value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><label><span className="rh-sr-only">Reporting currency</span><select value={currency} onChange={event => setCurrency(event.target.value)}>{currencies.map(code => <option key={code} value={code}>{code.toUpperCase()}</option>)}</select></label><button type="button" className="rh-button" onClick={() => void refresh()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button></div>
    </header>
    {error && <div className="rh-error" role="alert"><strong>Overview unavailable</strong><p>{error}</p><button className="rh-button" type="button" onClick={() => void refresh()}>Try again</button></div>}
    {loading && <div className="rh-loading" role="status">Loading your store activity…</div>}
    {stats && report && <>
      <div className="rh-report-note">Store data · {report.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {report.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {currency.toUpperCase()}<span>Updated {report.refreshedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span></div>
      <section className="rh-metrics" aria-label="Store metrics">{cards.map(card => <div className="rh-card rh-metric" key={card.title}><div className="rh-metric-title"><CardIcon kind={card.kind} /><span>{card.title}</span></div><strong>{card.value}</strong><p>{card.hint}</p></div>)}</section>
      <div className="rh-main-grid">
        <section className="rh-card"><div className="rh-section-heading"><h2>Order value over time</h2><span>{currency.toUpperCase()}</span></div><p className="rh-section-subtitle">Daily order totals, including unpaid orders. Refunds are not deducted.</p><OrderChart points={stats.days} currency={currency} /></section>
        <section className="rh-card rh-priorities"><div className="rh-section-heading"><h2>Today’s priorities</h2></div>
          <Link to="/orders"><span className="rh-priority-icon"><CardIcon kind="fulfillment" /></span><span><strong>{stats.awaiting} orders awaiting fulfillment</strong><small>In this period · review your order queue</small></span><span aria-hidden="true">›</span></Link>
          <Link to="/products"><span className="rh-priority-icon rh-priority-amber"><CardIcon kind="average" /></span><span><strong>{report.draftCount} draft products</strong><small>Review your catalog before publishing</small></span><span aria-hidden="true">›</span></Link>
          <Link to="/customers"><span className="rh-priority-icon"><OverviewIcon /></span><span><strong>{report.newCustomers} new customers</strong><small>Across all currencies in this period</small></span><span aria-hidden="true">›</span></Link>
          <Link to="/promotions"><span className="rh-priority-icon"><CardIcon kind="average" /></span><span><strong>Manage promotions</strong><small>Review offers and campaign settings</small></span><span aria-hidden="true">›</span></Link>
        </section>
        <section className="rh-card rh-recent"><div className="rh-section-heading"><h2>Recent orders</h2><Link to="/orders">View all</Link></div><div className="rh-table-wrap"><table><thead><tr>{['Order', 'Date', 'Customer', 'Total', 'Status'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{stats.recent.map(order => <tr key={order.id}><td><Link to={`/orders/${order.id}`}>#{order.display_id}</Link></td><td>{new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td><td className="rh-customer">{[order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ') || order.email || 'Guest customer'}</td><td>{money(Number(order.total), currency)}</td><td><Status status={order.status === 'canceled' ? 'canceled' : order.fulfillment_status} /></td></tr>)}</tbody></table></div>{!stats.recent.length && <div className="rh-empty"><CardIcon kind="orders" /><strong>No orders yet in this period</strong><p>New orders will appear here as they arrive.</p><Link to="/orders">Open orders</Link></div>}</section>
        <section className="rh-card rh-products"><div className="rh-section-heading"><h2>Top products</h2><Link to="/products">View all</Link></div><p className="rh-section-subtitle">Units ordered in this period · excludes canceled orders</p>{stats.products.map(product => <div className="rh-product" key={product.id}>{product.thumbnail ? <img src={product.thumbnail} alt="" loading="lazy" /> : <span className="rh-product-placeholder"><CardIcon kind="orders" /></span>}<div>{product.productId ? <Link to={`/products/${product.productId}`}>{product.title}</Link> : <strong>{product.title}</strong>}<small>{product.quantity} units ordered</small></div></div>)}{!stats.products.length && <div className="rh-empty"><CardIcon kind="average" /><strong>Your bestsellers start here</strong><p>Top products will appear when orders come in.</p><Link to="/products">Browse {report.productCount} products</Link></div>}</section>
      </div>
    </>}
    <footer className="rh-overview-footer"><span>Nature-inspired. Uniquely you.</span><span>Powered by Medusa</span></footer>
  </div>
}

export const config = defineRouteConfig({ label: 'Overview', icon: OverviewIcon, rank: 0 })
export default OverviewPage

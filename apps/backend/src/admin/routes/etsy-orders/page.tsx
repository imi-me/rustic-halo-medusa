import { defineRouteConfig } from '@medusajs/admin-sdk'
import { Button, Container, Heading, Text } from '@medusajs/ui'
import { useCallback, useEffect, useState } from 'react'

type Money = { amount: number, divisor: number, currency: string } | null
type Order = {
  receiptId: number
  createdAt: string | null
  status: string | null
  paid: boolean
  shipped: boolean
  grandTotal: Money
  itemCount: number
  transactions: Array<{ transactionId: number, title: string | null, sku: string | null, quantity: number }>
}
type Report = { readOnly: true, days: number, total: number, fetched: number, truncated: boolean, orders: Order[] }

const formatMoney = (money: Money) => money
  ? new Intl.NumberFormat(undefined, { style: 'currency', currency: money.currency }).format(money.amount / money.divisor)
  : 'Unavailable'

const EtsyOrdersPage = () => {
  const [report, setReport] = useState<Report | null>(null)
  const [message, setMessage] = useState('Loading the read-only Etsy report…')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/admin/integrations/etsy/orders?days=30', { credentials: 'include', headers: { Accept: 'application/json' } })
      const body = await response.json() as Report | { message?: string }
      if (!response.ok || !('orders' in body)) throw new Error('message' in body && body.message ? body.message : 'The Etsy report is unavailable.')
      setReport(body)
      setMessage('')
    } catch (error) {
      setReport(null)
      setMessage(error instanceof Error ? error.message : 'The Etsy report is unavailable.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  return <Container className="divide-y p-0">
    <div className="flex items-center justify-between px-6 py-4">
      <div>
        <Heading level="h1">Etsy orders</Heading>
        <Text size="small" className="text-ui-fg-subtle">Read-only operational report · last 30 days</Text>
      </div>
      <Button variant="secondary" size="small" onClick={() => void load()} disabled={loading}>Refresh</Button>
    </div>
    {message ? <div className="px-6 py-8"><Text>{message}</Text></div> : null}
    {report ? <>
      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <div><Text size="small" className="text-ui-fg-subtle">Orders</Text><Text weight="plus">{report.total}</Text></div>
        <div><Text size="small" className="text-ui-fg-subtle">Fetched</Text><Text weight="plus">{report.fetched}</Text></div>
        <div><Text size="small" className="text-ui-fg-subtle">Mode</Text><Text weight="plus">Read only</Text></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ui-border-base bg-ui-bg-subtle"><tr>
            {['Receipt', 'Date', 'Status', 'Items', 'Total', 'SKUs'].map(label => <th key={label} className="px-6 py-3 font-medium">{label}</th>)}
          </tr></thead>
          <tbody>{report.orders.map(order => <tr key={order.receiptId} className="border-b border-ui-border-base align-top">
            <td className="px-6 py-4 font-medium">#{order.receiptId}</td>
            <td className="px-6 py-4">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Unavailable'}</td>
            <td className="px-6 py-4">{order.status ?? (order.shipped ? 'Shipped' : order.paid ? 'Paid' : 'Open')}</td>
            <td className="px-6 py-4">{order.itemCount}</td>
            <td className="px-6 py-4">{formatMoney(order.grandTotal)}</td>
            <td className="px-6 py-4">{order.transactions.map(item => item.sku || 'Missing SKU').join(', ') || 'No items'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {report.orders.length === 0 ? <div className="px-6 py-8"><Text>No Etsy orders were found in this period.</Text></div> : null}
      {report.truncated ? <div className="px-6 py-4"><Text size="small">This report reached its 500-receipt review limit.</Text></div> : null}
    </> : null}
  </Container>
}

export const config = defineRouteConfig({ label: 'Etsy orders', rank: 70 })
export default EtsyOrdersPage

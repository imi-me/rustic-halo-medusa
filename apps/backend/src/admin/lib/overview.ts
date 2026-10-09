export type OverviewItem = {
  id: string
  title: string
  product_id?: string | null
  thumbnail?: string | null
  quantity: number
}

export type OverviewOrder = {
  id: string
  display_id: number
  created_at: string
  status: string
  currency_code: string
  total: number
  email?: string | null
  customer?: { first_name?: string | null; last_name?: string | null } | null
  payment_status: string
  fulfillment_status: string
  items: OverviewItem[]
}

export type OverviewReport = {
  orders: OverviewOrder[]
  productCount: number
  draftCount: number
  newCustomers: number
  start: Date
  end: Date
  refreshedAt: Date
}

export function periodWindow(days: number, now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - days + 1)
  return { start, end: now }
}

// Medusa v2 amounts are in major currency units. Never divide these by 100.
export function money(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}

export function summarizeOrders(orders: OverviewOrder[], currency: string, start: Date, end: Date) {
  const inPeriod = orders.filter(order => {
    const time = new Date(order.created_at).getTime()
    return time >= start.getTime() && time <= end.getTime()
  })
  const selected = inPeriod.filter(order => order.currency_code.toLowerCase() === currency.toLowerCase())
  const eligible = selected.filter(order => order.status !== 'canceled')
  const value = eligible.reduce((sum, order) => sum + Number(order.total), 0)
  const awaiting = eligible.filter(order => ['not_fulfilled', 'partially_fulfilled'].includes(order.fulfillment_status))
  const days: Array<{ date: Date; value: number }> = []
  const date = new Date(start)
  while (date <= end) {
    days.push({ date: new Date(date), value: 0 })
    date.setDate(date.getDate() + 1)
  }
  for (const order of eligible) {
    const day = days.find(point => point.date.toDateString() === new Date(order.created_at).toDateString())
    if (day) day.value += Number(order.total)
  }
  const products = new Map<string, { id: string; productId?: string | null; title: string; thumbnail?: string | null; quantity: number }>()
  for (const order of eligible) {
    for (const item of order.items ?? []) {
      // Unlinked/deleted products stay separate by title, never by line-item ID.
      const id = item.product_id || item.title
      const previous = products.get(id)
      products.set(id, { id, productId: item.product_id, title: item.title, thumbnail: item.thumbnail || previous?.thumbnail, quantity: (previous?.quantity ?? 0) + Number(item.quantity) })
    }
  }
  return {
    value,
    count: eligible.length,
    average: eligible.length ? value / eligible.length : 0,
    awaiting: awaiting.length,
    days,
    recent: selected.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    products: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 3),
  }
}

async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { credentials: 'include', signal, headers: { Accept: 'application/json' } })
  if (!response.ok) {
    if (response.status === 401) throw new Error('Your session has expired. Sign in again to view the overview.')
    if (response.status === 403) throw new Error('Your account does not have access to this report.')
    throw new Error('The overview could not load. Please try again.')
  }
  return response.json() as Promise<T>
}

export async function loadOverview(days: number, signal: AbortSignal): Promise<OverviewReport> {
  const { start, end } = periodWindow(days)
  const dateQuery = { 'created_at[$gte]': start.toISOString(), 'created_at[$lte]': end.toISOString() }
  const fields = 'id,display_id,status,created_at,currency_code,total,email,customer.first_name,customer.last_name,items.id,items.title,items.product_id,items.thumbnail,items.quantity'
  const orders: OverviewOrder[] = []
  const [products, drafts, customers] = await Promise.all([
    read<{ count: number }>('/admin/products?limit=1&fields=id', signal),
    read<{ count: number }>('/admin/products?limit=1&fields=id&status%5B%5D=draft', signal),
    read<{ count: number }>(`/admin/customers?${new URLSearchParams({ ...dateQuery, limit: '1', fields: 'id' })}`, signal),
  ])
  let count = 0
  do {
    const query = new URLSearchParams({ ...dateQuery, fields, limit: '200', offset: String(orders.length), order: '-created_at' })
    const page = await read<{ orders: OverviewOrder[]; count: number }>(`/admin/orders?${query}`, signal)
    count = page.count
    if (count > 2000) throw new Error('This period contains more than 2,000 orders. Choose a shorter period to load a complete report.')
    orders.push(...page.orders)
    if (!page.orders.length && orders.length < count) throw new Error('The order list changed while loading. Refresh to load a complete report.')
  } while (orders.length < count)
  return { orders, productCount: products.count, draftCount: drafts.count, newCustomers: customers.count, start, end, refreshedAt: new Date() }
}

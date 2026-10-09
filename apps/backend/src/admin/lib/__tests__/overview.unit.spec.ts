import { loadOverview, money, periodWindow, summarizeOrders, type OverviewOrder } from '../overview'

const start = new Date(2026, 9, 3)
const end = new Date(2026, 9, 9, 12)
const order = (overrides: Partial<OverviewOrder> = {}): OverviewOrder => ({
  id: 'order_1', display_id: 1, created_at: new Date(2026, 9, 5, 12).toISOString(), status: 'pending',
  currency_code: 'usd', total: 14.25, payment_status: 'captured', fulfillment_status: 'not_fulfilled',
  items: [{ id: 'item_1', title: 'Woodland ornament', product_id: 'prod_1', quantity: 2 }], ...overrides,
})

describe('Overview reporting', () => {
  it('uses major currency units and excludes canceled orders from metrics and top products', () => {
    const report = summarizeOrders([order(), order({ id: 'canceled', total: 999, status: 'canceled' })], 'usd', start, end)
    expect(report.value).toBe(14.25)
    expect(money(report.value, 'USD')).toContain('14.25')
    expect(report.count).toBe(1)
    expect(report.average).toBe(14.25)
    expect(report.awaiting).toBe(1)
    expect(report.products[0].quantity).toBe(2)
    expect(report.recent).toHaveLength(2)
  })
  it('never adds currencies together', () => {
    const report = summarizeOrders([order(), order({ id: 'eur', currency_code: 'eur', total: 400 })], 'USD', start, end)
    expect(report.value).toBe(14.25)
    expect(report.count).toBe(1)
    expect(report.recent).toHaveLength(1)
  })
  it('includes only the chosen local-calendar period and zero-fills the chart', () => {
    const report = summarizeOrders([order(), order({ id: 'old', created_at: new Date(2026, 9, 2, 23).toISOString() }), order({ id: 'future', created_at: new Date(2026, 9, 10).toISOString() })], 'usd', start, end)
    expect(report.days).toHaveLength(7)
    expect(report.days.reduce((sum, point) => sum + point.value, 0)).toBe(14.25)
    expect(report.count).toBe(1)
    expect(periodWindow(7, end).start).toEqual(start)
  })
  it('counts partial fulfillment and avoids marking shipped orders as awaiting', () => {
    const report = summarizeOrders([order(), order({ id: 'partial', fulfillment_status: 'partially_fulfilled' }), order({ id: 'shipped', fulfillment_status: 'shipped' })], 'usd', start, end)
    expect(report.awaiting).toBe(2)
    expect(report.products[0].quantity).toBe(6)
  })
  it('has honest zero states with no invented orders or products', () => {
    const report = summarizeOrders([], 'usd', start, end)
    expect(report.value).toBe(0)
    expect(report.average).toBe(0)
    expect(report.products).toEqual([])
    expect(report.days.every(point => point.value === 0)).toBe(true)
  })
  it('reads every order page and retains authenticated requests', async () => {
    const original = global.fetch
    const fetchMock = jest.fn(async (path: string, options: RequestInit) => {
      expect(options.credentials).toBe('include')
      if (path.startsWith('/admin/products?') && path.includes('status')) {
        // Medusa's product-list validator requires an array, including one status.
        expect(new URL(path, 'http://localhost').searchParams.get('status[]')).toBe('draft')
        expect(new URL(path, 'http://localhost').searchParams.has('status')).toBe(false)
      }
      const body = path.startsWith('/admin/orders?')
        ? { count: 2, orders: [order({ id: path.includes('offset=0') ? 'first' : 'second' })] }
        : { count: 3 }
      return { ok: true, json: async () => body } as Response
    })
    global.fetch = fetchMock as typeof fetch
    try {
      const report = await loadOverview(7, new AbortController().signal)
      expect(report.orders.map(row => row.id)).toEqual(['first', 'second'])
      expect(fetchMock).toHaveBeenCalledTimes(5)
    } finally { global.fetch = original }
  })
  it('refuses partial totals when the period exceeds its safe reporting limit', async () => {
    const original = global.fetch
    global.fetch = jest.fn(async (path: string) => ({ ok: true, json: async () => path.startsWith('/admin/orders?') ? { count: 2001, orders: [order()] } : { count: 0 } })) as unknown as typeof fetch
    try { await expect(loadOverview(90, new AbortController().signal)).rejects.toThrow('2,000 orders') }
    finally { global.fetch = original }
  })
})

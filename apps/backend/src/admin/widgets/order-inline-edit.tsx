import { defineWidgetConfig } from '@medusajs/admin-sdk'
import type { AdminOrder, DetailWidgetProps } from '@medusajs/framework/types'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { OrderShippingLabel } from '../components/order-shipping-label'
import { InlineEditor } from '../components/inline-editor'

const OrderInlineEdit = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [editing, setEditing] = useState(false)
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    let mount: HTMLElement | null = null
    const attach = () => {
      const root = main.querySelector<HTMLElement>('[class*="xl:grid-cols-"]')
      if (!root?.parentElement) return
      if (!mount?.isConnected) {
        mount = document.createElement('div')
        mount.className = 'rh-order-inline-host'
        root.parentElement.insertBefore(mount, root)
        setHost(mount)
      }
    }
    const observer = new MutationObserver(attach)
    observer.observe(main, { childList: true, subtree: true })
    attach()
    return () => { observer.disconnect(); mount?.remove() }
  }, [order.id])
  return host ? createPortal(<><InlineEditor key={order.id} kind="orders" id={order.id} onEditingChange={setEditing}/><OrderShippingLabel key={`shipping-${order.id}`} id={order.id} disabled={editing}/></>, host) : null
}
export const config = defineWidgetConfig({ zone: 'order.details.before', id: 'rustic-halo:order-inline-edit' })
export default OrderInlineEdit

import { HttpTypes } from "@medusajs/types"
export function customerOrderStatus(
  order: Pick<HttpTypes.StoreOrder, "status" | "fulfillment_status">
) {
  if (order.status === "canceled")
    return { label: "Canceled", group: "canceled" }
  const status = order.fulfillment_status
  if (status === "delivered") return { label: "Delivered", group: "delivered" }
  if (
    status === "shipped" ||
    status === "partially_shipped" ||
    status === "partially_delivered"
  )
    return { label: "On the way", group: "active" }
  return {
    label:
      status === "fulfilled" || status === "partially_fulfilled"
        ? "Ready for delivery"
        : "Preparing",
    group: "active",
  }
}

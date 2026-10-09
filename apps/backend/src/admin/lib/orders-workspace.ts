import type { OverviewOrder } from "./overview";
export type WorkspaceOrder = Omit<OverviewOrder, "items"> & {
  item_subtotal?: number;
  discount_total?: number;
  shipping_subtotal?: number;
  tax_total?: number;
  shipping_address?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    country_code?: string;
  };
  items: Array<OverviewOrder["items"][number] & { total?: number }>;
};
export const needsFulfillment = (order: OverviewOrder) =>
  order.status !== "canceled" &&
  ["not_fulfilled", "partially_fulfilled"].includes(order.fulfillment_status);
export function filterOrders(
  orders: OverviewOrder[],
  query: string,
  tab: string,
  payment: string,
  fulfillment: string,
  days: number,
  now = Date.now(),
) {
  const search = query.trim().toLowerCase().replace(/^#/, "");
  return orders.filter(
    (order) =>
      (!search ||
        [
          String(order.display_id),
          order.email,
          order.customer?.first_name,
          order.customer?.last_name,
          [order.customer?.first_name, order.customer?.last_name]
            .filter(Boolean)
            .join(" "),
        ].some((value) => value?.toLowerCase().includes(search))) &&
      (tab !== "fulfill" || needsFulfillment(order)) &&
      (tab !== "completed" || order.status === "completed") &&
      (!payment || order.payment_status === payment) &&
      (!fulfillment || order.fulfillment_status === fulfillment) &&
      (!days || new Date(order.created_at).getTime() >= now - days * 86400000),
  );
}
export async function readOrders<T>(
  path: string,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    signal,
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Your session has expired. Please sign in again."
        : response.status === 403
          ? "Your account does not have access to these orders."
          : "Orders could not load. Please try again.",
    );
  return response.json();
}
export async function loadOrders(
  signal: AbortSignal,
): Promise<WorkspaceOrder[]> {
  const orders: WorkspaceOrder[] = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const params = new URLSearchParams({
      limit: "100",
      offset: String(offset),
      order: "-created_at",
      fields:
        "id,display_id,created_at,status,currency_code,total,email,customer.first_name,customer.last_name",
    });
    const page = await readOrders<{ orders: WorkspaceOrder[]; count: number }>(
      `/admin/orders?${params}`,
      signal,
    );
    if (page.count > 2000)
      throw new Error(
        "This workspace supports up to 2,000 orders. Open Native orders to browse your complete store.",
      );
    orders.push(...page.orders);
    if (orders.length >= page.count) return orders;
    if (!page.orders.length)
      throw new Error("The order list changed while loading. Please refresh.");
  }
  return orders;
}

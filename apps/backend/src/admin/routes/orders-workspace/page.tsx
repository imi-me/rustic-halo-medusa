import { defineRouteConfig } from "@medusajs/admin-sdk";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  filterOrders,
  loadOrders,
  needsFulfillment,
  readOrders,
  type WorkspaceOrder,
} from "../../lib/orders-workspace";
import { money } from "../../lib/overview";
import "../../styles/blue-admin.css";
import "../../styles/orders-workspace.css";
const label = (value = "unknown") =>
  ({
    captured: "Paid",
    not_paid: "Unpaid",
    not_fulfilled: "Awaiting fulfillment",
    partially_fulfilled: "Partially fulfilled",
  })[value] || value.replace(/_/g, " ");
function Badge({ value }: { value: string }) {
  return (
    <span
      className={`ow-badge ${["captured", "completed", "delivered", "fulfilled", "shipped"].includes(value) ? "good" : "pending"}`}
    >
      {label(value)}
    </span>
  );
}
function OrdersIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2" />
    </svg>
  );
}
const OrdersWorkspace = () => {
  const [orders, setOrders] = useState<WorkspaceOrder[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState(""),
    [detail, setDetail] = useState<WorkspaceOrder | null>(null),
    [detailError, setDetailError] = useState("");
  const [query, setQuery] = useState(""),
    [tab, setTab] = useState("all"),
    [payment, setPayment] = useState(""),
    [fulfillment, setFulfillment] = useState(""),
    [days, setDays] = useState(0),
    [page, setPage] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    loadOrders(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          setOrders(next);
          setSelected((current) =>
            next.some((order) => order.id === current)
              ? current
              : next[0]?.id || "",
          );
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setDetailError("");
    if (selected)
      readOrders<{ order: WorkspaceOrder }>(
        `/admin/orders/${encodeURIComponent(selected)}?fields=%2Bcurrency_code,%2Bemail,%2Bcustomer.first_name,%2Bcustomer.last_name`,
        controller.signal,
      )
        .then((result) => {
          if (!controller.signal.aborted) setDetail(result.order);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) setDetailError(cause.message);
        });
    return () => controller.abort();
  }, [selected, refresh]);
  useEffect(() => setPage(0), [query, tab, payment, fulfillment, days]);
  const filtered = useMemo(
    () => filterOrders(orders, query, tab, payment, fulfillment, days),
    [orders, query, tab, payment, fulfillment, days],
  );
  const shown = filtered.slice(page * 10, page * 10 + 10);
  const customer = (order: WorkspaceOrder) =>
    [order.customer?.first_name, order.customer?.last_name]
      .filter(Boolean)
      .join(" ") ||
    order.email ||
    "Guest customer";
  return (
    <div className="ow-workspace" aria-busy={loading}>
      <header className="ow-header">
        <div>
          <h1>Orders</h1>
          <p>Manage your orders and keep fulfillment moving.</p>
        </div>
        <div className="ow-actions">
          <button
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
          >
            Refresh
          </button>
          <Link className="ow-primary" to="/draft-orders/create">
            + Create draft order
          </Link>
        </div>
      </header>
      {error ? (
        <div className="rh-error" role="alert">
          {error} <Link to="/orders">Open Native orders</Link>
        </div>
      ) : loading ? (
        <p role="status">Loading store orders…</p>
      ) : (
        <>
          <section className="ow-metrics" aria-label="All-time order summary">
            {[
              ["Total orders", orders.length, "All store orders"],
              [
                "To fulfill",
                orders.filter(needsFulfillment).length,
                "Unfulfilled or partly fulfilled",
              ],
              [
                "Awaiting payment",
                orders.filter(
                  (order) =>
                    order.status !== "canceled" &&
                    ["not_paid", "awaiting", "requires_action"].includes(
                      order.payment_status,
                    ),
                ).length,
                "Unpaid or requiring action",
              ],
              [
                "Canceled",
                orders.filter((order) => order.status === "canceled").length,
                "Canceled orders",
              ],
            ].map(([title, value, hint]) => (
              <div className="ow-card" key={title}>
                <span>{title}</span>
                <strong>{value}</strong>
                <small>{hint}</small>
              </div>
            ))}
          </section>
          <div className="ow-grid">
            <section className="ow-card ow-list">
              <div className="ow-tabs" role="group" aria-label="Order views">
                {[
                  ["all", "All orders"],
                  ["fulfill", "To fulfill"],
                  ["completed", "Completed"],
                ].map(([key, title]) => (
                  <button
                    aria-pressed={tab === key}
                    key={key}
                    onClick={() => setTab(key)}
                  >
                    {title}
                  </button>
                ))}
                <Link to="/orders">Native orders ↗</Link>
              </div>
              <div className="ow-filters">
                <input
                  aria-label="Search orders"
                  placeholder="Search order number or customer…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <select
                  aria-label="Payment status"
                  value={payment}
                  onChange={(event) => setPayment(event.target.value)}
                >
                  <option value="">Payment status</option>
                  {[...new Set(orders.map((order) => order.payment_status))]
                    .filter(Boolean)
                    .map((value) => (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ))}
                </select>
                <select
                  aria-label="Fulfillment status"
                  value={fulfillment}
                  onChange={(event) => setFulfillment(event.target.value)}
                >
                  <option value="">Fulfillment status</option>
                  {[...new Set(orders.map((order) => order.fulfillment_status))]
                    .filter(Boolean)
                    .map((value) => (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ))}
                </select>
                <select
                  aria-label="Order period"
                  value={days}
                  onChange={(event) => setDays(Number(event.target.value))}
                >
                  <option value={0}>All time</option>
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
              <div className="ow-table">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Order",
                        "Date",
                        "Customer",
                        "Payment",
                        "Fulfillment",
                        "Total",
                      ].map((title) => (
                        <th key={title}>{title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((order) => (
                      <tr
                        key={order.id}
                        className={selected === order.id ? "selected" : ""}
                      >
                        <td>
                          <button
                            aria-label={`View order ${order.display_id}`}
                            aria-pressed={selected === order.id}
                            onClick={() => setSelected(order.id)}
                          >
                            #{order.display_id}
                          </button>
                        </td>
                        <td>
                          {new Date(order.created_at).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" },
                          )}
                        </td>
                        <td className="ow-customer">{customer(order)}</td>
                        <td>
                          <Badge value={order.payment_status} />
                        </td>
                        <td>
                          <Badge
                            value={
                              order.status === "canceled"
                                ? "canceled"
                                : order.fulfillment_status
                            }
                          />
                        </td>
                        <td>
                          {money(Number(order.total), order.currency_code)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && (
                <p className="ow-empty">No orders match these filters.</p>
              )}
              <footer className="ow-pagination">
                <span>
                  {filtered.length
                    ? `${page * 10 + 1}–${Math.min((page + 1) * 10, filtered.length)} of ${filtered.length}`
                    : "0 orders"}
                </span>
                <button
                  disabled={page === 0}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <button
                  disabled={(page + 1) * 10 >= filtered.length}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </footer>
            </section>
            <section
              className="ow-card ow-detail"
              aria-label="Selected order details"
            >
              {detailError ? (
                <p role="alert">{detailError}</p>
              ) : !detail ? (
                <p role="status">
                  {selected
                    ? "Loading order details…"
                    : "Select an order to see its details."}
                </p>
              ) : (
                <>
                  <div className="ow-detail-title">
                    <h2>Order #{detail.display_id}</h2>
                    <Badge value={detail.status} />
                  </div>
                  <p className="ow-muted">
                    {new Date(detail.created_at).toLocaleString()}
                  </p>
                  <h3>Customer</h3>
                  <strong>{customer(detail)}</strong>
                  <p className="ow-muted ow-email">{detail.email}</p>
                  <h3>Shipping address</h3>
                  {detail.shipping_address ? (
                    <p className="ow-address">
                      {[
                        detail.shipping_address.first_name,
                        detail.shipping_address.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      <br />
                      {[
                        detail.shipping_address.address_1,
                        detail.shipping_address.address_2,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      <br />
                      {[
                        detail.shipping_address.city,
                        detail.shipping_address.province,
                        detail.shipping_address.postal_code,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      <br />
                      {detail.shipping_address.country_code?.toUpperCase()}
                    </p>
                  ) : (
                    <p className="ow-muted">No shipping address</p>
                  )}
                  <h3>Items</h3>
                  {(detail.items || []).map((item) => (
                    <div className="ow-item" key={item.id}>
                      {item.thumbnail && <img src={item.thumbnail} alt="" />}
                      <div>
                        <strong>{item.title}</strong>
                        <small>Quantity: {item.quantity}</small>
                      </div>
                      {item.total != null && (
                        <span>
                          {money(Number(item.total), detail.currency_code)}
                        </span>
                      )}
                    </div>
                  ))}
                  <dl className="ow-totals">
                    {[
                      ["Items subtotal", detail.item_subtotal],
                      ["Shipping", detail.shipping_subtotal],
                      ["Tax", detail.tax_total],
                      [
                        "Discount",
                        detail.discount_total
                          ? -detail.discount_total
                          : undefined,
                      ],
                      ["Total", detail.total],
                    ].map(
                      ([title, value]) =>
                        value != null && (
                          <div key={String(title)}>
                            <dt>{title}</dt>
                            <dd>
                              {money(Number(value), detail.currency_code)}
                            </dd>
                          </div>
                        ),
                    )}
                  </dl>
                  <Link className="ow-primary" to={`/orders/${detail.id}`}>
                    Manage fulfillment
                  </Link>
                  <Link className="ow-open" to={`/orders/${detail.id}`}>
                    Open full order ↗
                  </Link>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
export const config = defineRouteConfig({
  label: "Orders workspace",
  icon: OrdersIcon,
});

export default OrdersWorkspace

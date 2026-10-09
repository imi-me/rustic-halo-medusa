import {
  filterOrders,
  loadOrders,
  needsFulfillment,
} from "../orders-workspace";
import type { WorkspaceOrder } from "../orders-workspace";
const order = (overrides: Partial<WorkspaceOrder> = {}): WorkspaceOrder => ({
  id: "one",
  display_id: 14,
  created_at: "2026-10-01T12:00:00Z",
  status: "pending",
  currency_code: "usd",
  total: 20.34,
  email: "test@example.invalid",
  payment_status: "not_paid",
  fulfillment_status: "not_fulfilled",
  items: [],
  ...overrides,
});
afterEach(() => jest.restoreAllMocks());
it("excludes canceled and fulfilled orders from the fulfillment queue", () => {
  expect(needsFulfillment(order())).toBe(true);
  expect(needsFulfillment(order({ status: "canceled" }))).toBe(false);
  expect(needsFulfillment(order({ fulfillment_status: "fulfilled" }))).toBe(
    false,
  );
});
it("combines customer, payment, fulfillment and date filters", () => {
  const rows = [
    order({ customer: { first_name: "Shawn", last_name: "House" } }),
    order({ id: "two", payment_status: "captured" }),
  ];
  expect(
    filterOrders(
      rows,
      "shawn house",
      "fulfill",
      "not_paid",
      "not_fulfilled",
      30,
      Date.parse("2026-10-09"),
    ),
  ).toHaveLength(1);
  expect(
    filterOrders(rows, "#14", "all", "", "", 7, Date.parse("2026-10-09")),
  ).toHaveLength(0);
});
it("loads every page and includes the session and abort signal", async () => {
  const mock = jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orders: [order()], count: 2 }),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orders: [order({ id: "two" })], count: 2 }),
    } as Response);
  const signal = new AbortController().signal;
  expect(await loadOrders(signal)).toHaveLength(2);
  expect(mock.mock.calls[1][0]).toContain("offset=100");
  expect(mock.mock.calls[0][1]).toMatchObject({
    credentials: "include",
    signal,
  });
});
it("refuses partial totals beyond the supported cap", async () => {
  jest
    .spyOn(global, "fetch")
    .mockResolvedValue({
      ok: true,
      json: async () => ({ orders: [order()], count: 2001 }),
    } as Response);
  await expect(loadOrders(new AbortController().signal)).rejects.toThrow(
    "2,000",
  );
});
it("reports expired authentication", async () => {
  jest
    .spyOn(global, "fetch")
    .mockResolvedValue({ ok: false, status: 401 } as Response);
  await expect(loadOrders(new AbortController().signal)).rejects.toThrow(
    "session has expired",
  );
});

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { adminRequest } from "../../lib/inline-edit";
type Choice = { href: string; label: string; group: string };
type Category = {
  id: string;
  name: string;
  handle: string;
  parent_category_id?: string | null;
  is_active?: boolean;
  is_internal?: boolean;
};
type Product = { id: string; title: string; handle: string };
const pages: Choice[] = [
  { href: "/", label: "Homepage", group: "Pages" },
  { href: "/store", label: "All products", group: "Pages" },
  { href: "/#our-story", label: "Our story", group: "Pages" },
  { href: "/customer-service", label: "Customer service", group: "Pages" },
];
const Catalog = createContext<{
  choices: Choice[];
  channel: string;
  loading: boolean;
  error: string;
  origin: string;
  reload: () => void;
}>({
  choices: pages,
  channel: "",
  loading: true,
  error: "",
  origin: "",
  reload: () => {},
});
async function all<T>(path: string, key: string, fields: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < 10_000; offset += 100) {
    const data = await adminRequest(
      `${path}?${new URLSearchParams({
        limit: "100",
        offset: String(offset),
        fields,
      })}`
    );
    const batch = data[key] as T[];
    if (!Array.isArray(batch))
      throw Error("Catalog choices could not be loaded.");
    rows.push(...batch);
    if (!batch.length || rows.length >= data.count) return rows;
  }
  throw Error("There are too many choices to load. Use a custom link.");
}
export const LinkPickerProvider = ({
  children,
  origin,
}: {
  children: ReactNode;
  origin: string;
}) => {
  const [choices, setChoices] = useState(pages),
    [channel, setChannel] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.allSettled([
      all<Category>(
        "/admin/product-categories",
        "product_categories",
        "id,name,handle,parent_category_id,is_active,is_internal"
      ),
      all<{ title: string; handle: string }>(
        "/admin/collections",
        "collections",
        "id,title,handle"
      ),
      adminRequest("/admin/stores?fields=id,default_sales_channel_id"),
    ]).then((results) => {
      if (!active) return;
      const next = [...pages];
      if (results[0].status === "fulfilled") {
        const categories = results[0].value;
        const name = (c: Category) => {
          const parts = [c.name],
            seen = new Set([c.id]);
          let parent = c.parent_category_id;
          while (parent && !seen.has(parent)) {
            seen.add(parent);
            const row = categories.find((x) => x.id === parent);
            if (!row) break;
            parts.unshift(row.name);
            parent = row.parent_category_id;
          }
          return parts.join(" › ");
        };
        next.push(
          ...categories
            .filter((c) => c.handle && c.is_active !== false && !c.is_internal)
            .map((c) => ({
              href: `/categories/${c.handle}`,
              label: name(c),
              group: "Categories",
            }))
            .sort((a, b) => a.label.localeCompare(b.label))
        );
      }
      if (results[1].status === "fulfilled")
        next.push(
          ...results[1].value
            .filter((c) => c.handle)
            .map((c) => ({
              href: `/collections/${c.handle}`,
              label: c.title,
              group: "Collections",
            }))
            .sort((a, b) => a.label.localeCompare(b.label))
        );
      if (results[2].status === "fulfilled")
        setChannel(
          results[2].value.stores?.[0]?.default_sales_channel_id || ""
        );
      setChoices(next);
      setError(
        results.some((x) => x.status === "rejected")
          ? "Some catalog choices could not load. Retry, or keep your current link."
          : ""
      );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <Catalog.Provider
      value={{
        choices,
        channel,
        loading,
        error,
        origin,
        reload: () => setRetry((x) => x + 1),
      }}
    >
      {children}
    </Catalog.Provider>
  );
};
export const StorefrontLinkPicker = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (href: string) => void;
}) => {
  const { choices, channel, loading, error, origin, reload } =
    useContext(Catalog);
  const id = useId(),
    [mode, setMode] = useState<"browse" | "product" | "custom">("browse"),
    [query, setQuery] = useState(""),
    [products, setProducts] = useState<Product[]>([]),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState(""),
    [productLabel, setProductLabel] = useState<{
      href: string;
      title: string;
    } | null>(null),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!/^\/products\/[^/?#]+$/.test(value)) return;
    let active = true;
    void adminRequest(
      "/admin/products?" +
        new URLSearchParams({
          handle: value.slice("/products/".length),
          "status[]": "published",
          fields: "id,title,handle",
          limit: "1",
        })
    )
      .then((data) => {
        if (active && data.products?.[0])
          setProductLabel({ href: value, title: data.products[0].title });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value]);
  useEffect(() => {
    if (mode !== "product") return;
    let active = true;
    setSearching(true);
    setProducts([]);
    setSearchError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        limit: "20",
        "status[]": "published",
        fields: "id,title,handle",
        order: "title",
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(channel ? { sales_channel_id: channel } : {}),
      });
      void adminRequest("/admin/products?" + params)
        .then((data) => {
          if (active)
            setProducts((data.products || []).filter((p: Product) => p.handle));
        })
        .catch((e) => {
          if (active) setSearchError((e as Error).message);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mode, query, channel, retry]);
  const ownChange = useRef<string | null>(null);
  const change = (href: string) => { ownChange.current = href; onChange(href); };
  useEffect(() => { if (ownChange.current !== value) setMode("browse"); ownChange.current = null; }, [value]);
  const selected = choices.find((c) => c.href === value);
  const label =
    selected?.label ||
    (productLabel?.href === value
      ? productLabel.title
      : "Current link (unchanged)");
  let preview = "";
  try {
    const base = new URL(origin),
      target = new URL(value, base);
    if (
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !/[\\\s]/.test(value) &&
      target.origin === base.origin
    )
      preview = target.href;
  } catch {}
  return (
    <div className="hp-field hp-link-picker">
      <label htmlFor={id}>Link to</label>
      <select
        id={id}
        value={
          mode === "product"
            ? "__product"
            : mode === "custom"
            ? "__custom"
            : value
        }
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__product") setMode("product");
          else if (v === "__custom") setMode("custom");
          else {
            setMode("browse");
            change(v);
          }
        }}
      >
        {!selected && <option value={value}>{label}</option>}
        {["Pages", "Categories", "Collections"].map((group) => (
          <optgroup label={group} key={group}>
            {choices
              .filter((c) => c.group === group)
              .map((c) => (
                <option value={c.href} key={c.href}>
                  {c.label}
                </option>
              ))}
          </optgroup>
        ))}
        <optgroup label="More choices">
          <option value="__product">Find a product by name…</option>
          <option value="__custom">Custom link…</option>
        </optgroup>
      </select>
      {loading && (
        <small role="status">Loading your categories and collections…</small>
      )}
      {error && (
        <small role="status">
          {error}{" "}
          <button type="button" onClick={reload}>
            Retry choices
          </button>
        </small>
      )}
      {mode === "product" && (
        <div className="hp-link-search">
          <label htmlFor={id + "-search"}>Search published products</label>
          <input
            id={id + "-search"}
            type="search"
            value={query}
            maxLength={80}
            placeholder="Start with a product name…"
            onChange={(e) => setQuery(e.target.value)}
          />
          <label htmlFor={id + "-results"}>Choose a product</label>
          <select
            id={id + "-results"}
            value=""
            disabled={searching || !!searchError}
            onChange={(e) => {
              const p = products.find((p) => p.id === e.target.value);
              if (p) {
                const href = `/products/${p.handle}`;
                setProductLabel({ href, title: p.title });
                change(href);
                setMode("browse");
              }
            }}
          >
            <option value="">
              {searching ? "Searching…" : "Choose a product…"}
            </option>
            {products.map((p) => (
              <option value={p.id} key={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {!searching && !searchError && !products.length && (
            <small>No published products match. Try another name.</small>
          )}
          {products.length === 20 && (
            <small>
              Showing the first 20 matches. Type more of the name to narrow the
              list.
            </small>
          )}
          {searchError && (
            <small role="alert">
              {searchError}{" "}
              <button type="button" onClick={() => setRetry((x) => x + 1)}>
                Retry search
              </button>
            </small>
          )}
          <small>
            Your existing destination stays in place until you choose a product.
          </small>
        </div>
      )}
      {mode === "custom" && (
        <label className="hp-custom-link">
          <span>Custom storefront link</span>
          <input
            aria-label="Custom storefront link"
            value={value}
            onChange={(e) => change(e.target.value)}
            required
            maxLength={500}
            placeholder="/collections/fall"
          />
          <small>
            Use a page within this store, such as /collections/fall.
          </small>
        </label>
      )}
      <small>
        Visitors will open: {label}
        {preview && (
          <>
            {" "}
            ·{" "}
            <a href={preview} target="_blank" rel="noopener noreferrer">
              Preview destination ↗
            </a>
          </>
        )}
      </small>
    </div>
  );
};

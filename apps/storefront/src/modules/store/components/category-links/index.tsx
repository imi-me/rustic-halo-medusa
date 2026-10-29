import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
export default async function CategoryLinks({
  activeHandle,
}: {
  activeHandle?: string
}) {
  const categories = await listCategories()
  return (
    <nav className="rh-b-category-pills" aria-label="Browse categories">
      <LocalizedClientLink
        href="/store"
        aria-current={!activeHandle ? "page" : undefined}
      >
        All pieces
      </LocalizedClientLink>
      {categories
        .filter((c) => !c.parent_category_id)
        .map((c) => (
          <LocalizedClientLink
            href={`/categories/${c.handle}`}
            key={c.id}
            aria-current={activeHandle === c.handle ? "page" : undefined}
          >
            {c.name}
          </LocalizedClientLink>
        ))}
    </nav>
  )
}

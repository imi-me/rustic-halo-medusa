const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript"),
  React = require("react"),
  { renderToStaticMarkup } = require("react-dom/server")
const defaults = require("../src/lib/brand/homepage-defaults.json")
test("storefront fallback and Admin initial design share the same content contract", () => {
  assert.deepEqual(
    defaults,
    require("../../backend/src/lib/storefront-content/defaults.json")
  )
})
async function render(content) {
  const context = {
    exports: {},
    URL,
    require: (name) => {
      if (name === "react/jsx-runtime") return require(name)
      if (name === "@lib/data/homepage-content")
        return { getHomepageContent: async () => content }
      if (name === "@lib/brand/storefront-design")
        return {
          storefrontDesign: {
            featured: {
              handles: [],
              title: "Featured",
              eyebrow: "Selected pieces",
            },
          },
        }
      if (name === "@lib/data/categories")
        return { listCategories: async () => [] }
      if (name === "@lib/brand/category-links")
        return { brandCategoryHref: () => "/store" }
      if (name === "@lib/data/products")
        return { listProducts: async () => ({ response: { products: [] } }) }
      if (name === "@modules/common/components/localized-client-link")
        return {
          __esModule: true,
          default: ({ children, ...props }) =>
            React.createElement("a", props, children),
        }
      if (name === "@modules/products/components/product-card")
        return { __esModule: true, default: () => null }
      throw Error("Unexpected import " + name)
    },
  }
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(
        path.join(__dirname, "../src/modules/home/components/hero/index.tsx"),
        "utf8"
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }
    ).outputText,
    context
  )
  return renderToStaticMarkup(
    await context.exports.default({ countryCode: "us", collections: [] })
  )
}
test("image-only mode removes visible copy panels while retaining meaningful image/link/heading text", async () => {
  const content = structuredClone(defaults)
  content.hero.showText = false
  content.explore.showHeading = false
  content.explore.items.forEach((c) => (c.showText = false))
  const html = await render(content)
  assert.ok(!html.includes('class="rh-b-hero-copy"'))
  assert.ok(!html.includes('class="rh-b-collection-copy"'))
  assert.ok(html.includes('id="home-heading" class="sr-only"'))
  assert.ok(html.includes('id="collections-heading" class="sr-only"'))
  assert.ok(html.includes('aria-label="Shop the edit"'))
  assert.ok(html.includes('alt="' + content.hero.imageAlt + '"'))
  assert.ok(html.includes("rh-b-collection-image-only"))
  assert.ok(html.includes('srcSet="' + content.hero.mobileImage + '"'))
})
test("hidden hero/explore sections do not remove the page heading or other homepage sections", async () => {
  const content = structuredClone(defaults)
  content.hero.enabled = false
  content.explore.enabled = false
  const html = await render(content)
  assert.ok(html.includes('<h1 class="sr-only">' + content.seo.title + "</h1>"))
  assert.ok(!html.includes("rh-b-hero-photo"))
  assert.ok(!html.includes("rh-b-collections"))
  assert.ok(html.includes("featured-heading"))
  assert.ok(html.includes("our-story"))
})

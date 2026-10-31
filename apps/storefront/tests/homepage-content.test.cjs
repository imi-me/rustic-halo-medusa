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
    require("../../backend/src/lib/storefront-content/defaults.json"),
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
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    context,
  )
  return renderToStaticMarkup(
    await context.exports.default({ countryCode: "us", collections: [] }),
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
test("hero appearance changes only the panel background and box dimensions", async () => {
  const content = structuredClone(defaults)
  content.hero.textBoxOpacity = 35
  content.hero.textBoxSize = "wide"
  const html = await render(content)
  assert.match(html, /--rh-hero-box-alpha:0.35/)
  assert.match(html, /--rh-hero-box-width:520px/)
  assert.ok(!html.includes('style="opacity:'))
  assert.ok(html.includes(content.hero.action))
  content.hero.textBoxOpacity = 0
  assert.match(await render(content), /data-box-clear="true"/)
  content.hero.textBoxOpacity = 100
  content.hero.textBoxSize = "compact"
  const solid = await render(content)
  assert.match(solid, /--rh-hero-box-alpha:1/)
  assert.match(solid, /--rh-hero-box-width:320px/)
  assert.ok(!solid.includes('data-box-clear="true"'))
})
test("legacy or invalid appearance values retain a bounded safe layout", async () => {
  const content = structuredClone(defaults)
  delete content.hero.textBoxOpacity
  delete content.hero.textBoxSize
  assert.match(await render(content), /--rh-hero-box-alpha:0.93/)
  content.hero.textBoxOpacity = 1000
  content.hero.textBoxSize = "invalid"
  const html = await render(content)
  assert.match(html, /--rh-hero-box-alpha:1/)
  assert.match(html, /--rh-hero-box-width:380px/)
})
test("hero text styling emits safe, responsive values without changing the button", async () => {
  const content = structuredClone(defaults)
  Object.assign(content.hero, {
    textColor: "light",
    textSize: "large",
    textBoxOpacity: 0,
  })
  const light = await render(content)
  assert.match(light, /--rh-hero-text-color:#ffffff/)
  assert.match(light, /--rh-hero-title-size:52px/)
  assert.match(light, /--rh-hero-body-size:16px/)
  assert.match(light, /--rh-hero-phone-title-size:40px/)
  assert.ok(light.includes('class="rh-b-button"'))
  Object.assign(content.hero, {
    textColor: "custom",
    customTextColor: "#6f2b3f",
    textSize: "small",
  })
  const custom = await render(content)
  assert.match(custom, /--rh-hero-text-color:#6f2b3f/)
  assert.match(custom, /--rh-hero-title-size:36px/)
  assert.match(custom, /--rh-hero-phone-title-size:30px/)
})
test("old or invalid text styling safely uses the original palette and sizes", async () => {
  const content = structuredClone(defaults)
  for (const key of ["textColor", "customTextColor", "textSize"])
    delete content.hero[key]
  const old = await render(content)
  assert.ok(!old.includes("--rh-hero-text-color:"))
  assert.match(old, /--rh-hero-title-size:43px/)
  Object.assign(content.hero, {
    textColor: "custom",
    customTextColor: "url(unsafe)",
    textSize: "huge",
  })
  const invalid = await render(content)
  assert.ok(!invalid.includes("url(unsafe)"))
  assert.match(invalid, /--rh-hero-title-size:43px/)
})

test("hero positions use safe horizontal margins and legacy left placement", async () => {
  const content = structuredClone(defaults)
  for (const position of [undefined, "left", "center", "right", "invalid"]) {
    content.hero.textBoxPosition = position
    const html = await render(content)
    assert.ok(
      html.includes(
        `--rh-hero-box-start:${position === "center" || position === "right" ? "auto" : "45px"}`,
      ),
    )
    assert.ok(
      html.includes(
        `--rh-hero-box-end:${position === "right" ? "45px" : "auto"}`,
      ),
    )
    assert.ok(html.includes(content.hero.title))
  }
})

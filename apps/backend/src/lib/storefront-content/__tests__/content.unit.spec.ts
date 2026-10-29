import { defaultHomepage, homepageSchema, safeEditorialImage } from "../schema";
import { readHomepage, publicHomepage, saveHomepage } from "../store";
import { validateEditorialUpload } from "../upload";
import sharp from "sharp";
function operations() {
  let row: any = null;
  return {
    listAdminOperations: jest.fn(async () =>
      row ? [structuredClone(row)] : []
    ),
    createAdminOperations: jest.fn(async (data: any) => {
      row = { id: "op-homepage", ...structuredClone(data) };
      return row;
    }),
    updateAdminOperations: jest.fn(async (data: any) => {
      row = { ...row, ...structuredClone(data) };
      return row;
    }),
  };
}
test("draft saves stay private until explicitly published; stale writes cannot overwrite current content", async () => {
  const db = operations(),
    initial = await readHomepage(db),
    draft = structuredClone(defaultHomepage);
  draft.hero.title = "A new seasonal story";
  draft.hero.showText = false;
  const saved = await saveHomepage(db, draft, initial.revision, "draft");
  expect((await publicHomepage(db)).content.hero.title).toBe(
    defaultHomepage.hero.title
  );
  expect(await publicHomepage(db)).not.toHaveProperty("draft");
  await expect(
    saveHomepage(db, defaultHomepage, initial.revision, "publish")
  ).rejects.toThrow("another window");
  const published = await saveHomepage(db, draft, saved.revision, "publish");
  expect(published.published_at).toBeTruthy();
  expect((await publicHomepage(db)).content).toEqual(draft);
  const changed = structuredClone(draft);
  changed.seo.title = "Unpublished title";
  await saveHomepage(db, changed, published.revision, "draft");
  expect((await publicHomepage(db)).content.seo.title).toBe(draft.seo.title);
  expect(db.createAdminOperations).toHaveBeenCalledTimes(1);
});
test.each([
  "javascript:alert(1)",
  "https://outside.example/",
  "//outside.example/path",
  "/\\outside.example/path",
])("rejects unsafe storefront destination %s", (href) => {
  const content = structuredClone(defaultHomepage);
  content.hero.href = href;
  expect(homepageSchema.safeParse(content).success).toBe(false);
});
test("image-only layouts retain required headings, alt text and link labels", () => {
  const content = structuredClone(defaultHomepage);
  content.hero.showText = false;
  content.explore.items[0].showText = false;
  expect(homepageSchema.safeParse(content).success).toBe(true);
  for (const field of ["title", "imageAlt", "action"] as const) {
    const invalid = structuredClone(content);
    invalid.hero[field] = "";
    expect(homepageSchema.safeParse(invalid).success).toBe(false);
  }
  const invalid = structuredClone(content);
  invalid.explore.items[0].alt = "";
  expect(homepageSchema.safeParse(invalid).success).toBe(false);
});
test("does not accept unsupported content keys, duplicate collection IDs or untrusted image locations", () => {
  expect(
    homepageSchema.safeParse({
      ...defaultHomepage,
      keywords: "stuffed keywords",
    }).success
  ).toBe(false);
  const duplicate = structuredClone(defaultHomepage);
  duplicate.explore.items[1].id = duplicate.explore.items[0].id;
  expect(homepageSchema.safeParse(duplicate).success).toBe(false);
  expect(safeEditorialImage("https://cdn.rustichalo.com/editorial.jpg")).toBe(
    true
  );
  expect(safeEditorialImage("https://other.example/editorial.jpg")).toBe(false);
  expect(
    safeEditorialImage("https://user:pass@cdn.rustichalo.com/editorial.jpg")
  ).toBe(false);
  expect(safeEditorialImage("/brand/../private.env")).toBe(false);
  const env = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  expect(safeEditorialImage("http://localhost:9000/static/a.jpg")).toBe(false);
  process.env.NODE_ENV = env;
});
test("validates real image bytes without modifying the uploaded artwork", async () => {
  const original = await sharp({
    create: { width: 30, height: 20, channels: 3, background: "#bda180" },
  })
    .jpeg()
    .toBuffer();
  const result = await validateEditorialUpload(original.toString("base64"));
  expect(result.width).toBe(30);
  expect(result.height).toBe(20);
  expect(result.mime).toBe("image/jpeg");
  expect(result.input.equals(original)).toBe(true);
  await expect(
    validateEditorialUpload(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'
      ).toString("base64")
    )
  ).rejects.toThrow("still JPG");
  await expect(validateEditorialUpload("not-a-real-image")).rejects.toThrow(
    "Choose"
  );
  await expect(
    validateEditorialUpload(Buffer.alloc(8_000_001).toString("base64"))
  ).rejects.toThrow("under 8 MB");
});

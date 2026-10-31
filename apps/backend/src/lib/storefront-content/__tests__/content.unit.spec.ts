import { defaultHomepage, homepageSchema, safeEditorialImage } from "../schema";
import { readHomepage, publicHomepage, saveHomepage } from "../store";
import { validateEditorialUpload } from "../upload";
import sharp from "sharp";
function operations() {
  let row: any = null;
  return {
    listAdminOperations: jest.fn(async () =>
      row ? [structuredClone(row)] : [],
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
    defaultHomepage.hero.title,
  );
  expect(await publicHomepage(db)).not.toHaveProperty("draft");
  await expect(
    saveHomepage(db, defaultHomepage, initial.revision, "publish"),
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
    }).success,
  ).toBe(false);
  const duplicate = structuredClone(defaultHomepage);
  duplicate.explore.items[1].id = duplicate.explore.items[0].id;
  expect(homepageSchema.safeParse(duplicate).success).toBe(false);
  expect(safeEditorialImage("https://cdn.rustichalo.com/editorial.jpg")).toBe(
    true,
  );
  expect(safeEditorialImage("https://other.example/editorial.jpg")).toBe(false);
  expect(
    safeEditorialImage("https://user:pass@cdn.rustichalo.com/editorial.jpg"),
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
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>',
      ).toString("base64"),
    ),
  ).rejects.toThrow("still JPG");
  await expect(validateEditorialUpload("not-a-real-image")).rejects.toThrow(
    "Choose",
  );
  await expect(
    validateEditorialUpload(Buffer.alloc(8_000_001).toString("base64")),
  ).rejects.toThrow("under 8 MB");
});
test("old saved homepages inherit appearance defaults without a write", async () => {
  const db = operations(),
    legacy: any = structuredClone(defaultHomepage);
  delete legacy.hero.textBoxOpacity;
  delete legacy.hero.textBoxSize;
  await db.createAdminOperations({
    operation_key: "storefront-homepage:v1",
    payload: {
      draft: legacy,
      published: legacy,
      revision: "legacy",
      published_at: "2026-10-29T00:00:00Z",
    },
  });
  const state = await readHomepage(db);
  expect(state.draft.hero.textBoxOpacity).toBe(93);
  expect(state.published?.hero.textBoxSize).toBe("standard");
  expect(state.revision).toBe("legacy");
  expect(db.updateAdminOperations).not.toHaveBeenCalled();
});
test("appearance choices save privately, publish explicitly and survive hidden text", async () => {
  const db = operations(),
    initial = await readHomepage(db),
    draft = structuredClone(defaultHomepage);
  draft.hero.textBoxOpacity = 0;
  draft.hero.textBoxSize = "wide";
  draft.hero.showText = false;
  const saved = await saveHomepage(db, draft, initial.revision, "draft");
  expect((await readHomepage(db)).draft.hero).toEqual(draft.hero);
  expect((await publicHomepage(db)).content.hero.textBoxOpacity).toBe(93);
  await saveHomepage(db, draft, saved.revision, "publish");
  expect((await publicHomepage(db)).content.hero).toEqual(draft.hero);
});
test("rejects invalid hero opacity and unsupported box sizes", () => {
  for (const value of [-1, 101, 25.5, "50", null]) {
    const draft: any = structuredClone(defaultHomepage);
    draft.hero.textBoxOpacity = value;
    expect(homepageSchema.safeParse(draft).success).toBe(false);
  }
  const draft: any = structuredClone(defaultHomepage);
  draft.hero.textBoxSize = "giant";
  expect(homepageSchema.safeParse(draft).success).toBe(false);
});
test("legacy homepages retain original colors and type size without a write", async () => {
  const db = operations(),
    legacy: any = structuredClone(defaultHomepage);
  for (const key of ["textColor", "customTextColor", "textSize"])
    delete legacy.hero[key];
  await db.createAdminOperations({
    operation_key: "storefront-homepage:v1",
    payload: {
      draft: legacy,
      published: legacy,
      revision: "legacy-text",
      published_at: "2026-10-30T00:00:00Z",
    },
  });
  const state = await readHomepage(db);
  expect(state.draft.hero.textColor).toBe("original");
  expect(state.published?.hero.textSize).toBe("standard");
  expect(state.draft.hero.customTextColor).toBe("#292932");
  expect(state.revision).toBe("legacy-text");
  expect(db.updateAdminOperations).not.toHaveBeenCalled();
});
test("text styling persists through hidden copy and remains private until publication", async () => {
  const db = operations(),
    initial = await readHomepage(db),
    draft = structuredClone(defaultHomepage);
  Object.assign(draft.hero, {
    textColor: "custom",
    customTextColor: "#6F2B3F",
    textSize: "large",
    showText: false,
  });
  const saved = await saveHomepage(db, draft, initial.revision, "draft");
  expect((await readHomepage(db)).draft.hero).toEqual(draft.hero);
  expect((await publicHomepage(db)).content.hero.textColor).toBe("original");
  await saveHomepage(db, draft, saved.revision, "publish");
  expect((await publicHomepage(db)).content.hero).toEqual(draft.hero);
});
test("text styling accepts bounded presets and hexadecimal colors only", () => {
  for (const patch of [
    { textColor: "url(javascript:alert(1))" },
    { textColor: null },
    { textSize: "72px" },
    { textSize: 99 },
    ...["#fff", "#ffffff00", "red", "url(x)", "</style>"].map(
      (customTextColor) => ({ customTextColor }),
    ),
  ]) {
    const draft = structuredClone(defaultHomepage);
    Object.assign(draft.hero, patch);
    expect(homepageSchema.safeParse(draft).success).toBe(false);
  }
  const draft = structuredClone(defaultHomepage);
  Object.assign(draft.hero, {
    textColor: "custom",
    customTextColor: "#A1b2C3",
    textSize: "small",
  });
  expect(homepageSchema.safeParse(draft).success).toBe(true);
});

test("legacy hero positions default left without changing saved content", async () => {
  const db = operations(),
    legacy: any = structuredClone(defaultHomepage);
  delete legacy.hero.textBoxPosition;
  await db.createAdminOperations({
    operation_key: "storefront-homepage:v1",
    payload: {
      draft: legacy,
      published: legacy,
      revision: "legacy-position",
      published_at: "2026-10-31T00:00:00Z",
    },
  });
  const state = await readHomepage(db);
  expect(state.draft.hero.textBoxPosition).toBe("left");
  expect(state.published?.hero.textBoxPosition).toBe("left");
  expect(state.revision).toBe("legacy-position");
  expect(db.updateAdminOperations).not.toHaveBeenCalled();
});
test("hero positions survive hidden text and publish only explicitly", async () => {
  for (const textBoxPosition of ["left", "center", "right"] as const) {
    const db = operations(),
      initial = await readHomepage(db),
      draft = structuredClone(defaultHomepage);
    Object.assign(draft.hero, { textBoxPosition, showText: false });
    const saved = await saveHomepage(db, draft, initial.revision, "draft");
    expect((await readHomepage(db)).draft.hero.textBoxPosition).toBe(
      textBoxPosition,
    );
    expect((await publicHomepage(db)).content.hero.textBoxPosition).toBe(
      "left",
    );
    await saveHomepage(db, draft, saved.revision, "publish");
    expect((await publicHomepage(db)).content.hero).toEqual(draft.hero);
  }
});
test("only left center and right are accepted as hero positions", () => {
  for (const textBoxPosition of ["top", "auto", "", null, 2]) {
    const draft = structuredClone(defaultHomepage);
    Object.assign(draft.hero, { textBoxPosition });
    expect(homepageSchema.safeParse(draft).success).toBe(false);
  }
});

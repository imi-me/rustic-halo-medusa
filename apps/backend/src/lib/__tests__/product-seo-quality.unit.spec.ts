const workflow = jest.fn();
jest.mock("@medusajs/medusa/core-flows", () => ({
  updateProductsWorkflow: () => ({ run: workflow }),
}));
jest.mock("../admin-assistant", () => ({
  isReady: () => true,
  acquire: () => () => {},
  configuration: () => ({
    endpoint: "https://api.openai.com/v1/responses",
    key: "mock",
    model: "configured-model",
  }),
  providerOptions: () => ({}),
}));
import {
  seoOptionFacts,
  draftSeoOptionFacts,
  seoOptionsRevision,
} from "../product-seo-options";
import {
  conservativeSeoCopy,
  descriptionFingerprint,
  seoQualityIssue,
} from "../product-seo-quality";
import { generateSeoBatch } from "../admin-assistant/product-seo-batch";
import { copyInputSchema } from "../admin-assistant/product-copy";
import { POST } from "../../api/admin/assistant/product-copy/route";
import {
  applyBulkSeo,
  processBulkSeo,
  readBulkSeo,
  startBulkSeo,
  BULK_SEO_KEY,
} from "../bulk-product-seo";
const palette = [
  { name: "Black", slug: "black", hex: "#000000", active: true, sizes: ["4"] },
  { name: "Rose", slug: "rose", hex: "#cc8888", active: true, sizes: ["2"] },
  { name: "Gray", slug: "gray", hex: "#999999", active: false },
] as any;
const claw = () => ({
  id: "prod_coffee",
  title: "Coffee Cup Hair Claw",
  description:
    "A laser-engraved wood coffee cup design. Available in 2-inch and 4-inch sizes.",
  material: "",
  handle: "coffee",
  status: "published",
  updated_at: "2026-10-30T04:00:00.000Z",
  options: [
    { id: "size", title: "Claw size" },
    { id: "finish", title: "Claw finish" },
    { id: "color", title: "Base color" },
  ],
  variants: [
    ["four_black", "4 inch", "Natural", "Black"],
    ["four_rose", "4 inch", "Natural", "Rose"],
    ["two_rose", "2 inch", "Colors by Cate", "Rose"],
    ["four_gray", "4 inch", "Natural", "Gray"],
  ].map(([id, size, finish, color]) => ({
    id,
    options: [
      { option_id: "size", value: size },
      { option_id: "finish", value: finish },
      { option_id: "color", value: color },
    ],
  })),
  metadata: {
    hair_claw_template_v2: {
      version: 2,
      variant_ids: ["four_black", "four_rose", "two_rose", "four_gray"],
      option_ids: ["size", "finish", "color"],
      size_option_id: "size",
      finish_option_id: "finish",
      color_option_id: "color",
      offer_mode: true,
    },
    hair_claw_overlays_v1: {
      recipes: { "4-natural": { enabled: true }, "2-cbc": { enabled: false } },
      offers: {
        "4-natural": { variant_ids: ["four_black", "four_rose", "four_gray"] },
        "2-cbc": { variant_ids: ["two_rose"] },
      },
    },
  },
});
const response = (products: any[]) =>
  ({
    ok: true,
    json: async () => ({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: JSON.stringify({ products }) },
          ],
        },
      ],
    }),
  }) as Response;
const source = () => ({
  id: "prod_coffee",
  title: "Coffee Cup Hair Claw",
  description: claw().description,
  material: "",
  options: seoOptionFacts(claw(), palette),
});
beforeEach(() => workflow.mockReset());
it("uses only exposed variants and active, size-compatible colors; never expands a cross-product", () => {
  const p = claw(),
    facts = seoOptionFacts(p, palette);
  expect(facts.sizes).toEqual(["4"]);
  expect(facts.finishes).toEqual(["Natural"]);
  expect(facts.options.find((o) => o.name === "Color")?.values).toEqual([
    "Black",
  ]);
  expect(facts.combinations).toHaveLength(1);
  p.metadata.hair_claw_overlays_v1.recipes["2-cbc"].enabled = true;
  const both = seoOptionFacts(p, palette);
  expect(both.sizes).toEqual(["2", "4"]);
  expect(both.combinations).toHaveLength(2);
  expect(
    seoQualityIssue(
      { ...source(), options: both },
      {
        title: "Coffee Cup Hair Claw",
        description:
          "Coffee Cup Hair Claw with a 4-inch Colors by Cate finish.",
      },
      [],
    ),
  ).toContain("not offered together");
  expect(
    seoQualityIssue(
      source(),
      {
        title: "Coffee Cup Hair Claw",
        description: "A two-inch Coffee Cup Hair Claw with a wood design.",
      },
      [],
    ),
  ).toContain("confirmed sizes");
  expect(
    seoQualityIssue(
      source(),
      {
        title: "Coffee Cup Hair Claw",
        description: "Coffee Cup Hair Claw with a hand-painted finish.",
      },
      [],
    ),
  ).toContain("not enabled");
});
it("respects order-color choices, group exclusions and palette retirement", () => {
  const p: any = claw();
  p.metadata.hair_claw_template_v2 = {
    ...p.metadata.hair_claw_template_v2,
    color_mode: "order",
    variant_ids: ["four_black", "two_rose"],
    order_choices: {
      four_black: {
        size: "4",
        finish: "natural",
        options: [
          { option_id: "size", value: "4 inch" },
          { option_id: "finish", value: "Natural" },
        ],
      },
      two_rose: {
        size: "2",
        finish: "cbc",
        options: [
          { option_id: "size", value: "2 inch" },
          { option_id: "finish", value: "Colors by Cate" },
        ],
      },
    },
  };
  let result = seoOptionFacts(p, palette);
  expect(result.combinations.map((c) => c.colors?.values)).toEqual([
    ["Rose"],
    ["Black"],
  ]);
  p.metadata.hair_claw_colors_v1 = { excluded: ["Rose"] };
  result = seoOptionFacts(p, palette);
  expect(result.sizes).toEqual(["4"]);
  expect(result.combinations[0].colors?.values).toEqual(["Black"]);
  expect(seoOptionsRevision(result)).not.toBe(
    seoOptionsRevision(
      seoOptionFacts(
        claw(),
        palette.map((c: any) => ({ ...c, sizes: undefined })),
      ),
    ),
  );
});
it("uses actual generated new-product combinations and never invents options when none exist", () => {
  const facts = draftSeoOptionFacts("New Hair Claw", [
    { Size: "4 inch", Finish: "Natural", Color: "Black" },
    { Size: "2 inch", Finish: "Painted", Color: "Rose" },
  ]);
  expect(facts.source).toBe("draft_variants");
  expect(facts.combinations).toHaveLength(2);
  expect(facts.sizes).toEqual(["2", "4"]);
  const unknown = draftSeoOptionFacts("New Hair Claw");
  expect(unknown.verified).toBe(false);
  expect(
    seoQualityIssue(
      { ...source(), options: unknown },
      { title: "New Hair Claw", description: "A 4-inch New Hair Claw." },
      [],
    ),
  ).toContain("none confirmed");
  expect(
    copyInputSchema.safeParse({
      action: "product-seo",
      product_id: "prod_coffee",
      draft_options: [{ Size: "2 inch" }],
      title: "Coffee",
      description: "",
      material: "",
      facts: "",
      category: "",
      attributes: "",
      locked_tags: [],
    }).success,
  ).toBe(false);
});
it("retries only invalid option wording, with authoritative context overriding old imported text", async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce(
      response([
        {
          id: "prod_coffee",
          title: "Coffee Cup Hair Claw",
          description: "A 2-inch Coffee Cup Hair Claw with wood detail.",
        },
      ]),
    )
    .mockResolvedValueOnce(
      response([
        {
          id: "prod_coffee",
          title: "Coffee Cup Hair Claw",
          description:
            "A 4-inch Coffee Cup Hair Claw with an engraved wood design.",
        },
      ]),
    );
  const [result] = await generateSeoBatch([source()], request);
  expect(result.description).toContain("4-inch");
  expect(request).toHaveBeenCalledTimes(2);
  const first = JSON.parse(request.mock.calls[0][1].body),
    second = JSON.parse(request.mock.calls[1][1].body);
  expect(
    JSON.parse(first.input[0].content).products[0].verified_options.sizes,
  ).toEqual(["4"]);
  expect(
    JSON.parse(second.input[0].content).products[0].revision_feedback,
  ).toContain("confirmed sizes");
  expect(first.tools).toBeUndefined();
  expect(first.store).toBe(false);
});
it("checks normalized duplicates within a batch, across saved products and across later batches", async () => {
  expect(descriptionFingerprint("A wood coaster — with style!")).toBe(
    descriptionFingerprint("A WOOD coaster, with style."),
  );
  const alpha = {
      id: "prod_alpha",
      title: "Alpha Coaster",
      description: "Laser-engraved wood coaster.",
      material: "",
    },
    beta = { ...alpha, id: "prod_beta", title: "Beta Coaster" };
  const same = "Alpha coaster in natural wood, with an engraved design.";
  const request = jest
    .fn()
    .mockResolvedValueOnce(
      response([
        { id: alpha.id, title: alpha.title, description: same },
        { id: beta.id, title: beta.title, description: same },
      ]),
    )
    .mockResolvedValueOnce(
      response([
        {
          id: beta.id,
          title: beta.title,
          description: "Beta coaster in natural wood, with an engraved design.",
        },
      ]),
    );
  const first = await generateSeoBatch([alpha, beta], request);
  expect(new Set(first.map((p) => p.description)).size).toBe(2);
  expect(request).toHaveBeenCalledTimes(2);
  expect(
    JSON.parse(
      JSON.parse(request.mock.calls[1][1].body).input[0].content,
    ).products.map((p: any) => p.id),
  ).toEqual(["prod_beta"]);
  const next = jest
    .fn()
    .mockResolvedValueOnce(
      response([
        { id: alpha.id, title: alpha.title, description: first[1].description },
      ]),
    )
    .mockResolvedValueOnce(
      response([
        {
          id: alpha.id,
          title: alpha.title,
          description:
            "Alpha is a laser-engraved wooden coaster with a distinct design.",
        },
      ]),
    );
  const later = await generateSeoBatch(
    [alpha],
    next,
    first.map((p) => ({ id: p.id, description: p.description })),
  );
  expect(later[0].description).not.toBe(first[1].description);
  expect(next).toHaveBeenCalledTimes(2);
});
it("rejects generic family boilerplate even before duplication and falls back safely after one retry", async () => {
  const p = {
      id: "prod_elijah",
      title: "Elijah Craig Coaster",
      description: "A laser-engraved natural wood coaster.",
      material: "",
    },
    request = jest.fn(async () =>
      response([
        {
          id: p.id,
          title: p.title,
          description: "A laser-engraved wood coaster for your home bar.",
        },
      ]),
    );
  const [result] = await generateSeoBatch([p], request);
  expect(request).toHaveBeenCalledTimes(2);
  expect(result.description).toContain("Elijah Craig");
  expect(result.error).toBeUndefined();
  const invalid = jest.fn(async () =>
    response([
      {
        id: "prod_coffee",
        title: "Coffee Cup Hair Claw",
        description: "A 2-inch Coffee Cup Hair Claw.",
      },
    ]),
  );
  const [safe] = await generateSeoBatch([source()], invalid);
  expect(invalid).toHaveBeenCalledTimes(2);
  expect(safe.description).toContain("4-inch");
  expect(safe.description).not.toContain("2-inch");
  expect(safe.error).toBeUndefined();
  expect(seoQualityIssue(source(), safe, [])).toBeNull();
  const fallback = conservativeSeoCopy(p),
    blocked = jest.fn(async () =>
      response([
        { id: p.id, title: p.title, description: "Elijah Craig coaster." },
      ]),
    );
  const [failure] = await generateSeoBatch([p], blocked, [
    { id: "prod_other", description: "Elijah Craig coaster." },
    { id: "prod_other2", description: fallback.description },
  ]);
  expect(failure.error).toContain("distinct, accurate");
  expect(failure.description).toBe("");
});
it("preserves existing custom fields and does not treat a product’s own current description as a duplicate", async () => {
  const p = {
      ...source(),
      preservedTitle: "My custom title",
      preservedDescription: "My custom description.",
    },
    request = jest.fn(async () =>
      response([
        {
          id: p.id,
          title: "Coffee Cup Hair Claw",
          description: "A 4-inch Coffee Cup Hair Claw with a wood design.",
        },
      ]),
    );
  const [result] = await generateSeoBatch([p], request, [
    { id: p.id, description: p.preservedDescription },
  ]);
  expect(result.title).toBe(p.preservedTitle);
  expect(result.description).toBe(p.preservedDescription);
  expect(request).toHaveBeenCalledTimes(1);
});
function fixture() {
  let stored: any = null;
  const product: any = claw(),
    products = [product];
  const ops = {
    listAdminOperations: async (filter: any) =>
      filter.operation_key === BULK_SEO_KEY && stored
        ? [structuredClone(stored)]
        : filter.operation_key === "hair-claw-colors:v1"
          ? [{ payload: { colors: palette, revision: "palette-one" } }]
          : [],
    createAdminOperations: async (row: any) =>
      (stored = { id: "operation", ...structuredClone(row) }),
    updateAdminOperations: async (row: any) =>
      (stored = { ...stored, ...structuredClone(row) }),
  };
  const service = {
    listAndCountProducts: async () => [
      structuredClone(products),
      products.length,
    ],
    listProducts: async ({ id }: any) =>
      structuredClone(products.filter((p) => id.includes(p.id))),
    retrieveProduct: async () => structuredClone(product),
  };
  const scope: any = {
    resolve: (key: string) =>
      key === "product"
        ? service
        : key === "admin_operations"
          ? ops
          : key === "locking"
            ? { execute: async (_key: string, fn: any) => fn() }
            : null,
  };
  return { scope, product, products, ops };
}
it("refreshes options at generation and refuses a save after enabled options change without a product timestamp change", async () => {
  const f = fixture();
  await startBulkSeo(f.scope, "user", "empty");
  let seen: any;
  await processBulkSeo(f.scope, async (rows) => {
    seen = rows;
    return rows.map((p) => ({
      id: p.id,
      title: p.title,
      description:
        "A 4-inch Coffee Cup Hair Claw with an engraved wood design.",
    }));
  });
  expect(seen[0].options.sizes).toEqual(["4"]);
  let state = await readBulkSeo(f.scope);
  expect(state.run!.rows[0].status).toBe("ready");
  const revision = f.product.updated_at;
  f.product.metadata.hair_claw_overlays_v1.recipes["4-natural"].enabled = false;
  state = await applyBulkSeo(f.scope, state.run!.id, [
    { id: f.product.id, ...state.run!.rows[0].suggestion! },
  ]);
  expect(f.product.updated_at).toBe(revision);
  expect(state.run!.rows[0].status).toBe("stale");
  expect(state.run!.rows[0].error).toContain("options changed");
  expect(workflow).not.toHaveBeenCalled();
});
it("loads saved option facts for the inline helper and never writes a product while generating", async () => {
  const f = fixture(),
    prior = global.fetch;
  global.fetch = jest.fn(async () =>
    response([
      {
        id: f.product.id,
        title: f.product.title,
        description:
          "A 4-inch Coffee Cup Hair Claw with an engraved wood design.",
      },
    ]),
  ) as any;
  const req: any = {
      scope: f.scope,
      auth_context: { actor_type: "user", actor_id: "user" },
      headers: {},
      body: {
        action: "product-seo",
        product_id: f.product.id,
        title: f.product.title,
        description: f.product.description,
        material: "",
        facts: "Use the old 2-inch sizes",
        category: "",
        attributes: "",
        locked_tags: [],
        photos: [],
      },
    },
    res: any = {};
  res.setHeader = jest.fn();
  res.json = jest.fn(() => res);
  res.status = jest.fn(() => res);
  res.sendStatus = jest.fn(() => res);
  try {
    await POST(req, res);
    const output = res.json.mock.calls[0][0];
    expect(output.option_source).toBe("saved_variants");
    expect(output.suggestion.description).toContain("4-inch");
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(
      JSON.parse(body.input[0].content).products[0].verified_options.sizes,
    ).toEqual(["4"]);
    expect(workflow).not.toHaveBeenCalled();
  } finally {
    global.fetch = prior;
  }
});

it("rejects copied option palettes and retries with natural product copy", async () => {
  const p = source();
  p.options.options.push({
    name: "Color",
    values: ["Black", "Espresso", "Ivory", "Rose", "Purple"],
  });
  const copy = {
    id: p.id,
    title: p.title,
    description:
      "A 4-inch Coffee Cup Hair Claw in Black, Espresso, Ivory, Rose and Purple.",
  };
  expect(seoQualityIssue(p, copy, [])).toContain("palette");
  const request = jest
    .fn()
    .mockResolvedValueOnce(response([copy]))
    .mockResolvedValueOnce(
      response([
        {
          id: p.id,
          title: p.title,
          description:
            "A 4-inch Coffee Cup Hair Claw with a playful engraved wood design for coffee lovers.",
        },
      ]),
    );
  const [result] = await generateSeoBatch([p], request);
  expect(request).toHaveBeenCalledTimes(2);
  expect(result.description).not.toContain("Espresso");
  expect(result.error).toBeUndefined();
});

it("rejects name-swapped boilerplate and retries only the repeated product", async () => {
  const alpha = {
    id: "elijah",
    title: "Elijah Craig Coaster",
    description: "Laser-engraved natural wood coaster.",
    material: "",
  };
  const beta = { ...alpha, id: "wild", title: "Wild Turkey Coaster" };
  const copy = (p: typeof alpha) => ({
    id: p.id,
    title: p.title,
    description: `Laser-engraved natural wood ${p.title} for a rustic home bar accent. It helps protect tables and countertops while adding bourbon-inspired style.`,
  });
  const first = copy(alpha),
    repeated = copy(beta),
    distinct = {
      id: beta.id,
      title: beta.title,
      description:
        "Wild Turkey Coaster pairs natural wood with laser-engraved detail, adding a bourbon-inspired accent to a home bar.",
    };
  expect(seoQualityIssue(beta, repeated, [first])).toContain(
    "changing only its name",
  );
  expect(seoQualityIssue(beta, distinct, [first])).toBeNull();
  expect(seoQualityIssue(alpha, first, [first])).toBeNull();
  const request = jest
    .fn()
    .mockResolvedValueOnce(response([first, repeated]))
    .mockResolvedValueOnce(response([distinct]));
  const result = await generateSeoBatch([alpha, beta], request);
  expect(request).toHaveBeenCalledTimes(2);
  const retry = JSON.parse(
    JSON.parse(request.mock.calls[1][1].body).input[0].content,
  ).products;
  expect(retry.map((p: any) => p.id)).toEqual([beta.id]);
  expect(retry[0].revision_feedback).toContain(first.description);
  expect(result[0].description).toBe(first.description);
  expect(result[1].description).toBe(distinct.description);
});
it("allows distinct descriptions sharing a short material phrase", () => {
  const p = {
    id: "rose",
    title: "Rose Earrings",
    description: "Wood earrings",
    material: "",
  };
  expect(
    seoQualityIssue(
      p,
      {
        title: p.title,
        description: "Rose earrings in natural wood with a floral design.",
      },
      [
        {
          id: "sun",
          description: "Sun earrings in natural wood with a round design.",
        },
      ],
    ),
  ).toBeNull();
});

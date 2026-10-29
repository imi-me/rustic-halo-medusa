import { randomUUID } from "node:crypto";
import {
  defaultHomepage,
  homepageSchema,
  HOMEPAGE_KEY,
  type HomepageContent,
} from "./schema";
export type HomepageState = {
  draft: HomepageContent;
  published: HomepageContent | null;
  revision: string;
  published_at: string | null;
};
export class HomepageConflict extends Error {}
type Operations = {
  listAdminOperations(filters: { operation_key: string }): Promise<any[]>;
  createAdminOperations(data: any): Promise<any>;
  updateAdminOperations(data: any): Promise<any>;
};
export async function readHomepage(
  operations: Operations
): Promise<HomepageState> {
  const [row] = await operations.listAdminOperations({
    operation_key: HOMEPAGE_KEY,
  });
  if (!row)
    return {
      draft: structuredClone(defaultHomepage),
      published: null,
      revision: "defaults-v1",
      published_at: null,
    };
  return {
    draft: homepageSchema.parse(row.payload.draft),
    published: row.payload.published
      ? homepageSchema.parse(row.payload.published)
      : null,
    revision: String(row.payload.revision),
    published_at:
      typeof row.payload.published_at === "string"
        ? row.payload.published_at
        : null,
  };
}
export async function publicHomepage(operations: Operations) {
  const state = await readHomepage(operations);
  return {
    content: state.published || defaultHomepage,
    published_at: state.published_at,
  };
}
export async function saveHomepage(
  operations: Operations,
  content: unknown,
  expected: string,
  action: "draft" | "publish"
): Promise<HomepageState> {
  const draft = homepageSchema.parse(content);
  const state = await readHomepage(operations);
  if (state.revision !== expected)
    throw new HomepageConflict(
      "This homepage changed in another window. Reload the saved version before applying your changes. Your unsaved work is still visible."
    );
  const payload: HomepageState = {
    draft,
    published: action === "publish" ? draft : state.published,
    revision: randomUUID(),
    published_at:
      action === "publish" ? new Date().toISOString() : state.published_at,
  };
  const [row] = await operations.listAdminOperations({
    operation_key: HOMEPAGE_KEY,
  });
  if (row)
    await operations.updateAdminOperations({
      id: row.id,
      status: action === "publish" ? "published" : "draft",
      payload,
    });
  else
    await operations.createAdminOperations({
      operation_key: HOMEPAGE_KEY,
      kind: "storefront-homepage",
      resource_id: "homepage",
      status: action === "publish" ? "published" : "draft",
      payload,
    });
  return payload;
}

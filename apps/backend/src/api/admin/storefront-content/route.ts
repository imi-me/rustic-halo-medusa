import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { ADMIN_OPERATIONS } from "../../../modules/admin-operations";
import { allowedOrigin } from "../assistant/route";
import {
  HomepageConflict,
  readHomepage,
  saveHomepage,
} from "../../../lib/storefront-content/store";
function storefrontOrigin() {
  return (
    (process.env.STORE_CORS || "")
      .split(",")
      .map((s) => s.trim())
      .find((s) => /^https?:\/\//.test(s)) || "http://localhost:8000"
  );
}
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  res.setHeader("Cache-Control", "no-store");
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== "user")
    return res.sendStatus(401);
  return res.json({
    ...(await readHomepage(req.scope.resolve(ADMIN_OPERATIONS))),
    storefront_url: storefrontOrigin(),
  });
}
export async function POST(
  req: AuthenticatedMedusaRequest<{
    action?: unknown;
    content?: unknown;
    expected_revision?: unknown;
  }>,
  res: MedusaResponse
) {
  res.setHeader("Cache-Control", "no-store");
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== "user")
    return res.sendStatus(401);
  if (!allowedOrigin(req)) return res.sendStatus(403);
  const body = req.body;
  if (
    !body ||
    typeof body.expected_revision !== "string" ||
    !["draft", "publish"].includes(String(body.action))
  )
    return res
      .status(400)
      .json({ message: "Reload the homepage editor before saving." });
  try {
    const result = await req.scope
      .resolve(Modules.LOCKING)
      .execute("rh-storefront-homepage", () =>
        saveHomepage(
          req.scope.resolve(ADMIN_OPERATIONS),
          body.content,
          body.expected_revision as string,
          body.action as "draft" | "publish"
        )
      );
    return res.json({ ...result, storefront_url: storefrontOrigin() });
  } catch (error) {
    const invalid = (error as any).name === "ZodError";
    const conflict = error instanceof HomepageConflict;
    return res
      .status(invalid ? 400 : conflict ? 409 : 503)
      .json({
        message: invalid
          ? "Check the required text, image descriptions, and storefront links before saving."
          : conflict
          ? error.message
          : "The homepage could not be saved. Your edits are still visible; please try again.",
      });
  }
}

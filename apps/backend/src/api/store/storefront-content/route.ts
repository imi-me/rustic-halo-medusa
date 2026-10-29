import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ADMIN_OPERATIONS } from "../../../modules/admin-operations";
import { publicHomepage } from "../../../lib/storefront-content/store";
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "no-store");
  return res.json(await publicHomepage(req.scope.resolve(ADMIN_OPERATIONS)));
}

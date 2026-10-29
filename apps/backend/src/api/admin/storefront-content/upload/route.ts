import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { IFileModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { randomUUID } from "node:crypto";
import { allowedOrigin } from "../../assistant/route";
import { validateEditorialUpload } from "../../../../lib/storefront-content/upload";
export async function POST(
  req: AuthenticatedMedusaRequest<{ content?: unknown; filename?: unknown }>,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== "user")
    return res.sendStatus(401);
  if (!allowedOrigin(req)) return res.sendStatus(403);
  let image: Awaited<ReturnType<typeof validateEditorialUpload>>;
  try {
    image = await validateEditorialUpload(req.body?.content);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
  try {
    const base =
      typeof req.body?.filename === "string"
        ? req.body.filename
            .replace(/\.[^.]+$/, "")
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .slice(0, 70)
        : "homepage";
    const files: IFileModuleService = req.scope.resolve(Modules.FILE);
    const file = await files.createFiles({
      filename: `${base || "homepage"}-${randomUUID()}.${image.extension}`,
      mimeType: image.mime,
      content: image.input.toString("base64"),
      access: "public",
    });
    return res.json({
      id: file.id,
      url: file.url,
      width: image.width,
      height: image.height,
      bytes: image.input.length,
    });
  } catch {
    return res
      .status(503)
      .json({
        message:
          "The image could not be uploaded. Please try again; your other edits are still available.",
      });
  }
}

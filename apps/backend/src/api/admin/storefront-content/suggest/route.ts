import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { acquire, isReady } from "../../../../lib/admin-assistant";
import { allowedOrigin } from "../../assistant/route";
import {
  suggestionInput,
  suggestHomepage,
} from "../../../../lib/storefront-content/suggestions";
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  res.setHeader("Cache-Control", "no-store");
  const actor = req.auth_context?.actor_id;
  if (!actor || req.auth_context.actor_type !== "user")
    return res.sendStatus(401);
  if (!allowedOrigin(req)) return res.sendStatus(403);
  const parsed = suggestionInput.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({
        message:
          "Give Rusty a short brief and the current section details. Your draft is unchanged.",
      });
  if (!isReady())
    return res
      .status(503)
      .json({
        message:
          "Ask Rusty is not available yet. You can still write and save your own wording.",
      });
  const release = acquire(actor);
  if (!release)
    return res
      .status(429)
      .json({
        message:
          "One Rusty request at a time, up to 10 per hour. Please try again later.",
      });
  try {
    return res.json({ suggestion: await suggestHomepage(parsed.data) });
  } catch {
    return res
      .status(502)
      .json({
        message:
          "Rusty could not finish this suggestion. Check the selected photo or try a shorter brief. Your draft is unchanged.",
      });
  } finally {
    release();
  }
}

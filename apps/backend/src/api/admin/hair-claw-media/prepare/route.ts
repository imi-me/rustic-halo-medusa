import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { imageBytes, photoOptions, preparePhoto, badPhoto } from '../../../../lib/hair-claw-photo'

export async function POST(req:MedusaRequest,res:MedusaResponse) {
  const body=req.body as {content?:unknown;options?:unknown}
  const parsed=photoOptions.safeParse(body?.options || {})
  if(!parsed.success)throw badPhoto('Invalid cleanup controls.')
  const result=await preparePhoto(imageBytes(body?.content),parsed.data)
  res.setHeader('Cache-Control','no-store')
  res.json(result)
}

import { createHash } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"
import sharp from "sharp"

export type ClawColorProfile = {
  red: number
  green: number
  blue: number
  /** A reviewed image profile revision, not a storefront swatch value. */
  version: string
}

export type RecolorInput = {
  master: Buffer
  plasticMask: Buffer
  protectedMask: Buffer
  profile: ClawColorProfile
}

export type RecolorResult = {
  png: Buffer
  width: number
  height: number
  changedPixels: number
  cacheKey: string
}

const MAX_DIMENSION = 6000
const MAX_INPUT_BYTES = 40 * 1024 * 1024

function invalid(message: string): never {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
}

function assertInput(name: string, input: Buffer): void {
  if (!Buffer.isBuffer(input) || input.length === 0 || input.length > MAX_INPUT_BYTES) {
    invalid(`${name} must be a nonempty image no larger than 40 MB`)
  }
}

function assertChannel(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    invalid("Color channels must be integers from 0 to 255")
  }
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

async function readMask(name: string, input: Buffer, width: number, height: number): Promise<Buffer> {
  assertInput(name, input)
  const metadata = await sharp(input, { failOn: "error" }).metadata()
  if (metadata.format !== "png" || metadata.width !== width || metadata.height !== height) {
    invalid(`${name} must be a same-size PNG mask`)
  }
  if (metadata.hasAlpha) {
    invalid(`${name} must be an opaque grayscale PNG; alpha masks are ambiguous`)
  }
  const { data, info } = await sharp(input, { failOn: "error" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.channels !== 1) {
    invalid(`${name} must resolve to one grayscale channel`)
  }
  for (const value of data) {
    if (value !== 0 && value !== 255) {
      invalid(`${name} must contain only black (0) and white (255) pixels`)
    }
  }
  return data
}

/**
 * Recolors only reviewed plastic-mask pixels in a lossless output. An opaque,
 * binary protected mask is mandatory and overlap is rejected before processing.
 * Profiles are intentionally supplied by the caller: UI swatches are not color
 * calibration, and no production profile is inferred from a screenshot.
 */
export async function recolorHairClaw(input: RecolorInput): Promise<RecolorResult> {
  assertInput("master", input.master)
  for (const channel of [input.profile.red, input.profile.green, input.profile.blue]) {
    assertChannel(channel)
  }
  if (!input.profile.version || input.profile.version.length > 80) {
    invalid("A bounded color profile version is required")
  }

  const metadata = await sharp(input.master, { failOn: "error" }).metadata()
  const { width, height } = metadata
  if (
    !width || !height ||
    width > MAX_DIMENSION || height > MAX_DIMENSION ||
    !["jpeg", "png", "webp", "tiff"].includes(metadata.format ?? "")
  ) {
    invalid("Master must be a supported image up to 6000 pixels per side")
  }

  const [plasticMask, protectedMask] = await Promise.all([
    readMask("plasticMask", input.plasticMask, width, height),
    readMask("protectedMask", input.protectedMask, width, height),
  ])
  let plasticPixels = 0
  let protectedPixels = 0
  for (let i = 0; i < plasticMask.length; i++) {
    if (plasticMask[i] && protectedMask[i]) {
      invalid("Plastic and protected masks overlap")
    }
    if (plasticMask[i]) plasticPixels++
    if (protectedMask[i]) protectedPixels++
  }
  if (!plasticPixels) invalid("Plastic mask is empty")
  if (!protectedPixels) invalid("Protected mask is empty")

  const { data: original, info } = await sharp(input.master, { failOn: "error" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.channels !== 3) invalid("Master must resolve to RGB")

  // The median source brightness is the neutral anchor. The bounded ratio
  // preserves the photographed body's shading without painting a flat color.
  const brightness = new Uint8Array(plasticPixels)
  for (let i = 0, j = 0; i < plasticMask.length; i++) {
    if (!plasticMask[i]) continue
    const pixel = i * 3
    brightness[j++] = clampByte(
      original[pixel] * 0.2126 + original[pixel + 1] * 0.7152 + original[pixel + 2] * 0.0722
    )
  }
  brightness.sort()
  const anchor = Math.max(1, brightness[Math.floor(brightness.length / 2)])
  const output = Buffer.from(original)
  let changedPixels = 0
  for (let i = 0; i < plasticMask.length; i++) {
    if (!plasticMask[i]) continue
    const pixel = i * 3
    const luminance = original[pixel] * 0.2126 + original[pixel + 1] * 0.7152 + original[pixel + 2] * 0.0722
    const shading = Math.max(0.45, Math.min(1.55, 1 + 0.7 * (luminance / anchor - 1)))
    output[pixel] = clampByte(input.profile.red * shading)
    output[pixel + 1] = clampByte(input.profile.green * shading)
    output[pixel + 2] = clampByte(input.profile.blue * shading)
    if (
      output[pixel] !== original[pixel] ||
      output[pixel + 1] !== original[pixel + 1] ||
      output[pixel + 2] !== original[pixel + 2]
    ) changedPixels++
  }

  // This compares raw pixels before PNG encoding; protected wood, engraving,
  // background, and all other unmasked pixels must remain exactly identical.
  for (let i = 0; i < plasticMask.length; i++) {
    if (plasticMask[i]) continue
    const pixel = i * 3
    if (
      output[pixel] !== original[pixel] ||
      output[pixel + 1] !== original[pixel + 1] ||
      output[pixel + 2] !== original[pixel + 2]
    ) invalid("Unmasked pixel changed")
  }

  const png = await sharp(output, { raw: { width, height, channels: 3 } }).png().toBuffer()
  const cacheKey = createHash("sha256")
    .update("hair-claw-recolor-v1\0")
    .update(input.master)
    .update(input.plasticMask)
    .update(input.protectedMask)
    .update(JSON.stringify(input.profile))
    .digest("hex")
  return { png, width, height, changedPixels, cacheKey }
}

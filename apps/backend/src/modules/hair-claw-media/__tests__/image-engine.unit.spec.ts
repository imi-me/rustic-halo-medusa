import sharp from "sharp"
import { recolorHairClaw } from "../image-engine"

const width = 4
const height = 4

async function rgbImage(): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3)
  for (let i = 0; i < width * height; i++) {
    const value = 25 + i * 2
    pixels.set([value, value, value], i * 3)
  }
  // A pale engraved/wood pixel must never change.
  pixels.set([202, 177, 140], (1 * width + 1) * 3)
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

async function mask(whitePixels: number[]): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height)
  whitePixels.forEach((index) => { pixels[index] = 255 })
  return sharp(pixels, { raw: { width, height, channels: 1 } }).png().toBuffer()
}

const profile = { red: 170, green: 120, blue: 115, version: "rose-proof-1" }

describe("hair-claw image engine", () => {
  it("changes only plastic pixels and retains a stable cache key", async () => {
    const master = await rgbImage()
    const plasticMask = await mask([0, 1, 2, 3])
    const protectedMask = await mask([5])
    const input = { master, plasticMask, protectedMask, profile }
    const first = await recolorHairClaw(input)
    const second = await recolorHairClaw(input)
    const before = await sharp(master).raw().toBuffer()
    const after = await sharp(first.png).raw().toBuffer()

    expect(first.changedPixels).toBe(4)
    expect(first.cacheKey).toBe(second.cacheKey)
    expect(first.png.equals(second.png)).toBe(true)
    for (let i = 0; i < width * height; i++) {
      const pixel = i * 3
      expect(after.subarray(pixel, pixel + 3).equals(before.subarray(pixel, pixel + 3)))
        .toBe(![0, 1, 2, 3].includes(i))
    }
  })

  it("rejects a mask that reaches protected wood", async () => {
    await expect(recolorHairClaw({
      master: await rgbImage(),
      plasticMask: await mask([0, 5]),
      protectedMask: await mask([5]),
      profile,
    })).rejects.toThrow("overlap")
  })

  it("rejects wrong-size and nonbinary masks", async () => {
    const master = await rgbImage()
    const protectedMask = await mask([5])
    const smallMask = await sharp(Buffer.from([255]), {
      raw: { width: 1, height: 1, channels: 1 },
    }).png().toBuffer()
    await expect(recolorHairClaw({
      master, plasticMask: smallMask, protectedMask, profile,
    })).rejects.toThrow("same-size")

    const grayPixels = Buffer.alloc(width * height)
    grayPixels[0] = 128
    const grayMask = await sharp(grayPixels, {
      raw: { width, height, channels: 1 },
    }).png().toBuffer()
    await expect(recolorHairClaw({
      master, plasticMask: grayMask, protectedMask, profile,
    })).rejects.toThrow("only black")
  })

  it("requires an explicit protected region", async () => {
    await expect(recolorHairClaw({
      master: await rgbImage(),
      plasticMask: await mask([0]),
      protectedMask: await mask([]),
      profile,
    })).rejects.toThrow("Protected mask is empty")
  })
})

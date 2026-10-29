import sharp from "sharp";
export async function validateEditorialUpload(data: unknown) {
  if (
    typeof data !== "string" ||
    data.length > 11_000_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data)
  )
    throw Error("Choose a JPG, PNG or WebP image under 8 MB.");
  const input = Buffer.from(data, "base64");
  if (!input.length || input.length > 8_000_000)
    throw Error("Choose an image under 8 MB.");
  try {
    const meta = await sharp(input, {
      limitInputPixels: 24_000_000,
    }).metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format || "") ||
      !meta.width ||
      !meta.height ||
      meta.width > 8000 ||
      meta.height > 8000 ||
      meta.width * meta.height > 24_000_000 ||
      (meta.pages || 1) !== 1
    )
      throw Error("format");
    return {
      input,
      width: meta.width,
      height: meta.height,
      extension: meta.format === "jpeg" ? "jpg" : meta.format!,
      mime: meta.format === "jpeg" ? "image/jpeg" : `image/${meta.format}`,
    };
  } catch {
    throw Error(
      "Use a still JPG, PNG or WebP image, up to 8000 px per side and 24 megapixels."
    );
  }
}

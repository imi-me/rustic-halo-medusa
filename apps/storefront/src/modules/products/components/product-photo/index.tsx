import Image, { ImageProps } from "next/image"

type ProductPhotoProps = Pick<
  ImageProps,
  "src" | "alt" | "sizes" | "priority" | "className" | "style" | "aria-hidden"
>

// Size the image itself to its natural proportions so its visible corners are
// rounded even when a portrait photo is contained within a square frame.
export default function ProductPhoto(props: ProductPhotoProps) {
  return (
    <span className="rh-photo-frame">
      <Image
        {...props}
        width={1600}
        height={1600}
        className={`rh-photo-image ${props.className || ""}`}
      />
    </span>
  )
}

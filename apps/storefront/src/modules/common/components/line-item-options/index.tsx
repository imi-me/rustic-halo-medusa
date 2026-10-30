import { HttpTypes } from "@medusajs/types"
import { Text } from "@modules/common/components/ui"

type LineItemOptionsProps = {
  variant: HttpTypes.StoreProductVariant | undefined
  metadata?: Record<string, unknown> | null
  "data-testid"?: string
  "data-value"?: HttpTypes.StoreProductVariant
}

const LineItemOptions = ({
  variant,
  metadata,
  "data-testid": dataTestid,
  "data-value": dataValue,
}: LineItemOptionsProps) => {
  const title = variant?.title?.trim()
  const color = typeof metadata?.hair_claw_color === 'string' ? metadata.hair_claw_color : undefined
  const label = [title && title.toLowerCase() !== 'default title' ? title : undefined, color ? `Color: ${color}` : undefined].filter(Boolean).join(' · ')
  if (!label) return null

  return (
    <Text
      data-testid={dataTestid}
      data-value={dataValue}
      className="inline-block txt-medium text-ui-fg-subtle w-full overflow-hidden text-ellipsis"
    >
      {label}
    </Text>
  )
}

export default LineItemOptions

import { HttpTypes } from "@medusajs/types"
type Props = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (id: string, value: string) => void
  title: string
  disabled: boolean
  "data-testid"?: string
}
export default function OptionSelect({
  option,
  current,
  updateOption,
  title,
  disabled,
  "data-testid": testId,
}: Props) {
  return (
    <label className="rh-b-product-option">
      <span>{title}</span>
      <select
        value={current || ""}
        onChange={(event) => updateOption(option.id, event.target.value)}
        disabled={disabled}
        data-testid={testId}
        aria-label={title}
      >
        <option value="" disabled>
          Choose {title.toLowerCase()}
        </option>
        {option.values?.map((v) => (
          <option key={v.value} value={v.value}>
            {v.value}
          </option>
        ))}
      </select>
    </label>
  )
}

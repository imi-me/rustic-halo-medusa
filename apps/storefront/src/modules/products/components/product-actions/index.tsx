"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  defaultTitleSelections,
  visibleProductOptions,
} from "@lib/util/product-options"
import ProductPrice from "../product-price"
import ProductDescription from "../product-description"
import MobileActions from "./mobile-actions"
import { useRouter } from "next/navigation"
import {
  getHealingHeartsColor,
  HEALING_HEARTS_HANDLE,
} from "@lib/brand/healing-hearts-colors"
import { HAPPY_COW_HANDLE, isHappyCowFourInchSize } from "@lib/brand/happy-cow-colors"
import { useHappyCowPreview } from "@modules/products/components/happy-cow-color-preview-context"
import { GalleryControlsTarget } from "@modules/products/components/gallery-controls"
import { isHairClaw } from "@lib/util/is-hair-claw"
import { hairClawTemplate, initialProductOptions } from "@lib/util/hair-claw-template"
import ClawColorPicker from "@modules/products/components/claw-color-picker"
import { productClawColors, clawSize } from '@lib/util/hair-claw-template'

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt) => {
    if (varopt.option_id) acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

export default function ProductActions({
  product,
  disabled,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setCanPreviewFourInch, setProductSelection } = useHappyCowPreview()

  const [options, setOptions] = useState<Record<string, string | undefined>>(() => initialProductOptions(product, searchParams.get("v_id")))
  const template = hairClawTemplate(product)
  const ownNavigations = useRef(new Set<string>())
  const lastRoute = useRef({ productId: product.id, variantId: searchParams.get("v_id") })
  const [isAdding, setIsAdding] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const countryCode = useParams().countryCode as string
  const displayOptions = useMemo(
    () => visibleProductOptions(product.options),
    [product.options]
  )
  const sizeOptionId = product.options?.find(
    (option) => option.title?.trim().toLowerCase() === "size"
  )?.id
  const hiddenDefaultSelections = useMemo(
    () => defaultTitleSelections(product.options),
    [product.options]
  )
  const previewColor = getHealingHeartsColor(searchParams.get("color"))
  const isHealingHeartsProof = !template && product.handle === HEALING_HEARTS_HANDLE
  const isPreviewOnlyColor = isHealingHeartsProof && previewColor.slug !== "black"

  useEffect(() => {
    setProductSelection({ productId: product.id, options })
    const selectedSize = sizeOptionId ? options[sizeOptionId] : undefined
    setCanPreviewFourInch(
      product.handle === HAPPY_COW_HANDLE && isHappyCowFourInchSize(selectedSize)
    )
  }, [product.id, product.handle, options, setCanPreviewFourInch, setProductSelection, sizeOptionId])

  // Preselect a sole variant and imported "Default Title" placeholders. The
  // placeholder remains part of variant matching but is not a customer choice.
  // Preserve an explicit card/gallery variant after Next refreshes the route.
  useEffect(() => {
    const variantId = searchParams.get("v_id")
    if (lastRoute.current.productId === product.id && lastRoute.current.variantId === variantId) return
    lastRoute.current = { productId: product.id, variantId }
    const routeKey = `${product.id}:${variantId || ""}`
    if (ownNavigations.current.delete(routeKey)) return
    const requestedVariant = product.variants?.find(
      (variant) => variant.id === searchParams.get("v_id")
    )

    if (requestedVariant) {
      setOptions(optionsAsKeymap(requestedVariant.options) ?? {})
      return
    }

    if (product.variants?.length === 1) {
      const variantOptions = optionsAsKeymap(product.variants[0].options)
      setOptions(variantOptions ?? {})
    } else {
      setOptions(template ? initialProductOptions(product, variantId) : hiddenDefaultSelections)
    }
  }, [product, hiddenDefaultSelections, searchParams, template])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    let next = { ...options, [optionId]: value }
    if (template && optionId === template.size_option_id && !product.variants?.some(v => isEqual(optionsAsKeymap(v.options), next))) {
      const compatible = product.variants?.find(v => v.options?.some(o => o.option_id === optionId && o.value === value) && v.options?.some(o => o.option_id === template.color_option_id && o.value === options[template.color_option_id]))
      const finishId = template.finish_option_id
      const fallback = compatible || product.variants?.find(v => v.options?.some(o => o.option_id === optionId && o.value === value) && (!finishId || v.options?.some(o => o.option_id === finishId && o.value === options[finishId]))) || product.variants?.find(v => v.options?.some(o => o.option_id === optionId && o.value === value))
      if (fallback) next = optionsAsKeymap(fallback.options) || next
    }
    setOptions(next)
    const match = product.variants?.find(v => isEqual(optionsAsKeymap(v.options), next))
    const params = new URLSearchParams(searchParams.toString())
    const variantId = match?.id || null
    if (params.get("v_id") === variantId) return
    ownNavigations.current.add(`${product.id}:${variantId || ""}`)
    if (variantId) params.set("v_id", variantId)
    else params.delete("v_id")
    router.replace(pathname + "?" + params.toString(), { scroll: false })
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // check if the selected variant is in stock
  const inStock = useMemo(() => {
    // If we don't manage inventory, we can always add to cart
    if (selectedVariant && !selectedVariant.manage_inventory) {
      return true
    }

    // If we allow back orders on the variant, we can add to cart
    if (selectedVariant?.allow_backorder) {
      return true
    }

    // If there is inventory available, we can add to cart
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    ) {
      return true
    }

    // Otherwise, we can't add to cart
    return false
  }, [selectedVariant])

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)

    await addToCart({
      variantId: selectedVariant.id,
      quantity,
      countryCode,
    })

    setIsAdding(false)
  }

  if (template?.offer_mode && !product.variants?.length) return <div><GalleryControlsTarget/><p className="rh-made-to-order" role="status">This design has no available size and finish options yet.</p></div>

  return (
    <>
      <div className="flex flex-col gap-y-2" ref={isHairClaw(product) ? undefined : actionsRef}>
        <ProductPrice product={product} variant={selectedVariant} />
        <GalleryControlsTarget />
        {isHairClaw(product) && (product.variants?.length ?? 0) === 1 && displayOptions.map(option => (
          <p className="rh-sole-option" key={option.id}>{option.title}: <strong>{options[option.id] || option.values?.[0]?.value}</strong></p>
        ))}
        {!isHairClaw(product) && <ProductDescription product={product} />}
        <div>
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-4">
              {displayOptions.map((option) => {
                if (template?.color_option_id === option.id) { const colors = productClawColors(product, clawSize(options[template.size_option_id])).filter(c => option.values?.some(v => v.value === c.name)); return <ClawColorPicker key={option.id} colors={colors} compact purchase productName={product.title || "hair claw"} value={colors.find(c => c.name === options[option.id])?.slug || ''} disabled={!!disabled || isAdding} onChange={slug => { const color = colors.find(c => c.slug === slug); if (color) setOptionValue(option.id, color.name) }} /> }
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={template?.offer_mode && option.id === template.finish_option_id ? {...option,values:option.values?.filter(value => product.variants?.some(v => v.options?.some(o => o.option_id === option.id && o.value === value.value) && v.options?.some(o => o.option_id === template.size_option_id && o.value === options[template.size_option_id])))} : option}
                      current={options[option.id]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                    />
                  </div>
                )
              })}
              <Divider />
            </div>
          )}
        </div>

        <div className="rh-purchase-row" ref={isHairClaw(product) ? actionsRef : undefined}>
        <div className="rh-quantity" aria-label="Quantity"><span>Quantity</span><div><button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={isAdding || quantity === 1}>−</button><output aria-live="polite">{quantity}</output><button type="button" aria-label="Increase quantity" onClick={() => setQuantity((current) => current + 1)} disabled={isAdding}>+</button></div></div>

        <Button
          onClick={handleAddToCart}
          disabled={
            !inStock ||
            !selectedVariant ||
            !!disabled ||
            isAdding ||
            isPreviewOnlyColor ||
            !isValidVariant
          }
          variant="primary"
          className="w-full min-h-12 rh-add-to-cart"
          isLoading={isAdding}
          data-testid="add-product-button"
        >
          {isPreviewOnlyColor
            ? "Color preview only"
            : !selectedVariant
            ? "Select variant"
            : !inStock || !isValidVariant
            ? "Out of stock"
            : "Add to cart"}
        </Button>
        </div>
        {isPreviewOnlyColor && (
          <p className="rh-color-preview-note" role="status">
            {previewColor.name} is a visual preview. Its purchasable catalog
            variant has not been attached yet.
          </p>
        )}
        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          optionsToDisplay={displayOptions}
          updateOptions={setOptionValue}
          inStock={inStock}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          show={!inView}
          optionsDisabled={!!disabled || isAdding}
        />
      </div>
    </>
  )
}

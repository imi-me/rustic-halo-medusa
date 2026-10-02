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
  const { setCanPreviewFourInch } = useHappyCowPreview()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
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
  const isHealingHeartsProof = product.handle === HEALING_HEARTS_HANDLE
  const isPreviewOnlyColor = isHealingHeartsProof && previewColor.slug !== "black"

  useEffect(() => {
    const selectedSize = sizeOptionId ? options[sizeOptionId] : undefined
    setCanPreviewFourInch(
      product.handle === HAPPY_COW_HANDLE && isHappyCowFourInchSize(selectedSize)
    )
  }, [product.handle, options, setCanPreviewFourInch, sizeOptionId])

  // Preselect a sole variant and imported "Default Title" placeholders. The
  // placeholder remains part of variant matching but is not a customer choice.
  // Preserve an explicit card/gallery variant after Next refreshes the route.
  useEffect(() => {
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
      setOptions(hiddenDefaultSelections)
    }
  }, [product.id, product.variants, hiddenDefaultSelections, searchParams])

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
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const value = isValidVariant ? selectedVariant?.id : null

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    router.replace(pathname + "?" + params.toString())
  }, [selectedVariant, isValidVariant, pathname, router, searchParams])

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

  return (
    <>
      <div className="flex flex-col gap-y-2" ref={actionsRef}>
        <ProductPrice product={product} variant={selectedVariant} />
        <ProductDescription product={product} />
        <div>
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-4">
              {displayOptions.map((option) => {
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
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

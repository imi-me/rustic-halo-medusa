import { deleteLineItem } from "@lib/data/cart"
import { Spinner, Trash } from "@medusajs/icons"
import { clx } from "@modules/common/components/ui"
import { useState } from "react"

const DeleteButton = ({
  id,
  children,
  className,
  ariaLabel = "Remove item",
}: {
  id: string
  children?: React.ReactNode
  className?: string
  ariaLabel?: string
}) => {
  const [isDeleting, setIsDeleting] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    setError(null)
    try {
      await deleteLineItem(id)
    } catch {
      setError("Could not remove this item. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      className={clx(
        "flex flex-col items-start text-small-regular",
        className
      )}
    >
      <button
        aria-label={ariaLabel}
        disabled={isDeleting}
        className="min-h-[44px] min-w-[44px] items-center justify-center flex gap-x-1 text-ui-fg-subtle hover:text-ui-fg-base cursor-pointer"
        onClick={() => handleDelete(id)}
      >
        {isDeleting ? <Spinner className="animate-spin" /> : <Trash />}
        <span>{children}</span>
      </button>
      {error && <p role="alert" className="max-w-48 text-sm text-rose-700">{error}</p>}
    </div>
  )
}

export default DeleteButton

import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
const ProductCreateEntry = () => {
  const navigate = useNavigate()
  useEffect(() => {
    const main = document.querySelector('main')
    const redirect = (event: Event) => {
      const anchor = (event.target as Element)?.closest?.('a')
      if (anchor && /^\/(?:app\/)?products\/create\/?$/.test(new URL(anchor.href).pathname)) {
        event.preventDefault(); event.stopPropagation(); navigate('/catalog/new')
      }
    }
    main?.addEventListener('click', redirect, true)
    return () => main?.removeEventListener('click', redirect, true)
  }, [navigate])
  return null
}
export const config = defineWidgetConfig({ zone: 'product.list.before', id: 'rustic-halo:product-create-entry' })
export default ProductCreateEntry

import { Heading } from "@modules/common/components/ui"
import React from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Help = () => {
  return (
    <div className="mt-6">
      <Heading className="text-base-semi">Need help?</Heading>
      <div className="text-base-regular my-2">
        <ul className="gap-y-2 flex flex-col">
          <li>
            <a href="mailto:hello@rustichalo.com">Contact Rustic Halo</a>
          </li>
          <li>
            <LocalizedClientLink href="/customer-service">
              Shipping and order help
            </LocalizedClientLink>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Help

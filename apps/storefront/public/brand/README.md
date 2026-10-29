# Rustic Halo web logo

- `deer-original.svg`: unchanged copy of the supplied `rustic-halo-logo.svg`.
- `deer-icon.svg`: same vector paths with excess canvas removed and a small clear-space margin.
- `rustic-halo-horizontal.svg`: horizontal header artwork using the supplied deer and outlined letters extracted from `RUSTICHALOLOGO512X512.ai`, found alongside the supplied SVG. The deer-shaped interruptions in C and H were repaired by reflecting the intact halves of those letters; spacing was adjusted for the separated mark. This is an adapted lockup for review.

The user identified the lettering as Gilroy. The horizontal asset contains vector outlines and does not require or distribute a font file. No generated deer artwork is used. Original files in iCloud and on the NAS were left untouched.

- `deer-circle-original.svg`: unchanged copy of the subsequently supplied `deerHead.svg`.
- `deer-circle-icon.svg`: joined deer-and-circle mark, converted from the supplied outline contours to a solid even-odd fill for legibility in the header.
- `rustic-halo-circle-horizontal.svg`: current header variation using the joined deer-and-circle mark and the existing outlined Gilroy wordmark. The uncircled horizontal version is preserved for comparison.

- The active circle icon and horizontal logo have a slightly heavier outer ring (1.35 SVG units). Original deer and letter paths are unchanged; supplied original files remain untouched.

- Latest circle revision uses the supplied `circle.svg` contours, transformed into a single solid even-odd fill. The open area remains transparent; the wordmark is unchanged. Source SVG is untouched.

## Approved selection

The owner selected `.local/logo-review/filled-logo.png`: the separate filled deer-circle mark at left and the complete Rustic Halo wordmark at right. The active `rustic-halo-circle-horizontal.svg` matches this PNG. The deer-as-O experiments remain private previews and are not used in the storefront. `rustic-halo-email-logo.png` is the matching transparent 1032 × 176 PNG export, suitable for display at 258 × 44 in emails. Public HTTPS hosting is still needed before referencing it in sent emails.

## October 9 storefront selection

`rustic-halo-web-logo.png` is an unchanged copy of the owner's supplied
`/Users/shawnhouse/Downloads/web_logo.png` (512 × 205). The storefront header,
footer, and checkout now use this integrated deer-and-wordmark layout. The
earlier vector variations and email logo remain preserved.

## October 9 reference-matching correction

`home-editorial-reference.png` is an unchanged copy of the first clean homepage
concept (`exec-0a41dd13-41b4-493c-b300-92f5c1732b0f.png` in this chat's generated
images). Later mockups supply the final header and divider layout; the first
image supplies clean lifestyle imagery. Homepage CSS displays only the relevant
photo regions. This is generated editorial concept artwork, not actual catalog
photography. Catalog/product images and product records remain unchanged.

## Approved B hero assets (October 29, 2026)

The B campaign uses `editorial/hero-desktop.jpg` and `editorial/hero-mobile.jpg`,
selected with a responsive picture element. Both currently retain the original
Rustic Halo woodland-earrings photograph unchanged. Tracy can replace the two
crops independently:

- Desktop: 2400 × 800 px. Keep the left 40% quiet for the text panel; products on the right.
- Phone: 1200 × 800 px. Center the products; the text panel sits below the image.
- No embedded text/logo; sRGB JPG/WebP, targeting about 400 KB desktop / 200 KB phone.

### Edit images and copy in Admin

Open **Admin → Storefront** (`/app/storefront`). The Hero tab edits desktop and
phone images, the headline, description, link and button. Explore collections
edits each card independently, including an optional phone crop and the section
heading. Use **Save draft** to keep work private, review the desktop/phone draft
preview, then **Publish to storefront**. Refresh the storefront to see published
changes; no code change or storefront rebuild is needed. The inline preview
shows the editable sections; check the actual storefront for final layout.

Switch **Show website text and button** off for a clickable image without the
website text panel. Each collection has its own switch. Text remains saved so
it can be restored. Switch the Explore section heading off independently.
When text is off, Tracy can include lettering in the artwork. Keep the saved
heading/link label meaningful, and describe important image lettering in the
image description (alt text). Search settings controls the homepage title and
description; there is no keyword-tag field.

Uploads accept still JPG, PNG and WebP, up to 8 MB, 8000 px per side and 24
megapixels. Original bytes are stored unchanged. Use **Show the whole image**
for uncropped product photos; **Fill the image area** may crop at different
screen sizes. Collection product photos can be 1200 × 1000 px or larger. For
an image-only collection row, start with a wide 2400 × 800 px desktop banner and
an optional 1200 × 800 px phone crop, keeping lettering away from the edges.

Published media uses the configured Medusa file provider. Uploads are publicly
addressable media even before a draft is published; drafts themselves are not
returned by the public content endpoint. Current draft and published content
are stored separately in the existing Admin Operations module. A stale editor
cannot overwrite a newer save; unsaved work stays visible for reconciliation.

Bundled fallback images/copy are in `src/lib/brand/homepage-defaults.json` and
matching backend `src/lib/storefront-content/defaults.json`. Featured Medusa
product handles remain in `src/lib/brand/storefront-design.ts`. Editorial
originals remain in `work/design-comps-20261029/assets/`.

Implemented and verified locally on October 29; staging deployment and its
storage/permission acceptance remain pending.

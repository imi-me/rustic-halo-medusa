// Prototype: one solid shared 13-color body and one photo per design.
// SVG clipping preserves the source photographs; no per-design recolors are made.
import { overlayOutline } from './overlay-outline.js?v=20260928-svg5'
import { polygon, bounds, fitPhoto } from './fit-outline.js?v=20260929-batch9'
export const colors = [
  ["Black", "#222222"], ["Espresso", "#3b302c"], ["Mocha", "#6a5143"],
  ["Chocolate", "#81563f"], ["Caramel", "#ae7d4e"], ["Khaki", "#bd956b"],
  ["Taupe", "#927f6f"], ["Sand", "#d4b995"], ["Ivory", "#eee8dd"],
  ["Gray", "#929292"], ["Terracotta", "#b35e46"], ["Rose", "#bd8582"],
  ["Purple", "#735079"],
].map(([name, hex]) => ({ name, hex, slug: name.toLowerCase() }))

// Keep the crop inside the wood photograph, excluding the original taupe rim.
const insert = "M109 524 C112 511 125 504 148 502 C340 490 469 489 627 490 C812 490 1007 495 1118 503 C1141 504 1150 511 1153 526 C1166 613 1170 724 1155 817 C1152 837 1147 845 1131 842 C950 818 805 801 627 801 C443 801 257 822 127 841 C107 843 103 836 100 817 C85 717 89 609 109 524 Z"
// Front corners follow the SVG contour; the handle is retained.
const outline = "M61.789,630.923 L62.046,610.780 L62.046,610.618 L62.667,590.191 L62.674,590.041 L63.661,569.279 L63.671,569.139 L65.008,548.003 L65.031,547.690 L65.613,541.787 L65.690,541.233 L66.574,535.793 L66.677,535.240 L67.818,530.246 L67.976,529.654 L69.357,525.085 L69.558,524.493 L71.140,520.338 L71.386,519.750 L73.142,515.980 L73.443,515.405 L75.341,512.009 L75.680,511.451 L77.698,508.401 L78.074,507.875 L80.175,505.161 L80.578,504.675 L82.734,502.273 L83.154,501.837 L85.336,499.726 L85.767,499.335 L87.949,497.492 L88.391,497.145 L90.535,495.565 L90.944,495.280 L93.023,493.928 L93.448,493.666 L95.439,492.532 L95.811,492.336 L97.676,491.392 L98.080,491.202 L101.605,489.649 L102.221,489.404 L106.280,487.986 L106.732,487.840 L111.234,486.550 L111.594,486.454 L116.455,485.293 L116.842,485.209 L127.289,483.231 L127.666,483.170 L138.506,481.623 L138.725,481.595 L144.076,480.975 L144.175,480.964 L149.357,480.428 L149.472,480.416 L154.409,479.975 L154.486,479.970 L159.085,479.601 L159.173,479.596 L163.345,479.305 L163.433,479.300 L167.099,479.082 L167.164,479.076 L170.230,478.919 L170.285,478.919 L189.439,478.059 L189.446,478.059 L222.462,476.607 L222.479,476.607 L238.726,475.920 L238.737,475.920 L270.696,474.624 L270.717,474.624 L301.995,473.429 L302.011,473.423 L332.611,472.323 L332.633,472.323 L362.579,471.318 L362.601,471.318 L391.897,470.407 L391.914,470.407 L420.577,469.586 L420.599,469.586 L448.647,468.849 L448.669,468.849 L476.111,468.207 L476.133,468.207 L502.979,467.642 L503.001,467.642 L529.271,467.156 L529.292,467.156 L554.993,466.754 L555.015,466.754 L580.171,466.430 L580.198,466.425 L604.808,466.179 L604.830,466.179 L628.922,466.000 L629.042,466.000 L653.129,466.173 L653.151,466.173 L677.766,466.413 L677.788,466.419 L702.938,466.726 L702.960,466.726 L728.667,467.105 L728.689,467.105 L754.958,467.564 L754.979,467.564 L781.827,468.106 L781.849,468.106 L809.290,468.731 L809.312,468.731 L837.354,469.441 L837.376,469.441 L866.045,470.251 L866.067,470.251 L895.364,471.150 L895.386,471.150 L925.326,472.155 L925.348,472.155 L955.953,473.262 L955.975,473.267 L987.253,474.485 L987.275,474.485 L1019.233,475.814 L1019.255,475.814 L1051.918,477.255 L1051.940,477.255 L1085.317,478.819 L1085.480,478.830 L1090.925,479.194 L1090.969,479.194 L1098.809,479.757 L1098.891,479.763 L1103.490,480.138 L1103.555,480.143 L1108.487,480.584 L1108.585,480.596 L1113.774,481.121 L1113.877,481.131 L1119.224,481.740 L1119.420,481.768 L1130.261,483.271 L1130.631,483.327 L1141.079,485.254 L1141.477,485.338 L1146.338,486.482 L1146.693,486.578 L1151.199,487.851 L1151.668,487.996 L1155.721,489.404 L1156.338,489.644 L1159.868,491.191 L1160.288,491.392 L1162.154,492.336 L1162.531,492.538 L1164.516,493.671 L1164.925,493.923 L1167.009,495.274 L1167.429,495.565 L1169.574,497.145 L1170.027,497.497 L1172.203,499.341 L1172.623,499.726 L1174.806,501.837 L1175.221,502.267 L1177.381,504.670 L1177.795,505.166 L1179.895,507.887 L1180.261,508.395 L1182.280,511.439 L1182.623,512.009 L1184.522,515.405 L1184.823,515.980 L1186.579,519.750 L1186.824,520.338 L1188.406,524.493 L1188.608,525.096 L1189.983,529.665 L1190.136,530.235 L1191.282,535.229 L1191.390,535.793 L1192.275,541.233 L1192.351,541.787 L1192.934,547.690 L1192.956,548.009 L1194.288,569.145 L1194.298,569.284 L1195.275,590.046 L1195.281,590.202 L1195.885,610.630 L1195.885,610.785 L1196.121,630.928 L1196.126,631.101 L1195.979,650.997 L1195.974,651.170 L1195.439,670.860 L1195.433,671.044 L1194.500,690.566 L1194.490,690.755 L1193.147,710.160 L1193.131,710.350 L1191.380,729.676 L1191.358,729.872 L1189.187,749.153 L1189.165,749.344 L1186.568,768.636 L1186.541,768.832 L1183.501,788.169 L1183.469,788.360 L1179.988,807.786 L1179.950,807.971 L1176.017,827.526 L1175.984,827.705 L1171.592,847.433 L1171.549,847.601 L1166.693,867.542 L1166.589,867.927 L1165.815,870.586 L1165.498,871.491 L1164.478,873.960 L1164.069,874.815 L1162.825,877.093 L1162.317,877.920 L1160.855,880.009 L1160.293,880.724 L1158.635,882.635 L1158.040,883.259 L1156.201,884.991 L1155.564,885.533 L1153.561,887.080 L1152.944,887.510 L1150.790,888.890 L1150.157,889.259 L1147.866,890.460 L1147.277,890.745 L1144.865,891.778 L1144.309,891.990 L1141.799,892.861 L1141.243,893.034 L1138.640,893.739 L1137.866,893.906 L1132.469,894.828 L1131.526,894.933 L1125.967,895.241 L1125.274,895.252 L1122.688,895.180 L1122.240,895.157 L1119.660,894.945 L1119.219,894.895 L1116.633,894.543 L1116.179,894.470 L1092.922,889.985 L1092.922,889.979 L1072.703,886.204 L1052.862,882.635 L1033.364,879.260 L1014.182,876.083 L1014.182,876.076 L995.267,873.094 L976.597,870.290 L958.146,867.670 L958.146,867.665 L939.931,865.229 L921.726,862.945 L903.770,860.839 L903.770,860.845 L885.745,858.895 L849.902,855.471 L814.004,852.651 L791.101,850.947 L791.101,850.953 L767.992,849.484 L744.904,848.271 L744.904,848.265 L721.755,847.300 L698.574,846.585 L675.459,846.104 L675.459,846.109 L652.169,845.880 L628.988,845.897 L628.977,845.897 L605.703,845.880 L582.501,846.109 L582.501,846.104 L559.298,846.585 L536.116,847.305 L513.061,848.265 L513.061,848.271 L489.875,849.489 L466.858,850.953 L466.858,850.947 L443.928,852.651 L407.916,855.482 L372.111,858.906 L354.194,860.845 L354.194,860.839 L336.239,862.945 L318.034,865.229 L299.818,867.665 L299.818,867.670 L281.296,870.301 L262.638,873.105 L243.783,876.076 L243.783,876.083 L224.536,879.272 L205.043,882.645 L185.207,886.214 L165.043,889.979 L165.043,889.985 L141.786,894.470 L141.332,894.543 L138.746,894.895 L138.305,894.945 L135.724,895.157 L135.277,895.180 L132.691,895.252 L131.998,895.241 L126.455,894.933 L125.495,894.828 L120.132,893.900 L119.368,893.733 L116.793,893.034 L116.220,892.856 L113.733,891.985 L113.176,891.767 L110.787,890.733 L110.186,890.443 L107.917,889.242 L107.289,888.873 L105.151,887.494 L104.551,887.069 L102.554,885.522 L101.921,884.980 L100.088,883.249 L99.515,882.656 L97.846,880.746 L97.294,880.048 L95.816,877.959 L95.325,877.177 L94.049,874.897 L93.644,874.082 L92.581,871.613 L92.270,870.776 L91.430,868.117 L91.277,867.570 L86.356,847.629 L86.312,847.450 L81.871,827.722 L81.833,827.537 L77.867,807.981 L77.829,807.792 L74.332,788.365 L74.300,788.169 L71.255,768.832 L71.227,768.636 L68.631,749.344 L68.609,749.148 L66.443,729.867 L66.421,729.671 L64.686,710.345 L64.670,710.149 L63.350,690.744 L63.338,690.554 L62.433,671.033 L62.428,670.854 L61.915,651.165 L61.909,650.985 L61.784,631.089 L61.789,630.923 Z M374 490 L374 474 C391 472 411 472 420 461 C426 453 423 441 419 430 L395 344 C387 319 398 306 421 306 L840 306 C862 306 869 319 861 343 L836 429 C831 447 831 457 841 464 C850 470 866 472 880 474 L880 490 Z"

export const designs = {
  "jesus": {
    name: "I Know A Name Jesus",
    source: "/images/hair-claws/overlays/jesus-source-v1.jpg",
    width: 1512, height: 2016,
    review: "New extraction — review lettering and outer border. Existing photo is slightly angled and soft.",
    clip: "M295 886 C563 871 945 876 1219 891 C1247 893 1253 909 1258 939 C1271 1036 1268 1147 1248 1231 C1244 1249 1234 1254 1214 1249 C888 1193 614 1189 293 1249 C267 1254 253 1247 250 1226 C234 1134 231 1024 246 936 C250 907 265 890 295 886 Z",
  },
  "boho-gecko": {
    name: "Boho Gecko",
    source: "/images/hair-claws/overlays/boho-gecko-source-v1.jpg",
    width: 2048, height: 2048, rotateSource: true,
    review: "New extraction — review engraving and edge crop. Switch Display vertically for the original reading direction.",
    clip: "M839 118 C975 105 1170 113 1287 145 C1322 152 1337 174 1326 211 C1240 664 1224 1234 1350 1829 C1359 1864 1351 1881 1315 1892 C1115 1940 864 1940 741 1904 C699 1892 695 1872 692 1837 C668 1302 681 688 744 205 C751 148 779 125 839 118 Z",
  },
  "healing-hearts": {
    name: "Healing Hearts",
    source: "/images/hair-claws/healing-hearts/recolor-v6/taupe.webp",
    width: 1254,
    height: 1254,
    clip: insert,
    // Uniform scale preserves the photographed artwork's proportions.
    transform: "translate(627 674) scale(1.008) translate(-627 -665)",
  },
  "happy-cow": {
    name: "Happy Cow",
    cropInset: 0.04,
    source: "/images/hair-claws/overlays/happy-cow-source-v1.jpg",
    width: 1512,
    height: 2016,
    clip: "M291 890 C590 876 1030 876 1219 890 C1254 892 1266 915 1268 956 C1278 1040 1276 1167 1261 1240 C1257 1258 1248 1266 1225 1261 C873 1210 619 1210 295 1260 C264 1266 252 1258 248 1237 C232 1140 235 1013 250 939 C255 910 271 894 291 890 Z",
    transform: "translate(627 675) scale(0.95) translate(-756 -1071)",
  },
}

const tint = (hex, amount) => {
  const channels = hex.slice(1).match(/../g).map((value) =>
    Math.max(0, Math.min(255, Math.round(parseInt(value, 16) * amount)))
  )
  return `rgb(${channels.join(",")})`
}

// Calibrate the front-view clip width to the owner's measured 103 mm.
// Frozen calibration: plastic refinements must not resize the fixed wood.
const bodyBounds = {"x":61.784,"y":306,"width":1134.342015625,"height":594}
const reference = polygon(overlayOutline), referenceBounds = bounds(reference)
export const dimensions = { clipWidthMm: 103, woodWidthMm: 101.524414, woodHeightMm: 37.523926 }
const targetWidth = bodyBounds.width * dimensions.woodWidthMm / dimensions.clipWidthMm
const targetScale = targetWidth / referenceBounds.width
const targetLeft = bodyBounds.x + (bodyBounds.width-targetWidth)/2
const target = reference.map(([x,y]) => [targetLeft+(x-referenceBounds.x)*targetScale, 474+(y-referenceBounds.y)*targetScale])
const fixedOutline = target.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ')+' Z'
const fittedPhotos = Object.fromEntries(Object.entries(designs).map(([key, design])=>[key,fitPhoto(design,target)]))

// The ids must be unique when several previews appear on the same page.
export function renderClaw({ designId, colorSlug, showOverlay = true, showOutline = true, vertical = false, scale = 1, id = "preview", uploaded = null }) {
  const design = uploaded ? { name: 'Uploaded wood overlay' } : designs[designId]
  const color = colors.find((item) => item.slug === colorSlug)
  if (!design || !color || !/^[a-z0-9-]+$/i.test(id)) throw new Error("Invalid preview recipe")
  if (!Number.isFinite(scale) || scale < (uploaded ? 0.8 : 0.9) || scale > 1.01) throw new Error("Invalid overlay scale")
  let artwork = fittedPhotos[designId]
  if (uploaded) {
    const url = new URL(uploaded.url)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid image URL')
    if (![uploaded.width, uploaded.height].every(n => Number.isInteger(n) && n > 0 && n <= 6000) ||
      ![uploaded.x, uploaded.y].every(n => Number.isFinite(n) && Math.abs(n) <= 50)) throw new Error('Invalid alignment')
    const box = bounds(target)
    const factor = Math.min(box.width / uploaded.width, box.height / uploaded.height)
    const w = uploaded.width * factor, h = uploaded.height * factor
    const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
    artwork = `<image href="${escape(url.href)}" x="${box.x + (box.width-w)/2 + uploaded.x}" y="${box.y + (box.height-h)/2 + uploaded.y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254" role="img" aria-labelledby="${id}-title">
    <title id="${id}-title">${design.name}, ${color.name}, shared 4-inch hair claw preview</title>
    <defs>
      <clipPath id="${id}-body"><path d="${outline}"/></clipPath>
      <linearGradient id="${id}-handle" x1="0" y1="306" x2="0" y2="478" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="white" stop-opacity="0.08"/>
        <stop offset="0.1" stop-color="white" stop-opacity="0.24"/>
        <stop offset="0.23" stop-color="black" stop-opacity="0.04"/>
        <stop offset="0.5" stop-color="black" stop-opacity="0.24"/>
        <stop offset="0.72" stop-color="black" stop-opacity="0.12"/>
        <stop offset="1" stop-color="white" stop-opacity="0.08"/>
      </linearGradient>
      <linearGradient id="${id}-rim" x1="0" y1="470" x2="0" y2="900" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="white" stop-opacity="0.15"/>
        <stop offset="0.4" stop-color="white" stop-opacity="0"/>
        <stop offset="1" stop-color="black" stop-opacity="0.18"/>
      </linearGradient>
      <filter id="${id}-soft-edge"><feGaussianBlur stdDeviation="5"/></filter>
      <filter id="${id}-handle-soft"><feGaussianBlur stdDeviation="8"/></filter>
      <filter id="${id}-shadow" x="-15%" y="-20%" width="130%" height="150%"><feDropShadow dx="0" dy="18" stdDeviation="15" flood-color="#000" flood-opacity="0.19"/></filter>
      <clipPath id="${id}-wood"><path d="${fixedOutline}"/></clipPath>
    </defs>
    <rect width="1254" height="1254" fill="white"/>
    <g${vertical ? ' transform="rotate(-90 627 627)"' : ""}>
      <path d="${outline}" fill="${color.hex}" filter="url(#${id}-shadow)"/>
      <g clip-path="url(#${id}-body)" pointer-events="none">
        <rect x="390" y="306" width="480" height="172" fill="url(#${id}-handle)"/>
        <g filter="url(#${id}-handle-soft)" fill="none" stroke-linecap="round">
          <path d="M403 327 C402 349 428 412 432 439 C437 461 424 469 410 474" stroke="white" stroke-opacity="0.22" stroke-width="18"/>
          <path d="M850 327 C851 349 826 412 823 439 C818 461 831 469 845 474" stroke="black" stroke-opacity="0.18" stroke-width="20"/>
        </g>
        <path d="${outline}" fill="url(#${id}-rim)"/>
        <path d="M85 867 C72 747 74 622 82 548 C85 511 94 496 121 491 M1166 537 C1178 659 1180 771 1171 861" fill="none" stroke="white" stroke-opacity="0.16" stroke-width="12" filter="url(#${id}-soft-edge)"/>
        <path d="M92 887 C277 857 443 830 627 830 C814 830 993 857 1168 886" fill="none" stroke="black" stroke-opacity="0.15" stroke-width="10" filter="url(#${id}-soft-edge)"/>
      </g>
      ${showOverlay ? `<g transform="translate(627 682) scale(${scale}) translate(-627 -682)"><g clip-path="url(#${id}-wood)">${artwork}</g></g>` : ""}
      ${showOutline ? `<path d="${fixedOutline}" fill="none" stroke="#155e75" stroke-width="3" stroke-dasharray="10 7" pointer-events="none"/>` : ""}
    </g>
  </svg>`
}

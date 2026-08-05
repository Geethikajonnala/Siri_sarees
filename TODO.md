# Task: Fix newly added products showing 404 on GitHub Pages

## Root cause
- `ssdProductUrl()` routed every UUID product to `products/<uuid>.html`.
- Those static pages are only created by manually running `scripts/generate-product-pages.mjs` and committing/pushing.
- New products added via admin (Supabase insert) have no static page → 404 on GitHub Pages.
- GitHub Pages serves only committed static files; it cannot generate pages on demand.

## Goal
Remove the dependency on generated static product pages. Route every product through `product.html?id=<id>` so new products open immediately after deployment.

## Changes made
- [x] Analyzed codebase and confirmed root cause.
- [x] `common.js`: rewrote `ssdProductUrl()` to ALWAYS return `product.html?id=<id>` for every product (UUID or not), removing the static `products/<uuid>.html` branch.
      - Also added `ssdStockStatus()` / `ssdStockBadge()` helpers (stock display).
- [x] `product.js`: reads product id from either a `meta[name="product-id"]` (legacy static pages) or the `?id=` query param (new routing). Renders stock badge + disables ordering for out-of-stock. Guarded `addToCart` against out-of-stock.
- [x] `script.js`: added stock badge to product cards, disabled Order Now for out-of-stock, guarded `addToCart` against out-of-stock.
- [x] `style.css`: added `.stock-badge` styles and disabled-button styles.
- [x] Verified no functional JS/HTML code still depends on `products/<uuid>.html` for routing (only legacy generated files + comments remain).

## Verification
- `ssdProductUrl(productId)` now returns e.g. `https://geethikajonnala.github.io/Siri_sarees/product.html?id=<uuid>`.
- `product.js` `initializeProductPage()` reads `?id=` and loads the product from Supabase seamlessly.
- SEO/canonical/OG/WhatsApp links all derive from `ssdProductUrl()` → stay consistent.
- No manual page generation needed after adding a product.

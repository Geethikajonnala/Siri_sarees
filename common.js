/*
 * Shared helpers for the Siri Saree Divine storefront (index.html + product.html).
 * Load order: config.js -> common.js -> script.js / product.js
 */

const SSD_FALLBACK_IMAGE = "https://images.pexels.com/photos/27575174/pexels-photo-27575174.jpeg?auto=compress&cs=tinysrgb&w=700";

const ssdStoreKeys = { wishlist: "siriSareesWishlist", cart: "siriSareesCart" };
const ssdProductCache = new Map();

function ssdResolveImageUrl(imageUrl) {
  const normalizedUrl = (imageUrl || "").toString().trim();
  const supabaseUrl = (window.SSD_CONFIG?.SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseBucket = window.SSD_CONFIG?.SUPABASE_BUCKET || "saree_images";

  if (!normalizedUrl) return SSD_FALLBACK_IMAGE;

  // Already a full URL (e.g. a Supabase Storage public URL) -- use as-is.
  if (/^https?:\/\//i.test(normalizedUrl)) return normalizedUrl;

  // Legacy/relative storage path stored before the image URL was saved in full.
  return `${supabaseUrl}/storage/v1/object/public/${supabaseBucket}/${normalizedUrl.replace(/^\/+/, "")}`;
}

function ssdProductImages(product) {
  const urls = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [product.image || product.image_url];
  const resolved = urls.map(ssdResolveImageUrl).filter(Boolean).slice(0, 4);
  return resolved.length > 0 ? resolved : [SSD_FALLBACK_IMAGE];
}

// Attached to window so inline onerror="ssdImageError(this)" attributes can reach it.
function ssdImageError(imgEl) {
  if (!imgEl || imgEl.dataset.fallbackApplied) return;
  imgEl.dataset.fallbackApplied = "true";
  imgEl.src = SSD_FALLBACK_IMAGE;
}
window.ssdImageError = ssdImageError;

function ssdFormatPrice(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

// Reads the admin-entered "offer" field (e.g. "10", "10%", "10% off") as a
// percentage discount and derives the cut-off original price + final price.
function ssdPriceBreakdown(product) {
  const original = Number(product.price) || 0;
  const offerText = (product.offer || "").toString().trim();
  const match = offerText.match(/(\d+(\.\d+)?)/);
  const discountPercent = match ? Math.min(90, Math.max(0, Number(match[1]))) : 0;
  const final = discountPercent > 0 ? Math.round(original * (1 - discountPercent / 100)) : original;
  return { original, final, discountPercent };
}

function ssdFinalPrice(product) {
  return ssdPriceBreakdown(product).final;
}

// ---- Stock status helpers (shared by the storefront cards, quick view, and
// the product details page). Uses only the stock value returned from Supabase
// (never hardcoded) and drives the badge text, color, and whether ordering is
// allowed. ----

// Stock at or below this number is treated as effectively unavailable.
const SSD_STOCK_OUT_THRESHOLD = 0;
// Stock at or below this number is shown as "Low Stock".
const SSD_STOCK_LOW_THRESHOLD = 5;

// Returns { level, label, disabled } for a product's stock value.
//   level  : "out" | "low" | "in"
//   label  : human-readable badge text ("Out of Stock", "Only 1 Left", "Low Stock", "In Stock")
//   disabled: true when the product cannot be ordered (stock === 0)
function ssdStockStatus(stock) {
  const value = Number(stock) || 0;
  if (value <= SSD_STOCK_OUT_THRESHOLD) {
    return { level: "out", label: "Out of Stock", disabled: true };
  }
  if (value === 1) {
    return { level: "low-one", label: "Only 1 Left", disabled: false };
  }
  if (value <= SSD_STOCK_LOW_THRESHOLD) {
    return { level: "low", label: "Low Stock", disabled: false };
  }
  return { level: "in", label: "In Stock", disabled: false };
}

// Returns the badge markup for a product card / details page. Pass
// `showInStock = false` to omit the green "In Stock" badge for healthy stock.
function ssdStockBadge(product, { showInStock = true } = {}) {
  const { level, label } = ssdStockStatus(product.stock);
  return `<span class="stock-badge stock-${level}">${label}</span>`;
}

function ssdPriceMarkup(product) {
  const { original, final, discountPercent } = ssdPriceBreakdown(product);
  if (discountPercent > 0 && final < original) {
    return `<span class="price-final">${ssdFormatPrice(final)}</span><span class="price-original">${ssdFormatPrice(original)}</span><span class="offer-badge inline">${discountPercent}% OFF</span>`;
  }
  return `<span class="price-final">${ssdFormatPrice(original)}</span>`;
}

function ssdPublicSiteBaseUrl() {
  const configuredUrl = (window.SSD_CONFIG?.PUBLIC_SITE_URL || "").trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  if (window.location.origin && window.location.origin !== "null") {
    // Include the current directory, not just the origin -- required on hosts
    // that serve the site from a subpath (e.g. GitHub Pages project sites like
    // user.github.io/repo-name/), otherwise generated links drop that prefix.
    const currentDir = window.location.pathname.replace(/[^/]*$/, "");
    return `${window.location.origin}${currentDir}`.replace(/\/$/, "");
  }
  return "";
}

// Every product, UUID or not, opens through the single always-deployed
// product.html page which loads the product client-side from Supabase via
// the ?id= query parameter (see product.js). We deliberately do NOT link to
// pre-generated static pages under products/<id>.html: those files are only
// created by manually running scripts/generate-product-pages.mjs and
// committing them, so any product added after that run would point to a file
// that doesn't exist on GitHub Pages and 404. GitHub Pages serves only the
// committed static files and cannot generate a page on demand.
//
// Routing everything through product.html?id=<id> means newly added products
// work immediately after deployment with no manual page generation. The same
// canonical/OG/WhatsApp links are all derived from this single helper, so
// sharing, SEO, wishlist, cart, and similar-product navigation stay in sync.
function ssdProductUrl(productId) {
  const base = `${ssdPublicSiteBaseUrl()}/`;
  if (!productId) return new URL("product.html", base).href;
  return new URL(`product.html?id=${encodeURIComponent(productId)}`, base).href;
}

function ssdWhatsAppNumber() {
  return window.SSD_CONFIG?.WHATSAPP_NUMBER || "918019655336";
}

function ssdOpenWhatsApp(message) {
  const number = ssdWhatsAppNumber();
  const encodedText = encodeURIComponent(message);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const url = isMobile
    ? `https://api.whatsapp.com/send?phone=${number}&text=${encodedText}`
    : `https://web.whatsapp.com/send?phone=${number}&text=${encodedText}`;
  window.open(url, "_blank", "noopener");
}

function ssdOrderMessage(product, { quantity } = {}) {
  const { original, final, discountPercent } = ssdPriceBreakdown(product);
  const priceLine = discountPercent > 0 && final < original
    ? `Price: ${ssdFormatPrice(final)} (${discountPercent}% OFF, was ${ssdFormatPrice(original)})`
    : `Price: ${ssdFormatPrice(original)}`;

  const lines = [
    "Hi Siri Sarees!",
    "",
    "I would like to order the following product:",
    "",
    `Product Name: ${product.name}`,
    priceLine,
    `Product URL: ${ssdProductUrl(product.id)}`,
  ];
  if (quantity && Number(quantity) > 1) lines.push(`Quantity: ${quantity}`);
  lines.push("", "Please confirm availability and share the payment details.", "", "Thank you!");
  return lines.join("\n");
}

function ssdReadStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function ssdWriteStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function ssdGetWishlist() {
  return ssdReadStore(ssdStoreKeys.wishlist, []);
}

function ssdSetWishlist(list) {
  ssdWriteStore(ssdStoreKeys.wishlist, list);
}

function ssdGetCart() {
  return ssdReadStore(ssdStoreKeys.cart, []);
}

function ssdSetCart(list) {
  ssdWriteStore(ssdStoreKeys.cart, list);
}

// Maps a raw Supabase "products" row (image_url as a comma-separated string)
// into the shape the storefront renders: images[] plus a first-image image_url.
function ssdMapProductRow(row) {
  if (!row) return null;
  const rawImageUrl = row.image_url || "";
  const images = rawImageUrl.split(",").map((url) => url.trim()).filter(Boolean).map(ssdResolveImageUrl);
  return {
    ...row,
    price: Number(row.price),
    stock: Number(row.stock),
    images,
    image_url: images[0] || ""
  };
}

async function ssdFetchProduct(productId) {
  const { data, error } = await window.supabaseClient
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();
  if (error) throw new Error(error.message);
  return ssdMapProductRow(data);
}

async function ssdFetchAllProducts() {
  const { data, error } = await window.supabaseClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(ssdMapProductRow);
}

// Ported from the old backend's /products/<id>/similar ranking: prefer same
// category, then shared fabric words, then shared color words, then closest price.
const SSD_FABRIC_TERMS = ["silk", "cotton", "linen", "organza", "chiffon", "georgette", "crepe", "net", "tissue", "velvet", "satin", "banarasi", "kanjivaram", "kanchipuram"];
const SSD_COLOR_TERMS = ["red", "maroon", "pink", "green", "blue", "yellow", "orange", "purple", "violet", "lavender", "black", "white", "ivory", "cream", "gold", "golden", "beige", "peach", "teal", "navy", "wine", "coral"];

function ssdProductSearchText(product) {
  return ["name", "category", "description", "offer"].map((field) => String(product[field] || "").toLowerCase()).join(" ");
}

function ssdMatchedTerms(product, terms) {
  const text = ssdProductSearchText(product);
  return new Set(terms.filter((term) => text.includes(term)));
}

function ssdTermSetsOverlap(setA, setB) {
  for (const term of setA) {
    if (setB.has(term)) return true;
  }
  return false;
}

function ssdSimilarityScore(target, candidate) {
  const priceDelta = Math.abs((Number(candidate.price) || 0) - (Number(target.price) || 0));
  return [
    String(candidate.category || "").toLowerCase() === String(target.category || "").toLowerCase() ? 1 : 0,
    ssdTermSetsOverlap(ssdMatchedTerms(target, SSD_FABRIC_TERMS), ssdMatchedTerms(candidate, SSD_FABRIC_TERMS)) ? 1 : 0,
    ssdTermSetsOverlap(ssdMatchedTerms(target, SSD_COLOR_TERMS), ssdMatchedTerms(candidate, SSD_COLOR_TERMS)) ? 1 : 0,
    -priceDelta
  ];
}

function ssdCompareScoresDesc(scoreA, scoreB) {
  for (let index = 0; index < scoreA.length; index += 1) {
    if (scoreA[index] !== scoreB[index]) return scoreB[index] - scoreA[index];
  }
  return 0;
}

async function ssdFetchSimilarProducts(productId) {
  const [target, allProducts] = await Promise.all([ssdFetchProduct(productId), ssdFetchAllProducts()]);
  return allProducts
    .filter((product) => String(product.id) !== String(productId))
    .sort((a, b) => ssdCompareScoresDesc(ssdSimilarityScore(target, a), ssdSimilarityScore(target, b)))
    .slice(0, 8);
}

// Resolves a batch of product ids to product objects, using ssdProductCache and
// any already-known products supplied via `known` (e.g. the currently viewed
// product, or an already-loaded catalog) before falling back to the API.
async function ssdEnsureProducts(ids, known = []) {
  known.forEach((product) => {
    if (product && product.id) ssdProductCache.set(String(product.id), product);
  });

  const missing = [...new Set(ids.map(String))].filter((id) => !ssdProductCache.has(id));
  await Promise.all(missing.map(async (id) => {
    try {
      const product = await ssdFetchProduct(id);
      ssdProductCache.set(id, product);
    } catch {
      ssdProductCache.set(id, null);
    }
  }));

  return ssdProductCache;
}

// ---- Fullscreen image gallery (shared by the storefront's Quick View modal and
// the product page). Opened by clicking a product's main image; supports
// swipe-to-change on touch devices and arrow/dot navigation on desktop. ----
let ssdLightboxEl = null;
let ssdLightboxImages = [];
let ssdLightboxIndex = 0;
let ssdLightboxName = "";
let ssdLightboxOnChange = null;

function ssdBuildLightbox() {
  if (ssdLightboxEl) return ssdLightboxEl;

  const el = document.createElement("div");
  el.className = "ssd-lightbox";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <button class="ssd-lightbox-close" type="button" aria-label="Close image viewer"><i class="fa-solid fa-xmark"></i></button>
    <button class="ssd-lightbox-arrow ssd-lightbox-prev" type="button" aria-label="Previous image"><i class="fa-solid fa-chevron-left"></i></button>
    <div class="ssd-lightbox-stage">
      <img class="ssd-lightbox-image" alt="">
    </div>
    <button class="ssd-lightbox-arrow ssd-lightbox-next" type="button" aria-label="Next image"><i class="fa-solid fa-chevron-right"></i></button>
    <div class="ssd-lightbox-dots"></div>
  `;
  document.body.appendChild(el);
  ssdLightboxEl = el;

  el.querySelector(".ssd-lightbox-close").addEventListener("click", ssdCloseLightbox);
  el.querySelector(".ssd-lightbox-next").addEventListener("click", ssdLightboxNext);
  el.querySelector(".ssd-lightbox-prev").addEventListener("click", ssdLightboxPrev);
  el.addEventListener("click", (event) => {
    if (event.target === el) ssdCloseLightbox();
  });

  ssdOnSwipe(el.querySelector(".ssd-lightbox-stage"), {
    onSwipeLeft: ssdLightboxNext,
    onSwipeRight: ssdLightboxPrev
  });

  return el;
}

function ssdShowLightboxSlide(index, { silent = false } = {}) {
  if (!ssdLightboxEl || ssdLightboxImages.length === 0) return;
  ssdLightboxIndex = ((index % ssdLightboxImages.length) + ssdLightboxImages.length) % ssdLightboxImages.length;

  const img = ssdLightboxEl.querySelector(".ssd-lightbox-image");
  img.src = ssdLightboxImages[ssdLightboxIndex];
  img.alt = `${ssdLightboxName} image ${ssdLightboxIndex + 1}`;

  ssdLightboxEl.querySelectorAll(".ssd-lightbox-dot").forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === ssdLightboxIndex);
  });

  if (!silent && ssdLightboxOnChange) ssdLightboxOnChange(ssdLightboxIndex);
}

function ssdLightboxNext() {
  if (ssdLightboxImages.length > 1) ssdShowLightboxSlide(ssdLightboxIndex + 1);
}

function ssdLightboxPrev() {
  if (ssdLightboxImages.length > 1) ssdShowLightboxSlide(ssdLightboxIndex - 1);
}

function ssdOpenLightbox(images, name, startIndex = 0, onIndexChange) {
  const el = ssdBuildLightbox();
  ssdLightboxImages = images.length > 0 ? images : [SSD_FALLBACK_IMAGE];
  ssdLightboxName = name || "Product image";
  ssdLightboxOnChange = typeof onIndexChange === "function" ? onIndexChange : null;

  const hasMultiple = ssdLightboxImages.length > 1;
  el.querySelector(".ssd-lightbox-prev").hidden = !hasMultiple;
  el.querySelector(".ssd-lightbox-next").hidden = !hasMultiple;
  const dots = el.querySelector(".ssd-lightbox-dots");
  dots.hidden = !hasMultiple;
  dots.innerHTML = hasMultiple
    ? ssdLightboxImages.map((_, index) => `<button class="ssd-lightbox-dot" type="button" aria-label="Go to image ${index + 1}"></button>`).join("")
    : "";
  dots.querySelectorAll(".ssd-lightbox-dot").forEach((dot, index) => {
    dot.addEventListener("click", () => ssdShowLightboxSlide(index));
  });

  ssdShowLightboxSlide(startIndex, { silent: true });

  el.classList.add("open");
  el.setAttribute("aria-hidden", "false");
  document.body.classList.add("panel-open");
}

function ssdCloseLightbox() {
  if (!ssdLightboxEl) return;
  ssdLightboxEl.classList.remove("open");
  ssdLightboxEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("panel-open");
}

// Registered before script.js/product.js's own Escape handlers (see load order
// note above), so stopImmediatePropagation here keeps Escape scoped to closing
// just the lightbox instead of also cascading into closePanels()/closeQuickView().
document.addEventListener("keydown", (event) => {
  if (!ssdLightboxEl || !ssdLightboxEl.classList.contains("open")) return;
  if (event.key === "Escape") {
    event.stopImmediatePropagation();
    ssdCloseLightbox();
  }
  if (event.key === "ArrowRight") ssdLightboxNext();
  if (event.key === "ArrowLeft") ssdLightboxPrev();
});

// Generic touch-swipe helper: fires onSwipeLeft/onSwipeRight when a horizontal
// drag on `el` exceeds a small threshold, so galleries can be paged by finger
// on mobile the same way arrow buttons page them on desktop.
function ssdOnSwipe(el, { onSwipeLeft, onSwipeRight } = {}) {
  if (!el) return;
  let startX = 0;
  let deltaX = 0;
  let tracking = false;

  el.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    startX = event.touches[0].clientX;
    deltaX = 0;
    tracking = true;
  }, { passive: true });

  el.addEventListener("touchmove", (event) => {
    if (!tracking) return;
    deltaX = event.touches[0].clientX - startX;
  }, { passive: true });

  el.addEventListener("touchend", (event) => {
    if (!tracking) return;
    tracking = false;
    if (Math.abs(deltaX) < 40) return;
    // Prevent the browser's post-touch compatibility click (which would otherwise
    // fire on this element right after the swipe, e.g. reopening the lightbox).
    event.preventDefault();
    if (deltaX < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  }, { passive: false });
}

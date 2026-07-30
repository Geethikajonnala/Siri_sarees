/*
 * Shared helpers for the Siri Saree Divine storefront (index.html + product.html).
 * Load order: config.js -> common.js -> script.js / product.js
 */

const SSD_FALLBACK_IMAGE = "https://images.pexels.com/photos/27575174/pexels-photo-27575174.jpeg?auto=compress&cs=tinysrgb&w=700";
const SSD_API_ORIGIN = "http://127.0.0.1:5000";

const API_BASE = (window.SSD_CONFIG?.API_BASE || `${SSD_API_ORIGIN}/api`).replace(/\/$/, "");

const ssdStoreKeys = { wishlist: "siriSareesWishlist", cart: "siriSareesCart" };
const ssdProductCache = new Map();

function ssdResolveImageUrl(imageUrl) {
  const normalizedUrl = (imageUrl || "").toString().trim();
  const supabaseUrl = (window.SSD_CONFIG?.SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseBucket = window.SSD_CONFIG?.SUPABASE_BUCKET || "saree_images";

  if (!normalizedUrl) return SSD_FALLBACK_IMAGE;

  if (/^https?:\/\//i.test(normalizedUrl)) {
    try {
      const url = new URL(normalizedUrl);
      if (url.origin === SSD_API_ORIGIN && url.pathname.startsWith("/uploads/")) {
        return `${SSD_API_ORIGIN}/api${url.pathname}`;
      }
    } catch {
      /* fall through and use the URL as-is */
    }
    return normalizedUrl;
  }

  if (normalizedUrl.startsWith("/uploads/")) return `${SSD_API_ORIGIN}/api${normalizedUrl}`;
  if (normalizedUrl.startsWith("uploads/")) return `${SSD_API_ORIGIN}/api/${normalizedUrl}`;
  if (supabaseUrl && !normalizedUrl.startsWith("/") && !normalizedUrl.startsWith("storage/")) {
    return `${supabaseUrl}/storage/v1/object/public/${supabaseBucket}/${normalizedUrl}`;
  }
  if (normalizedUrl.startsWith("/")) return `${SSD_API_ORIGIN}${normalizedUrl}`;
  return `${SSD_API_ORIGIN}/${normalizedUrl}`;
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
    return window.location.origin.replace(/\/$/, "");
  }
  return SSD_API_ORIGIN;
}

function ssdProductUrl(productId) {
  const url = new URL("product.html", `${ssdPublicSiteBaseUrl()}/`);
  if (productId) url.searchParams.set("id", productId);
  return url.href;
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

async function ssdApiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}

async function ssdFetchProduct(productId) {
  const result = await ssdApiGet(`/products/${encodeURIComponent(productId)}`);
  return result.product;
}

async function ssdFetchSimilarProducts(productId) {
  const result = await ssdApiGet(`/products/${encodeURIComponent(productId)}/similar`);
  return result.products || [];
}

async function ssdFetchAllProducts() {
  const result = await ssdApiGet("/products");
  return result.products || [];
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

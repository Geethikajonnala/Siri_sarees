const selectors = {
  header: document.querySelector("#siteHeader"),
  backTop: document.querySelector(".back-top"),
  breadcrumb: document.querySelector("#productBreadcrumb"),
  productPage: document.querySelector("#productPage"),
  cartCount: document.querySelector(".cart-count"),
  wishlistCount: document.querySelector(".wishlist-count"),
  panelOverlay: document.querySelector("#panelOverlay"),
  panels: document.querySelectorAll(".side-panel"),
  wishlistItems: document.querySelector("#wishlistItems"),
  wishlistEmpty: document.querySelector("#wishlistEmpty"),
  cartItems: document.querySelector("#cartItems"),
  cartEmpty: document.querySelector("#cartEmpty"),
  cartTotal: document.querySelector("#cartTotal"),
  floatWhatsApp: document.querySelector("#floatWhatsApp"),
  footerWhatsApp: document.querySelector("#footerWhatsApp")
};

if (selectors.footerWhatsApp) {
  selectors.footerWhatsApp.href = `https://wa.me/${ssdWhatsAppNumber()}`;
}

let wishlist = ssdGetWishlist();
let cart = ssdGetCart();
let currentProduct = null;
let similarProducts = [];

function productById(id) {
  return ssdProductCache.get(String(id)) || null;
}

function updateHeaderState() {
  selectors.header.classList.toggle("scrolled", window.scrollY > 18);
  selectors.backTop.classList.toggle("visible", window.scrollY > 520);
}

function updateBadge(badge, value) {
  badge.textContent = value;
  badge.classList.toggle("visible", value > 0);
}

function openPanel(panelId) {
  selectors.panels.forEach((panel) => {
    const isActive = panel.id === panelId;
    panel.classList.toggle("open", isActive);
    panel.setAttribute("aria-hidden", String(!isActive));
  });
  selectors.panelOverlay.classList.add("visible");
  selectors.panelOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("panel-open");
}

function closePanels() {
  selectors.panels.forEach((panel) => {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  });
  selectors.panelOverlay.classList.remove("visible");
  selectors.panelOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("panel-open");
}

async function renderWishlist() {
  await ssdEnsureProducts(wishlist, [currentProduct, ...similarProducts].filter(Boolean));
  const wishlistProducts = wishlist.map(productById).filter(Boolean);

  selectors.wishlistItems.innerHTML = wishlistProducts.map((product) => {
    const imageUrl = ssdProductImages(product)[0];
    const name = product.name || "Siri Saree";
    return `
    <div class="panel-item">
      <img src="${imageUrl}" alt="${name}" onerror="ssdImageError(this)">
      <div>
        <h3>${name}</h3>
        <p>${product.category || "Siri Saree Divine"}</p>
        <strong>${ssdFormatPrice(ssdFinalPrice(product))}</strong>
      </div>
      <button class="remove-btn" type="button" data-remove-wishlist="${product.id}" aria-label="Remove ${name} from wishlist">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
  }).join("");

  selectors.wishlistEmpty.classList.toggle("visible", wishlist.length === 0);
  updateBadge(selectors.wishlistCount, wishlist.length);
  ssdSetWishlist(wishlist);
}

async function renderCart() {
  await ssdEnsureProducts(cart.map((item) => item.id), [currentProduct, ...similarProducts].filter(Boolean));
  const cartEntries = cart.map((item) => ({ ...item, product: productById(item.id) })).filter((item) => item.product);

  selectors.cartItems.innerHTML = cartEntries.map(({ product, quantity }) => {
    const imageUrl = ssdProductImages(product)[0];
    const name = product.name || "Siri Saree";
    return `
    <div class="panel-item cart-item">
      <img src="${imageUrl}" alt="${name}" onerror="ssdImageError(this)">
      <div>
        <h3>${name}</h3>
        <p>Quantity: ${quantity}</p>
        <strong>${ssdFormatPrice(ssdFinalPrice(product) * quantity)}</strong>
      </div>
      <button class="remove-btn" type="button" data-remove-cart="${product.id}" aria-label="Remove ${name} from cart">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
  }).join("");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cartEntries.reduce((sum, { product, quantity }) => sum + ssdFinalPrice(product) * quantity, 0);
  selectors.cartEmpty.classList.toggle("visible", cart.length === 0);
  selectors.cartTotal.textContent = ssdFormatPrice(totalAmount);
  updateBadge(selectors.cartCount, totalItems);
  ssdSetCart(cart);
}

function toggleWishlist(id) {
  wishlist = wishlist.includes(id) ? wishlist.filter((itemId) => itemId !== id) : [...wishlist, id];
  renderWishlist();
  syncWishlistButtons();
}

function addToCart(id, quantity = 1) {
  const existingItem = cart.find((item) => item.id === id);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ id, quantity });
  }
  renderCart();
}

function syncWishlistButtons() {
  document.querySelectorAll("[data-toggle-wishlist]").forEach((button) => {
    const id = button.dataset.toggleWishlist;
    const active = wishlist.includes(id);
    button.classList.toggle("active", active);
    button.innerHTML = active
      ? '<i class="fa-solid fa-heart"></i> Saved to Wishlist'
      : '<i class="fa-regular fa-heart"></i> Add to Wishlist';
  });
}

function checkout() {
  if (cart.length === 0) return;
  const cartEntries = cart.map((item) => ({ ...item, product: productById(item.id) })).filter((item) => item.product);
  const total = cartEntries.reduce((sum, { product, quantity }) => sum + ssdFinalPrice(product) * quantity, 0);

  let message = `Hi Siri Sarees!\n\nI would like to order the following products from my cart:\n\n`;
  cartEntries.forEach(({ product, quantity }) => {
    message += `🛍 Product: ${product.name}\n💰 Price: ${ssdFormatPrice(ssdFinalPrice(product))} (Qty: ${quantity})\n🔗 ${ssdProductUrl(product.id)}\n\n`;
  });
  message += `💰 Total Amount: ${ssdFormatPrice(total)}\n\nPlease confirm availability and share the payment details.\n\nThank you!`;

  cart = [];
  renderCart();
  ssdOpenWhatsApp(message);
}

function setMeta(selector, value) {
  const meta = document.querySelector(selector);
  if (meta) meta.setAttribute("content", value);
}

function updateProductMeta(product, imageUrl) {
  const name = product.name || "Siri Saree Divine Product";
  const title = `${name} | Siri Saree Divine`;
  const description = product.description || `${name} for ${ssdFormatPrice(product.price)}.`;
  const url = ssdProductUrl(product.id);
  document.title = title;
  setMeta('meta[name="description"]', description);
  setMeta('meta[property="og:title"]', title);
  setMeta('meta[property="og:description"]', description);
  setMeta('meta[property="og:image"]', imageUrl);
  setMeta('meta[property="og:url"]', url);
  setMeta('meta[name="twitter:title"]', title);
  setMeta('meta[name="twitter:description"]', description);
  setMeta('meta[name="twitter:image"]', imageUrl);
  document.querySelector("#canonicalLink")?.setAttribute("href", url);

  const jsonLd = document.querySelector("#productJsonLd");
  if (jsonLd) {
    jsonLd.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      description,
      image: imageUrl,
      url,
      brand: { "@type": "Brand", name: "Siri Saree Divine" },
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: "INR",
        price: ssdFinalPrice(product),
        availability: "https://schema.org/InStock"
      }
    });
  }
}

function renderBreadcrumb(product) {
  const category = product.category || "Sarees";
  selectors.breadcrumb.innerHTML = `
    <a href="index.html#home">Home</a>
    <span class="crumb-sep" aria-hidden="true">/</span>
    <a href="index.html#trending">${category}</a>
    <span class="crumb-sep" aria-hidden="true">/</span>
    <span aria-current="page">${product.name || "Saree"}</span>
  `;
}

function similarProductCard(product) {
  const imageUrl = ssdProductImages(product)[0];
  const name = product.name || "Siri Saree";
  const { discountPercent } = ssdPriceBreakdown(product);
  const offerBadge = discountPercent > 0 ? `<span class="offer-badge">${discountPercent}% OFF</span>` : "";
  return `
    <article class="product-card reveal visible" data-similar-product="${product.id}" tabindex="0" aria-label="View ${name}">
      ${offerBadge}
      <img src="${imageUrl}" alt="${name}" loading="lazy" onerror="ssdImageError(this)">
      <div class="product-info">
        <p class="product-category">${product.category || "Siri Saree Divine"}</p>
        <h3>${name}</h3>
        <p class="price">${ssdPriceMarkup(product)}</p>
      </div>
    </article>
  `;
}

function renderSimilarProducts(products) {
  const section = document.querySelector("#similarProductsSection");
  const grid = document.querySelector("#similarProductsGrid");
  if (!section || !grid || products.length === 0) return;

  grid.innerHTML = products.map(similarProductCard).join("");
  section.hidden = false;
}

function preloadImages(images) {
  images.forEach((url) => {
    const preloadEl = new Image();
    preloadEl.src = url;
  });
}

function galleryMarkup(images, name) {
  const hint = images.length > 1
    ? `<span class="gallery-view-hint"><i class="fa-solid fa-images"></i> View all ${images.length} photos</span>`
    : "";
  const arrows = images.length > 1
    ? `
      <button class="product-gallery-arrow prev" type="button" aria-label="Previous image"><i class="fa-solid fa-chevron-left"></i></button>
      <button class="product-gallery-arrow next" type="button" aria-label="Next image"><i class="fa-solid fa-chevron-right"></i></button>
    `
    : "";
  const mainImageBlock = `
    <div class="product-gallery-media">
      <img class="product-gallery-main" id="productMainImage" src="${images[0]}" alt="${name}" onerror="ssdImageError(this)">
      ${hint}
      ${arrows}
    </div>
  `;

  if (images.length <= 1) {
    return mainImageBlock;
  }

  const thumbs = images.map((url, index) => `
    <button class="product-gallery-thumb ${index === 0 ? "active" : ""}" type="button" data-gallery-index="${index}" aria-label="View image ${index + 1}" aria-pressed="${index === 0 ? "true" : "false"}">
      <img src="${url}" alt="${name} thumbnail ${index + 1}" onerror="ssdImageError(this)">
    </button>
  `).join("");

  return `
    ${mainImageBlock}
    <div class="product-gallery-thumbs">${thumbs}</div>
  `;
}

function renderProduct(product) {
  currentProduct = product;
  ssdProductCache.set(String(product.id), product);

  const images = ssdProductImages(product);
  const name = product.name || "Siri Saree";
  const description = product.description?.trim() || "A handpicked premium saree from Siri Saree Divine's curated collection.";
  const isWished = wishlist.includes(product.id);

  preloadImages(images);
  updateProductMeta(product, images[0]);
  renderBreadcrumb(product);

  selectors.productPage.innerHTML = `
    <div class="product-page-layout">
      <div class="product-gallery">
        ${galleryMarkup(images, name)}
      </div>
      <div class="product-page-copy">
        <p class="eyebrow">${product.category || "Siri Saree Divine"}</p>
        <h1>${name}</h1>
        <p class="price">${ssdPriceMarkup(product)}</p>
        <p class="quick-copy" id="productDescription">${description}</p>
        <button type="button" class="description-toggle" id="descriptionToggle" hidden>Read more</button>

        <div class="product-quantity-row">
          <label for="productQuantity">Quantity</label>
          <div class="quantity-stepper">
            <button type="button" id="qtyDecrease" aria-label="Decrease quantity">&minus;</button>
            <input type="text" id="productQuantity" value="1" inputmode="numeric" aria-label="Quantity" readonly>
            <button type="button" id="qtyIncrease" aria-label="Increase quantity">&plus;</button>
          </div>
        </div>

        <div class="product-actions">
          <button class="quick-view" type="button" data-toggle-wishlist="${product.id}">
            <i class="fa-${isWished ? "solid" : "regular"} fa-heart"></i> ${isWished ? "Saved to Wishlist" : "Add to Wishlist"}
          </button>
          <button class="add-cart" type="button" id="addToCartBtn">Add to Cart</button>
          <button class="order-now-btn" type="button" id="buyProduct">
            <i class="fa-brands fa-whatsapp"></i> Buy on WhatsApp
          </button>
        </div>

        <p class="whatsapp-note"><i class="fa-brands fa-whatsapp"></i> Order directly on WhatsApp &mdash; no account needed</p>
      </div>
    </div>
    <div class="similar-products-section" id="similarProductsSection" hidden>
      <div class="section-heading">
        <h2>Similar Sarees</h2>
      </div>
      <div class="product-grid" id="similarProductsGrid"></div>
    </div>
  `;

  wireProductInteractions(product);
  syncWishlistButtons();

  if (selectors.floatWhatsApp) {
    const message = `Hi Siri Sarees! I have a question about ${name}.`;
    selectors.floatWhatsApp.href = `https://wa.me/${ssdWhatsAppNumber()}?text=${encodeURIComponent(message)}`;
    selectors.floatWhatsApp.hidden = false;
  }
}

function currentQuantity() {
  const input = document.querySelector("#productQuantity");
  return Math.max(1, Number(input?.value) || 1);
}

function wireProductInteractions(product) {
  const descriptionEl = document.querySelector("#productDescription");
  const descriptionToggle = document.querySelector("#descriptionToggle");
  if (descriptionEl && descriptionToggle && descriptionEl.scrollHeight > descriptionEl.clientHeight + 1) {
    descriptionToggle.hidden = false;
    descriptionToggle.addEventListener("click", () => {
      const expanded = descriptionEl.classList.toggle("expanded");
      descriptionToggle.textContent = expanded ? "Show less" : "Read more";
    });
  }

  const qtyInput = document.querySelector("#productQuantity");
  document.querySelector("#qtyDecrease")?.addEventListener("click", () => {
    qtyInput.value = Math.max(1, currentQuantity() - 1);
  });
  document.querySelector("#qtyIncrease")?.addEventListener("click", () => {
    qtyInput.value = Math.min(20, currentQuantity() + 1);
  });

  document.querySelector(`[data-toggle-wishlist="${product.id}"]`)?.addEventListener("click", () => {
    toggleWishlist(product.id);
  });

  document.querySelector("#addToCartBtn")?.addEventListener("click", (event) => {
    addToCart(product.id, currentQuantity());
    const button = event.currentTarget;
    button.textContent = "Added to Cart";
    button.classList.add("added");
    setTimeout(() => {
      button.textContent = "Add to Cart";
      button.classList.remove("added");
    }, 1200);
  });

  document.querySelector("#buyProduct")?.addEventListener("click", () => {
    ssdOpenWhatsApp(ssdOrderMessage(product, { quantity: currentQuantity() }));
  });

  const gallery = document.querySelector(".product-gallery");
  const galleryImages = ssdProductImages(product);
  let activeGalleryIndex = 0;

  function setActiveGalleryIndex(index) {
    activeGalleryIndex = ((index % galleryImages.length) + galleryImages.length) % galleryImages.length;
    const mainImage = document.querySelector("#productMainImage");
    if (mainImage) mainImage.src = galleryImages[activeGalleryIndex];
    gallery?.querySelectorAll(".product-gallery-thumb").forEach((thumb, thumbIndex) => {
      const isActive = thumbIndex === activeGalleryIndex;
      thumb.classList.toggle("active", isActive);
      thumb.setAttribute("aria-pressed", String(isActive));
    });
  }

  gallery?.addEventListener("click", (event) => {
    const thumbButton = event.target.closest("[data-gallery-index]");
    if (thumbButton) {
      setActiveGalleryIndex(Number(thumbButton.dataset.galleryIndex));
      return;
    }
    if (event.target.closest(".product-gallery-arrow.prev")) {
      setActiveGalleryIndex(activeGalleryIndex - 1);
      return;
    }
    if (event.target.closest(".product-gallery-arrow.next")) {
      setActiveGalleryIndex(activeGalleryIndex + 1);
      return;
    }
    if (event.target.closest("#productMainImage")) {
      ssdOpenLightbox(galleryImages, product.name || "Siri Saree", activeGalleryIndex, setActiveGalleryIndex);
    }
  });

  ssdOnSwipe(document.querySelector("#productMainImage"), {
    onSwipeLeft: () => setActiveGalleryIndex(activeGalleryIndex + 1),
    onSwipeRight: () => setActiveGalleryIndex(activeGalleryIndex - 1)
  });
}

function renderNotFound(message) {
  selectors.productPage.innerHTML = `
    <div class="product-not-found">
      <p class="empty-state visible">${message}</p>
      <a class="btn btn-primary" href="index.html#trending">Back to Shopping</a>
    </div>
  `;
}

async function initializeProductPage() {
  // Pre-generated pages (products/<id>.html) carry the id in a meta tag;
  // product.html?id=... (old links, direct testing) still works via the
  // query string fallback.
  const productId = document.querySelector('meta[name="product-id"]')?.content
    || new URLSearchParams(window.location.search).get("id");

  if (!productId) {
    renderNotFound("Product not found");
    return;
  }

  try {
    const product = await ssdFetchProduct(productId);
    renderProduct(product);
    renderWishlist();
    renderCart();
    try {
      similarProducts = await ssdFetchSimilarProducts(productId);
      renderSimilarProducts(similarProducts);
    } catch (error) {
      console.warn(error.message);
    }
  } catch (error) {
    renderNotFound(error.message || "Unable to load this product");
  }
}

document.addEventListener("click", (event) => {
  const card = event.target.closest("[data-similar-product]");
  if (card) window.location.href = ssdProductUrl(card.dataset.similarProduct);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePanels();
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-similar-product]");
  if (!card) return;
  event.preventDefault();
  window.location.href = ssdProductUrl(card.dataset.similarProduct);
});

document.querySelector("#openWishlist")?.addEventListener("click", () => {
  renderWishlist();
  openPanel("wishlistPanel");
});
document.querySelector("#openCart")?.addEventListener("click", () => {
  renderCart();
  openPanel("cartPanel");
});
document.querySelectorAll("[data-close-panel]").forEach((button) => {
  button.addEventListener("click", closePanels);
});
selectors.panelOverlay?.addEventListener("click", closePanels);

selectors.wishlistItems?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-wishlist]");
  if (!removeButton) return;
  wishlist = wishlist.filter((id) => id !== removeButton.dataset.removeWishlist);
  renderWishlist();
  syncWishlistButtons();
});

selectors.cartItems?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-cart]");
  if (!removeButton) return;
  cart = cart.filter((item) => item.id !== removeButton.dataset.removeCart);
  renderCart();
});

document.querySelector("#checkoutBtn")?.addEventListener("click", checkout);

selectors.backTop?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", updateHeaderState);

updateBadge(selectors.wishlistCount, wishlist.length);
updateBadge(selectors.cartCount, cart.reduce((sum, item) => sum + item.quantity, 0));
updateHeaderState();
initializeProductPage();

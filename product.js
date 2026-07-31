const API_BASE = (window.SSD_CONFIG?.API_BASE || "http://127.0.0.1:5000/api").replace(/\/$/, "");

function resolveProductImageUrl(imageUrl) {
  const fallbackImage = "https://images.pexels.com/photos/27575174/pexels-photo-27575174.jpeg?auto=compress&cs=tinysrgb&w=700";
  const normalizedUrl = (imageUrl || "").toString().trim();
  const apiOrigin = "http://127.0.0.1:5000";
  const supabaseUrl = (window.SSD_CONFIG?.SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseBucket = window.SSD_CONFIG?.SUPABASE_BUCKET || "saree_images";

  if (!normalizedUrl) return fallbackImage;
  if (/^https?:\/\//i.test(normalizedUrl)) return normalizedUrl;
  if (supabaseUrl && !normalizedUrl.startsWith("/") && !normalizedUrl.startsWith("storage/")) {
    return `${supabaseUrl}/storage/v1/object/public/${supabaseBucket}/${normalizedUrl}`;
  }
  if (normalizedUrl.startsWith("/")) return `${apiOrigin}${normalizedUrl}`;
  return `${apiOrigin}/${normalizedUrl}`;
}

function productImageUrls(product) {
  const urls = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [product.image || product.image_url];
  return urls.map(resolveProductImageUrl).filter(Boolean).slice(0, 4);
}

function formatPrice(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function getPublicSiteBaseUrl() {
  const configuredUrl = (window.SSD_CONFIG?.PUBLIC_SITE_URL || "").trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  if (window.location.origin && window.location.origin !== "null") {
    return window.location.origin.replace(/\/$/, "");
  }

  return "http://127.0.0.1:5000";
}

function getProductUrl(productId) {
  const url = new URL("product.html", `${getPublicSiteBaseUrl()}/`);
  if (productId) url.searchParams.set("id", productId);
  return url.href;
}

function productPageUrl() {
  return getProductUrl(new URLSearchParams(window.location.search).get("id"));
}

function setMeta(selector, value) {
  const meta = document.querySelector(selector);
  if (meta) meta.setAttribute("content", value);
}

function updateProductMeta(product, imageUrl) {
  const title = `${product.name} | Siri Saree Divine`;
  const description = product.description || `${product.name} for ${formatPrice(product.price)}.`;
  document.title = title;
  setMeta('meta[name="description"]', description);
  setMeta('meta[property="og:title"]', title);
  setMeta('meta[property="og:description"]', description);
  setMeta('meta[property="og:image"]', imageUrl);
  setMeta('meta[property="og:url"]', productPageUrl());
}

function openWhatsApp(number, message) {
  const encodedText = encodeURIComponent(message);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const url = isMobile
    ? `https://api.whatsapp.com/send?phone=${number}&text=${encodedText}`
    : `https://web.whatsapp.com/send?phone=${number}&text=${encodedText}`;
  window.open(url, "_blank");
}

function buyProduct(product) {
  const message = `Hi Siri Sarees!

I would like to order the following product:

Product Name: ${product.name}
Price: ${formatPrice(product.price)}
Product URL: ${productPageUrl()}

Please confirm availability and share the payment details.

Thank you!`;

  const whatsappNumber = window.SSD_CONFIG ? window.SSD_CONFIG.WHATSAPP_NUMBER : "918019655336";
  openWhatsApp(whatsappNumber, message);
}

async function loadProduct(productId) {
  const response = await fetch(`${API_BASE}/products/${encodeURIComponent(productId)}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to load product");
  return result.product;
}

async function loadSimilarProducts(productId) {
  const response = await fetch(`${API_BASE}/products/${encodeURIComponent(productId)}/similar`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to load similar products");
  return result.products || [];
}

function similarProductCard(product) {
  const imageUrl = productImageUrls(product)[0];
  return `
    <article class="product-card reveal visible" data-similar-product="${product.id}" tabindex="0" aria-label="View ${product.name}">
      <img src="${imageUrl}" alt="${product.name}" onerror="console.error('Image load failed:', this.src); this.onerror=null;">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p class="price">${formatPrice(product.price)}</p>
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

function renderProduct(product) {
  const section = document.querySelector("#productPage");
  const images = productImageUrls(product);
  const mainImageUrl = images[0];
  updateProductMeta(product, mainImageUrl);

  let galleryHtml = '';
  if (images.length > 1) {
    const thumbsHtml = images.map((img, idx) => `
      <button class="quick-image-thumb ${idx === 0 ? 'active' : ''}" data-index="${idx}" aria-label="View image ${idx + 1}">
        <img src="${img}" alt="${product.name} thumbnail ${idx + 1}">
      </button>
    `).join('');

    galleryHtml = `
      <div class="quick-view-gallery">
        <div class="main-image-container" style="position: relative;">
          <button class="gallery-nav prev" aria-label="Previous image" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.8); border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); color: var(--text-dark, #333);"><i class="fa-solid fa-chevron-left"></i></button>
          <img id="mainProductImage" src="${mainImageUrl}" alt="${product.name}" onerror="console.error('Image load failed:', this.src); this.onerror=null;">
          <button class="gallery-nav next" aria-label="Next image" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.8); border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); color: var(--text-dark, #333);"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="quick-image-thumbs">
          ${thumbsHtml}
        </div>
      </div>
    `;
  } else {
    galleryHtml = `
      <div class="quick-view-gallery">
        <img src="${mainImageUrl}" alt="${product.name}" onerror="console.error('Image load failed:', this.src); this.onerror=null;">
      </div>
    `;
  }

  section.innerHTML = `
    <div class="product-page-layout">
      ${galleryHtml}
      <div class="product-page-copy">
        <p class="eyebrow">${product.category || "Siri Saree Divine"}</p>
        <h1>${product.name}</h1>
        <p class="price">${formatPrice(product.price)}</p>
        <p class="quick-copy">${product.description || "Premium saree from Siri Sarees."}</p>
        <button class="order-now-btn" type="button" id="buyProduct">
          <i class="fa-brands fa-whatsapp"></i> Buy on WhatsApp
        </button>
      </div>
    </div>
    <div class="similar-products-section" id="similarProductsSection" hidden>
      <div class="section-heading">
        <h2>Similar Sarees</h2>
      </div>
      <div class="product-grid" id="similarProductsGrid"></div>
    </div>
  `;

  document.querySelector("#buyProduct").addEventListener("click", () => buyProduct(product));

  if (images.length > 1) {
    let currentIndex = 0;
    const mainImage = document.getElementById("mainProductImage");
    const thumbs = document.querySelectorAll(".quick-image-thumb");
    const prevBtn = document.querySelector(".gallery-nav.prev");
    const nextBtn = document.querySelector(".gallery-nav.next");

    function updateGallery(index) {
      currentIndex = index;
      mainImage.src = images[currentIndex];
      thumbs.forEach((t, idx) => {
        t.classList.toggle("active", idx === currentIndex);
      });
    }

    thumbs.forEach(thumb => {
      thumb.addEventListener("click", () => updateGallery(parseInt(thumb.dataset.index, 10)));
    });

    prevBtn.addEventListener("click", () => {
      const newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
      updateGallery(newIndex);
    });

    nextBtn.addEventListener("click", () => {
      const newIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
      updateGallery(newIndex);
    });
  }
}

async function initializeProductPage() {
  const productId = new URLSearchParams(window.location.search).get("id");
  const section = document.querySelector("#productPage");

  if (!productId) {
    section.innerHTML = '<p class="empty-state visible">Product not found</p>';
    return;
  }

  try {
    const product = await loadProduct(productId);
    renderProduct(product);
    try {
      renderSimilarProducts(await loadSimilarProducts(productId));
    } catch (error) {
      console.warn(error.message);
    }
  } catch (error) {
    section.innerHTML = `<p class="empty-state visible">${error.message}</p>`;
  }
}

document.addEventListener("click", (event) => {
  const card = event.target.closest("[data-similar-product]");
  if (card) window.location.href = getProductUrl(card.dataset.similarProduct);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-similar-product]");
  if (!card) return;
  event.preventDefault();
  window.location.href = getProductUrl(card.dataset.similarProduct);
});

initializeProductPage();

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

function productPageUrl() {
  const url = new URL(window.location.href);
  return url.href;
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

function renderProduct(product) {
  const section = document.querySelector("#productPage");
  const imageUrl = productImageUrls(product)[0];
  updateProductMeta(product, imageUrl);

  section.innerHTML = `
    <div class="product-page-layout">
      <div class="quick-view-gallery">
        <img src="${imageUrl}" alt="${product.name}" onerror="console.error('Image load failed:', this.src); this.onerror=null;">
      </div>
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
  `;

  document.querySelector("#buyProduct").addEventListener("click", () => buyProduct(product));
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
  } catch (error) {
    section.innerHTML = `<p class="empty-state visible">${error.message}</p>`;
  }
}

initializeProductPage();

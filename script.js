let products = [];

function resolveProductImageUrl(imageUrl) {
  const fallbackImage = "https://images.pexels.com/photos/27575174/pexels-photo-27575174.jpeg?auto=compress&cs=tinysrgb&w=700";
  const normalizedUrl = (imageUrl || "").toString().trim();
  const apiOrigin = "http://127.0.0.1:5000";
  const supabaseUrl = (window.SSD_CONFIG?.SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseBucket = window.SSD_CONFIG?.SUPABASE_BUCKET || "saree_images";

  if (!normalizedUrl) return fallbackImage;
  if (/^https?:\/\//i.test(normalizedUrl)) {
    const url = new URL(normalizedUrl);
    if (url.origin === apiOrigin && url.pathname.startsWith("/uploads/")) {
      return `${apiOrigin}/api${url.pathname}`;
    }
    return normalizedUrl;
  }
  if (normalizedUrl.startsWith("/uploads/")) return `${apiOrigin}/api${normalizedUrl}`;
  if (normalizedUrl.startsWith("uploads/")) return `${apiOrigin}/api/${normalizedUrl}`;
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

async function loadProductsFromBackend() {
  try {
    const response = await fetch("http://127.0.0.1:5000/api/products");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load products");
    products = (result.products || []).map((product) => {
      const images = (Array.isArray(product.images) ? product.images : []).map(resolveProductImageUrl).filter(Boolean).slice(0, 4);
      const image = images[0] || resolveProductImageUrl(product.image_url || "https://images.pexels.com/photos/27575174/pexels-photo-27575174.jpeg?auto=compress&cs=tinysrgb&w=700");
      return {
        ...product,
        id: product.id,
        name: product.name,
        category: product.category,
        price: Number(product.price),
        image,
        images: images.length > 0 ? images : [image],
        description: product.description || "Premium saree from Siri Sarees.",
        colors: ["Classic", "Elegant"],
        sizes: ["Regular Saree (5.5 Meters)"]
      };
    });
    return products;
  } catch (error) {
    console.error(error);
    return [];
  }
}

const fallbackProducts = [
  {
    id: "silk-gold",
    name: "Kanchipuram Gold Silk Saree",
    category: "Silk Sarees",
    price: 8999,
    image: "https://tse3.mm.bing.net/th/id/OIP.erOnXfVur0adgOKfqgVw2wHaLH?rs=1&pid=ImgDetMain&o=7&rm=3",
    description: "A lustrous festive silk saree with rich zari accents for weddings and grand celebrations.",
    colors: ["Classic Gold", "Royal Crimson Red", "Deep Emerald Green"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)", "Saree with Custom Stitched Blouse"]
  },
  {
    id: "silk-maroon",
    name: "Maroon Temple Border Silk Saree",
    category: "Silk Sarees",
    price: 9499,
    image: "https://images.pexels.com/photos/27575174/pexels-photo-27575174.jpeg?auto=compress&cs=tinysrgb&w=700",
    description: "A radiant silk drape with a traditional temple border and an heirloom finish.",
    colors: ["Deep Maroon", "Temple Orange", "Peacock Blue"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)"]
  },
  {
    id: "cotton-green",
    name: "Handloom Cotton Green Saree",
    category: "Cotton Sarees",
    price: 3499,
    image: "https://assets0.mirraw.com/images/11531348/AS-20BC1665(2)_zoom.jpg?1684848107",
    description: "Breathable handloom cotton for graceful everyday wear and elegant daytime events.",
    colors: ["Sage Green", "Mustard Yellow", "Peach Pink"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)"]
  },
  {
    id: "cotton-indigo",
    name: "Indigo Woven Cotton Saree",
    category: "Cotton Sarees",
    price: 2899,
    image: "https://th.bing.com/th/id/R.210fcf84c2769fe2580112a461ab7794?rik=5XMathW1%2f%2f%2fBlA&riu=http%3a%2f%2f5.imimg.com%2fdata5%2fANDROID%2fDefault%2f2023%2f1%2fWQ%2fFN%2fQB%2f129769159%2fproduct-jpeg-1000x1000.jpg&ehk=2nQ2uaPgEZuFuv1pcKa%2bEgDOQTMpsm25IZIWtbqzUb0%3d&risl=&pid=ImgRaw&r=0",
    description: "A soft cotton weave with a calm indigo tone and subtle border detailing.",
    colors: ["Indigo Blue", "Ink Black"],
    sizes: ["Regular Saree (5.5 Meters)"]
  },
  {
    id: "banarasi-red",
    name: "Banarasi Zari Royale Saree",
    category: "Banarasi Sarees",
    price: 12499,
    image: "https://sareewave.com/cdn/shop/files/AYN4004ROYALBLUE-5.jpg?v=1706176595",
    description: "Royal Banarasi artistry with opulent zari work for reception-ready styling.",
    colors: ["Royal Blue", "Crimson Red", "Magenta Pink"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)", "Saree with Custom Stitched Blouse"]
  },
  {
    id: "banarasi-rose",
    name: "Rose Banarasi Brocade Saree",
    category: "Banarasi Sarees",
    price: 10999,
    image: "https://media.urbanwomania.com/wp-content/uploads/2024/01/Rose-Pink-Georgette-Silk-Banarasi-Saree-with-Meenakari.webp",
    description: "A brocade-rich Banarasi saree with soft rose tones and heritage woven motifs.",
    colors: ["Rose Pink", "Soft Lavender", "Mint Green"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)"]
  },
  {
    id: "mysore-temple",
    name: "Mysore Silk Temple Gold Saree",
    category: "Mysore Silk Sarees",
    price: 7299,
    image: "https://images.pexels.com/photos/12006825/pexels-photo-12006825.jpeg?auto=compress&cs=tinysrgb&w=700",
    description: "Refined southern grace in a smooth Mysore silk drape with a polished glow.",
    colors: ["Golden Ochre", "Navy Blue", "Rich Maroon"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)"]
  },
  {
    id: "mysore-emerald",
    name: "Emerald Mysore Silk Saree",
    category: "Mysore Silk Sarees",
    price: 8199,
    image: "https://tse2.mm.bing.net/th/id/OIP.qw5Cik5a0npmoAV8Da8NGAHaLH?rs=1&pid=ImgDetMain&o=7&rm=3",
    description: "A jewel-toned Mysore silk saree made for festive evenings and temple visits.",
    colors: ["Emerald Green", "Ruby Red", "Deep Violet"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)", "Saree with Custom Stitched Blouse"]
  },
  {
    id: "georgette-pink",
    name: "Rose Georgette Party Saree",
    category: "Georgette Sarees",
    price: 5899,
    image: "https://i.pinimg.com/originals/ff/26/bf/ff26bf26abd7c05c10b9e46c40e84fb6.jpg",
    description: "A flowy georgette party saree with a soft fall and occasion-ready elegance.",
    colors: ["Rose Pink", "Champagne Gold", "Teal Blue"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)"]
  },
  {
    id: "georgette-champagne",
    name: "Champagne Georgette Saree",
    category: "Georgette Sarees",
    price: 6299,
    image: "https://tse3.mm.bing.net/th/id/OIP.h0K35SumLiNjh7hZUtH3AgHaKf?rs=1&pid=ImgDetMain&o=7&rm=3",
    description: "A light georgette drape with champagne shimmer and effortless movement.",
    colors: ["Champagne", "Ivory White", "Peach Fuzz"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)"]
  },
  {
    id: "designer-ruby",
    name: "Ruby Designer Bridal Saree",
    category: "Designer Sarees",
    price: 9999,
    image: "https://manyavar.scene7.com/is/image/manyavar/SB16047_422-WINE_401.5868_25-12-2024-16-14:650x900",
    description: "A statement designer saree with bridal-inspired details and a rich ruby mood.",
    colors: ["Ruby Red", "Wine Burgundy", "Plum Purple"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)", "Saree with Custom Stitched Blouse"]
  },
  {
    id: "designer-pearl",
    name: "Pearl Embellished Designer Saree",
    category: "Designer Sarees",
    price: 11499,
    image: "https://assets0.mirraw.com/images/10074402/1006_(3)_zoom.jpg?1647776442",
    description: "An embellished designer saree with polished pearl-like detailing for receptions.",
    colors: ["Creamy Pearl White", "Soft Lilac", "Champagne Dust"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)", "Saree with Custom Stitched Blouse"]
  },
  {
    id: "linen-sunrise",
    name: "Sunrise Linen Saree",
    category: "Linen Sarees",
    price: 4599,
    image: "https://images.pexels.com/photos/29426609/pexels-photo-29426609.jpeg?auto=compress&cs=tinysrgb&w=700",
    description: "A crisp linen drape with warm festive tones and easy everyday refinement.",
    colors: ["Sunrise Orange", "Lemon Yellow", "Sandy Beige"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)"]
  },
  {
    id: "organza-ivory",
    name: "Ivory Organza Floral Saree",
    category: "Organza Sarees",
    price: 6899,
    image: "https://images.pexels.com/photos/17040015/pexels-photo-17040015.jpeg?auto=compress&cs=tinysrgb&w=700",
    description: "A delicate organza saree with floral charm for brunches, engagements, and celebrations.",
    colors: ["Ivory White", "Blush Pink", "Mint Cream"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)"]
  },
  {
    id: "chiffon-coral",
    name: "Coral Chiffon Saree",
    category: "Chiffon Sarees",
    price: 3999,
    image: "https://images.pexels.com/photos/19967777/pexels-photo-19967777.jpeg?auto=compress&cs=tinysrgb&w=700",
    description: "A breezy chiffon saree with a coral hue and a graceful, lightweight drape.",
    colors: ["Coral Orange", "Mint Green", "Aqua Blue"],
    sizes: ["Regular Saree (5.5 Meters)", "Saree with Unstitched Blouse (6.3 Meters)"]
  }
];

const selectors = {
  header: document.querySelector("#siteHeader"),
  mainNav: document.querySelector("#mainNav"),
  menuToggle: document.querySelector(".menu-toggle"),
  backTop: document.querySelector(".back-top"),
  productGrid: document.querySelector("#productGrid"),
  emptyState: document.querySelector("#emptyState"),
  searchInput: document.querySelector("#searchInput"),
  searchForm: document.querySelector("#searchForm"),
  searchSummary: document.querySelector("#searchSummary"),
  cartCount: document.querySelector(".cart-count"),
  wishlistCount: document.querySelector(".wishlist-count"),
  subscriptionForm: document.querySelector("#subscriptionForm"),
  subscriptionPhone: document.querySelector("#subscriptionPhone"),
  formMessage: document.querySelector(".form-message"),
  panelOverlay: document.querySelector("#panelOverlay"),
  panels: document.querySelectorAll(".side-panel"),
  wishlistItems: document.querySelector("#wishlistItems"),
  wishlistEmpty: document.querySelector("#wishlistEmpty"),
  cartItems: document.querySelector("#cartItems"),
  cartEmpty: document.querySelector("#cartEmpty"),
  cartTotal: document.querySelector("#cartTotal"),
  moreCollections: document.querySelector("#moreCollections"),
  moreGrid: document.querySelector("#moreGrid"),
  moreLoading: document.querySelector("#moreLoading"),
  loadMoreProducts: document.querySelector("#loadMoreProducts"),
  quickViewModal: document.querySelector("#quickViewModal"),
  quickViewContent: document.querySelector("#quickViewContent")
};

const storeKeys = {
  wishlist: "siriSareesWishlist",
  cart: "siriSareesCart"
};

let wishlist = readStore(storeKeys.wishlist, []);
let cart = readStore(storeKeys.cart, []);
let visibleMoreCount = 6;

function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatPrice(value) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function getPublicSiteBaseUrl() {
  const configuredUrl = (window.SSD_CONFIG?.PUBLIC_SITE_URL || "").trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  if (window.location.origin && window.location.origin !== "null") {
    return window.location.origin.replace(/\/$/, "");
  }

  return "http://127.0.0.1:5000";
}

function getProductUrl(id) {
  const productBaseUrl = getPublicSiteBaseUrl();
  const productUrl = new URL("product.html", `${productBaseUrl}/`);
  productUrl.searchParams.set("id", id);
  return productUrl.href;
}

function productById(id) {
  return products.find((product) => product.id === id);
}

async function ensureProductsLoaded() {
  if (products.length === 0) {
    const backendProducts = await loadProductsFromBackend();
    products = backendProducts.length > 0 ? backendProducts : fallbackProducts;
  }
  return products;
}


function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, "");
}

function isValidPhone(phone) {
  return /^(?:\+91[-\s]?)?[6-9]\d{9}$/.test(phone.trim()) || /^\+\d{10,15}$/.test(phone.trim());
}

function updateHeaderState() {
  selectors.header.classList.toggle("scrolled", window.scrollY > 18);
  selectors.backTop.classList.toggle("visible", window.scrollY > 520);
}

function updateBadge(badge, value) {
  badge.textContent = value;
  badge.classList.toggle("visible", value > 0);
}

function productCard(product) {
  const wished = wishlist.includes(product.id);
  const imageUrl = productImageUrls(product)[0];
  console.log("[product-image]", imageUrl);
  return `
    <article class="product-card reveal visible" data-id="${product.id}" tabindex="0" aria-label="View ${product.name}">
      <button class="wishlist-btn ${wished ? "active" : ""}" type="button" data-wishlist="${product.id}" aria-label="${wished ? "Remove" : "Add"} ${product.name} ${wished ? "from" : "to"} wishlist">
        <i class="${wished ? "fa-solid" : "fa-regular"} fa-heart"></i>
      </button>
      <img src="${imageUrl}" alt="${product.name}" onerror="console.error('Image load failed:', this.src); this.onerror=null;">
      <div class="product-info">
        <p class="product-category">${product.category}</p>
        <h3>${product.name}</h3>
        <p class="price">${formatPrice(product.price)}</p>
        <div class="product-actions">
          <button class="quick-view" type="button" data-quick-view="${product.id}">Quick View</button>
          <button class="order-now-btn" type="button" data-order-now="${product.id}">
            <i class="fa-brands fa-whatsapp"></i> Order Now
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderProductGrid(container, list) {
  container.innerHTML = list.map(productCard).join("");
}

async function renderTrending(list = null) {
  const activeProducts = await ensureProductsLoaded();
  const items = list || activeProducts.slice(0, 6);
  renderProductGrid(selectors.productGrid, items);
  selectors.emptyState.classList.toggle("visible", items.length === 0);
}

async function filterProducts() {
  const activeProducts = await ensureProductsLoaded();
  const query = selectors.searchInput.value.trim().toLowerCase();
  const filtered = activeProducts.filter((product) => {
    const searchableText = `${product.name} ${product.category} ${product.description}`.toLowerCase();
    return searchableText.includes(query);
  });

  renderTrending(query ? filtered : activeProducts.slice(0, 6));
  selectors.searchSummary.textContent = query
    ? `${filtered.length} result${filtered.length === 1 ? "" : "s"} for "${selectors.searchInput.value.trim()}"`
    : "";
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

function toggleLoading(loader, isLoading) {
  loader.classList.toggle("visible", isLoading);
}

function openMoreCollections() {
  visibleMoreCount = 6;
  selectors.moreCollections.classList.add("open");
  selectors.moreGrid.innerHTML = "";
  toggleLoading(selectors.moreLoading, true);
  selectors.moreCollections.scrollIntoView({ behavior: "smooth", block: "start" });

  setTimeout(() => {
    renderMoreCollections();
    toggleLoading(selectors.moreLoading, false);
  }, 350);
}

async function renderMoreCollections() {
  const activeProducts = await ensureProductsLoaded();
  const list = activeProducts.slice(6, 6 + visibleMoreCount);
  renderProductGrid(selectors.moreGrid, list);
  selectors.loadMoreProducts.style.display = 6 + visibleMoreCount >= activeProducts.length ? "none" : "inline-flex";
}

function closeMoreCollections() {
  selectors.moreCollections.classList.remove("open");
  document.querySelector("#trending").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderWishlist() {
  const wishlistProducts = wishlist.map(productById).filter(Boolean);
  selectors.wishlistItems.innerHTML = wishlistProducts.map((product) => {
    const imageUrl = productImageUrls(product)[0];
    return `
    <div class="panel-item">
      <img src="${imageUrl}" alt="${product.name}" onerror="console.error('Image load failed:', this.src); this.onerror=null;">
      <div>
        <h3>${product.name}</h3>
        <p>${product.category}</p>
        <strong>${formatPrice(product.price)}</strong>
      </div>
      <button class="remove-btn" type="button" data-remove-wishlist="${product.id}" aria-label="Remove ${product.name} from wishlist">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
  }).join("");

  selectors.wishlistEmpty.classList.toggle("visible", wishlist.length === 0);
  updateBadge(selectors.wishlistCount, wishlist.length);
  writeStore(storeKeys.wishlist, wishlist);
}

function renderCart() {
  const cartItems = cart.map((item) => ({ ...item, product: productById(item.id) })).filter((item) => item.product);
  selectors.cartItems.innerHTML = cartItems.map(({ product, quantity }) => {
    const imageUrl = productImageUrls(product)[0];
    return `
    <div class="panel-item cart-item">
      <img src="${imageUrl}" alt="${product.name}" onerror="console.error('Image load failed:', this.src); this.onerror=null;">
      <div>
        <h3>${product.name}</h3>
        <p>Quantity: ${quantity}</p>
        <strong>${formatPrice(product.price * quantity)}</strong>
      </div>
      <button class="remove-btn" type="button" data-remove-cart="${product.id}" aria-label="Remove ${product.name} from cart">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
  }).join("");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => {
    const product = productById(item.id);
    return product ? sum + product.price * item.quantity : sum;
  }, 0);
  selectors.cartEmpty.classList.toggle("visible", cart.length === 0);
  selectors.cartTotal.textContent = formatPrice(totalAmount);
  updateBadge(selectors.cartCount, totalItems);
  writeStore(storeKeys.cart, cart);
}

function rerenderOpenProductSurfaces() {
  filterProducts();
  if (selectors.moreCollections.classList.contains("open")) renderMoreCollections();
}

function toggleWishlist(id) {
  wishlist = wishlist.includes(id)
    ? wishlist.filter((itemId) => itemId !== id)
    : [...wishlist, id];
  renderWishlist();
  rerenderOpenProductSurfaces();
}

function addToCart(id, button) {
  const existingItem = cart.find((item) => item.id === id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ id, quantity: 1 });
  }

  renderCart();
  if (!button) return;
  button.textContent = "Added";
  button.classList.add("added");
  setTimeout(() => {
    button.textContent = "Add to Cart";
    button.classList.remove("added");
  }, 1200);
}

function openQuickView(id) {
  const product = productById(id);
  if (!product) return;

  const colorsMarkup = product.colors && product.colors.length > 0
    ? `
      <div class="product-option-selector">
        <label for="quickColorSelect">🎨 Select Color</label>
        <select id="quickColorSelect" class="quick-option-select">
          ${product.colors.map(color => `<option value="${color}">${color}</option>`).join("")}
        </select>
      </div>
    `
    : "";

  const sizesMarkup = product.sizes && product.sizes.length > 0
    ? `
      <div class="product-option-selector">
        <label for="quickSizeSelect">📏 Select Size</label>
        <select id="quickSizeSelect" class="quick-option-select">
          ${product.sizes.map(size => `<option value="${size}">${size}</option>`).join("")}
        </select>
      </div>
    `
    : "";

  const imageUrls = productImageUrls(product);
  const imageUrl = imageUrls[0];
  const thumbnailsMarkup = imageUrls.length > 1
    ? `
      <div class="quick-image-thumbs" aria-label="Product images">
        ${imageUrls.map((url, index) => `
          <button class="quick-image-thumb ${index === 0 ? "active" : ""}" type="button" data-quick-image="${url}" aria-label="View image ${index + 1}" aria-pressed="${index === 0 ? "true" : "false"}">
            <img src="${url}" alt="${product.name} thumbnail ${index + 1}">
          </button>
        `).join("")}
      </div>
    `
    : "";
  console.log("[product-image]", imageUrl);
  selectors.quickViewContent.innerHTML = `
    <div class="quick-view-layout">
      <div class="quick-view-gallery">
        <img id="quickViewMainImage" src="${imageUrl}" alt="${product.name}" onerror="console.error('Image load failed:', this.src); this.onerror=null;">
        ${thumbnailsMarkup}
      </div>
      <div>
        <p class="eyebrow">${product.category}</p>
        <h3>${product.name}</h3>
        <p class="price">${formatPrice(product.price)}</p>
        <p class="quick-copy">${product.description}</p>
        
        <div class="product-options-container">
          ${colorsMarkup}
          ${sizesMarkup}
        </div>

        <div class="product-actions" style="margin-top: 20px;">
          <button class="quick-view" type="button" data-wishlist="${product.id}">
            ${wishlist.includes(product.id) ? "Remove from Wishlist" : "Add to Wishlist"}
          </button>
          <button class="add-cart" type="button" data-cart="${product.id}">Add to Cart</button>
          <button class="order-now-btn" type="button" data-order-now="${product.id}">
            <i class="fa-brands fa-whatsapp"></i> Order Now
          </button>
        </div>
      </div>
    </div>
  `;
  selectors.quickViewModal.classList.add("open");
  selectors.quickViewModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("panel-open");
}

function switchQuickViewImage(button) {
  const mainImage = document.querySelector("#quickViewMainImage");
  if (!mainImage) return;
  mainImage.src = button.dataset.quickImage;
  document.querySelectorAll(".quick-image-thumb").forEach((thumb) => {
    const isActive = thumb === button;
    thumb.classList.toggle("active", isActive);
    thumb.setAttribute("aria-pressed", String(isActive));
  });
}

function closeQuickView() {
  selectors.quickViewModal.classList.remove("open");
  selectors.quickViewModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("panel-open");
}



function openWhatsApp(number, message) {
  const encodedText = encodeURIComponent(message);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  let url;
  if (isMobile) {
    url = `https://api.whatsapp.com/send?phone=${number}&text=${encodedText}`;
  } else {
    url = `https://web.whatsapp.com/send?phone=${number}&text=${encodedText}`;
  }

  window.open(url, "_blank");
}

function orderProductWhatsApp(id) {
  const product = productById(id);
  if (!product) return;

  let color = "Standard";
  let size = "Standard";

  const isQuickViewOpen = selectors.quickViewModal.classList.contains("open");

  if (isQuickViewOpen) {
    const colorSelect = document.getElementById("quickColorSelect");
    const sizeSelect = document.getElementById("quickSizeSelect");
    if (colorSelect) color = colorSelect.value;
    else if (product.colors && product.colors.length > 0) color = product.colors[0];

    if (sizeSelect) size = sizeSelect.value;
    else if (product.sizes && product.sizes.length > 0) size = product.sizes[0];
  } else {
    if (product.colors && product.colors.length > 0) color = product.colors[0];
    if (product.sizes && product.sizes.length > 0) size = product.sizes[0];
  }

  // Include the shareable product URL so WhatsApp orders carry the exact item link.
  const message = `Hi Siri Sarees!

I would like to order the following product:

Product Name: ${product.name}
Price: ${formatPrice(product.price)}
Product URL: ${getProductUrl(product.id)}
Color: ${color}
Size: ${size}

Please confirm availability and share the payment details.

Thank you!`;

  // Get WhatsApp number from configuration
  const whatsappNumber = window.SSD_CONFIG ? window.SSD_CONFIG.WHATSAPP_NUMBER : "918019655336";



  // Redirect to WhatsApp
  openWhatsApp(whatsappNumber, message);
}

function checkout() {
  if (cart.length === 0) return;

  const total = cart.reduce((sum, item) => {
    const product = productById(item.id);
    return product ? sum + product.price * item.quantity : sum;
  }, 0);

  // Format Cart WhatsApp message
  const cartItems = cart.map(item => ({ ...item, product: productById(item.id) })).filter(item => item.product);
  let message = `Hi Siri Sarees!\n\nI would like to order the following products from my cart:\n\n`;
  cartItems.forEach(item => {
    message += `🛍 Product: ${item.product.name}\n🆔 Product ID: ${item.id}\n💰 Price: ₹${item.product.price} (Qty: ${item.quantity})\n\n`;
  });
  message += `💰 Total Amount: ₹${total}\n\nPlease confirm availability and share the payment details.\n\nThank you!`;

  cart = [];
  renderCart();

  // Redirect to WhatsApp
  const whatsappNumber = window.SSD_CONFIG ? window.SSD_CONFIG.WHATSAPP_NUMBER : "918019655336";
  openWhatsApp(whatsappNumber, message);
}

function handleProductClick(event) {
  const imageButton = event.target.closest("[data-quick-image]");
  if (imageButton) {
    switchQuickViewImage(imageButton);
    return;
  }

  const wishlistButton = event.target.closest("[data-wishlist]");
  const cartButton = event.target.closest("[data-cart]");
  const quickButton = event.target.closest("[data-quick-view]");
  const orderButton = event.target.closest("[data-order-now]");
  const productCard = event.target.closest(".product-card[data-id]");

  if (wishlistButton) {
    toggleWishlist(wishlistButton.dataset.wishlist);
    return;
  }
  if (cartButton) {
    addToCart(cartButton.dataset.cart, cartButton);
    return;
  }
  if (quickButton) {
    openQuickView(quickButton.dataset.quickView);
    return;
  }
  if (orderButton) {
    orderProductWhatsApp(orderButton.dataset.orderNow);
    return;
  }
  if (productCard) {
    window.location.href = getProductUrl(productCard.dataset.id);
  }
}

function handleProductKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target.closest("button")) return;
  const productCard = event.target.closest(".product-card[data-id]");
  if (!productCard) return;
  event.preventDefault();
  window.location.href = getProductUrl(productCard.dataset.id);
}

selectors.menuToggle.addEventListener("click", () => {
  const isOpen = selectors.mainNav.classList.toggle("open");
  selectors.menuToggle.setAttribute("aria-expanded", String(isOpen));
  selectors.menuToggle.innerHTML = isOpen
    ? '<i class="fa-solid fa-xmark"></i>'
    : '<i class="fa-solid fa-bars"></i>';
});

selectors.mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    selectors.mainNav.classList.remove("open");
    selectors.menuToggle.setAttribute("aria-expanded", "false");
    selectors.menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
  });
});

[selectors.productGrid, selectors.moreGrid, selectors.quickViewContent].forEach((container) => {
  container.addEventListener("click", handleProductClick);
  container.addEventListener("keydown", handleProductKeydown);
});

selectors.wishlistItems.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-wishlist]");
  if (!removeButton) return;
  wishlist = wishlist.filter((id) => id !== removeButton.dataset.removeWishlist);
  renderWishlist();
  rerenderOpenProductSurfaces();
});

selectors.cartItems.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-cart]");
  if (!removeButton) return;
  cart = cart.filter((item) => item.id !== removeButton.dataset.removeCart);
  renderCart();
});


document.querySelector("#openWishlist").addEventListener("click", () => {
  renderWishlist();
  openPanel("wishlistPanel");
});
document.querySelector("#openCart").addEventListener("click", () => {
  renderCart();
  openPanel("cartPanel");
});

document.querySelectorAll("[data-close-panel]").forEach((button) => {
  button.addEventListener("click", closePanels);
});

selectors.panelOverlay.addEventListener("click", closePanels);
document.querySelector("#viewMoreTrending").addEventListener("click", openMoreCollections);
document.querySelector("#backToTrending").addEventListener("click", closeMoreCollections);
document.querySelector("#closeMoreCollections").addEventListener("click", closeMoreCollections);
selectors.loadMoreProducts.addEventListener("click", () => {
  visibleMoreCount += 3;
  renderMoreCollections();
});
document.querySelector("#closeQuickView").addEventListener("click", closeQuickView);
selectors.quickViewModal.addEventListener("click", (event) => {
  if (event.target === selectors.quickViewModal) closeQuickView();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePanels();
    closeQuickView();
  }
});

selectors.searchForm.addEventListener("submit", (event) => event.preventDefault());
selectors.searchInput.addEventListener("input", () => filterProducts());

selectors.subscriptionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const phone = normalizePhone(selectors.subscriptionPhone.value.trim());
  selectors.formMessage.classList.remove("success", "error");

  if (!isValidPhone(phone)) {
    selectors.formMessage.textContent = "Please enter a valid mobile number for collection alerts.";
    selectors.formMessage.classList.add("error");
    return;
  }

  selectors.formMessage.textContent = "You will receive Siri Saree Divine new collection alerts on your phone.";
  selectors.formMessage.classList.add("success");
  selectors.subscriptionPhone.value = "";
});



document.querySelector("#checkoutBtn").addEventListener("click", checkout);

selectors.backTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll(".reveal").forEach((item) => observer.observe(item));
window.addEventListener("scroll", updateHeaderState);
async function initializeStore() {
  await ensureProductsLoaded();
  await renderTrending();
  renderWishlist();
  renderCart();
  updateHeaderState();
}

initializeStore();

// Generates one static HTML file per product under products/<id>.html so
// WhatsApp/Facebook/Google link-preview crawlers (which don't run
// JavaScript) see the correct per-product title/description/image instead
// of the generic placeholder baked into product.html. Real visitors still
// get the full interactive page -- product.js re-renders everything
// client-side exactly as before, this just makes the *initial* HTML
// response carry the right tags.
//
// Run this after adding, editing, or deleting products, then commit +
// push the products/ folder:
//
//   node scripts/generate-product-pages.mjs

import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FALLBACK_IMAGE = "https://images.pexels.com/photos/27575174/pexels-photo-27575174.jpeg?auto=compress&cs=tinysrgb&w=700";

function readConfigValue(configSource, key) {
  const match = configSource.match(new RegExp(`${key}:\\s*"([^"]*)"`));
  return match ? match[1] : "";
}

async function loadConfig() {
  const configSource = await readFile(path.join(ROOT, "config.js"), "utf8");
  const supabaseUrl = readConfigValue(configSource, "SUPABASE_URL");
  const supabaseAnonKey = readConfigValue(configSource, "SUPABASE_ANON_KEY");
  const supabaseBucket = readConfigValue(configSource, "SUPABASE_BUCKET") || "saree_images";
  const publicSiteUrl = readConfigValue(configSource, "PUBLIC_SITE_URL");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("config.js is missing SUPABASE_URL/SUPABASE_ANON_KEY");
  }
  if (!publicSiteUrl) {
    throw new Error("config.js PUBLIC_SITE_URL is empty -- set it to this site's live URL (e.g. https://geethikajonnala.github.io/Siri_sarees) before generating product pages");
  }

  return { supabaseUrl, supabaseAnonKey, supabaseBucket, publicSiteUrl: publicSiteUrl.replace(/\/$/, "") };
}

async function fetchProducts({ supabaseUrl, supabaseAnonKey }) {
  const response = await fetch(`${supabaseUrl}/rest/v1/products?select=*`, {
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function resolveImageUrl(rawUrl, { supabaseUrl, supabaseBucket }) {
  const url = (rawUrl || "").trim();
  if (!url) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(url)) return url;
  return `${supabaseUrl}/storage/v1/object/public/${supabaseBucket}/${url.replace(/^\/+/, "")}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function buildPage(template, product, config) {
  const images = (product.image_url || "").split(",").map((url) => url.trim()).filter(Boolean);
  const imageUrl = resolveImageUrl(images[0], config);
  const name = product.name || "Siri Saree Divine Product";
  const title = `${name} | Siri Saree Divine`;
  const description = (product.description || `${name} for Rs. ${Number(product.price || 0).toLocaleString("en-IN")}.`).slice(0, 300);
  const pageUrl = `${config.publicSiteUrl}/products/${product.id}.html`;

  // This file lives one directory deeper than product.html, so every local
  // asset/script/link reference needs a ../ prefix.
  let html = template
    .replace(/="assets\//g, '="../assets/')
    .replace(/="style\.css"/g, '="../style.css"')
    .replace(/="favicon\.ico"/g, '="../favicon.ico"')
    .replace(/="index\.html/g, '="../index.html')
    .replace(/="config\.js/g, '="../config.js')
    .replace(/="common\.js/g, '="../common.js')
    .replace(/="product\.js/g, '="../product.js');

  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${escapeHtml(pageUrl)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapeHtml(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${escapeHtml(imageUrl)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${escapeHtml(pageUrl)}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escapeHtml(title)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${escapeHtml(imageUrl)}$2`)
    .replace(
      '<meta name="robots" content="index, follow">',
      `<meta name="robots" content="index, follow">\n  <meta name="product-id" content="${escapeHtml(product.id)}">`
    )
    .replace(
      '<script type="application/ld+json" id="productJsonLd"></script>',
      `<script type="application/ld+json" id="productJsonLd">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name,
        description,
        image: imageUrl,
        url: pageUrl,
        brand: { "@type": "Brand", name: "Siri Saree Divine" },
        offers: {
          "@type": "Offer",
          url: pageUrl,
          priceCurrency: "INR",
          price: Number(product.price) || 0,
          availability: "https://schema.org/InStock"
        }
      })}</script>`
    );

  return html;
}

async function main() {
  const config = await loadConfig();
  const template = await readFile(path.join(ROOT, "product.html"), "utf8");
  const products = await fetchProducts(config);

  const outDir = path.join(ROOT, "products");
  await mkdir(outDir, { recursive: true });

  const existingFiles = await readdir(outDir).catch(() => []);
  const currentFiles = new Set(products.map((product) => `${product.id}.html`));

  await Promise.all(products.map((product) =>
    writeFile(path.join(outDir, `${product.id}.html`), buildPage(template, product, config), "utf8")
  ));

  const staleFiles = existingFiles.filter((file) => file.endsWith(".html") && !currentFiles.has(file));
  await Promise.all(staleFiles.map((file) => unlink(path.join(outDir, file))));

  console.log(`Generated ${products.length} product page(s) in products/`);
  if (staleFiles.length > 0) {
    console.log(`Removed ${staleFiles.length} stale page(s): ${staleFiles.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

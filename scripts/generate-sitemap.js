// Regenerates /sitemap.xml from the current Supabase product catalog.
//
// Run this after adding/removing products so the sitemap stays accurate:
//   node scripts/generate-sitemap.js
//
// Reads SUPABASE_URL / SUPABASE_ANON_KEY / PUBLIC_SITE_URL straight out of
// config.js so there is only one place to update these values.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const configSource = fs.readFileSync(path.join(ROOT, "config.js"), "utf8");

function readConfigValue(key) {
  const match = configSource.match(new RegExp(`${key}:\\s*"([^"]*)"`));
  if (!match) throw new Error(`Could not find ${key} in config.js`);
  return match[1];
}

const SUPABASE_URL = readConfigValue("SUPABASE_URL");
const SUPABASE_ANON_KEY = readConfigValue("SUPABASE_ANON_KEY");
const SITE_URL = readConfigValue("PUBLIC_SITE_URL").replace(/\/$/, "");

function xmlEscape(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
  }[char]));
}

async function fetchProducts() {
  const url = `${SUPABASE_URL}/rest/v1/products?select=id,created_at&order=created_at.desc`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function buildUrlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>"
  ].filter(Boolean).join("\n");
}

async function main() {
  const products = await fetchProducts();
  const today = new Date().toISOString().slice(0, 10);

  const entries = [
    buildUrlEntry({ loc: `${SITE_URL}/`, lastmod: today, changefreq: "daily", priority: "1.0" }),
    ...products.map((product) =>
      buildUrlEntry({
        loc: `${SITE_URL}/product.html?id=${product.id}`,
        lastmod: (product.created_at || today).slice(0, 10),
        changefreq: "weekly",
        priority: "0.8"
      })
    )
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;

  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml);
  console.log(`sitemap.xml written with ${products.length} product page(s).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

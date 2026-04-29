// build-store.mjs
//
// runs at deploy time on cloudflare pages.
// fetches active products from stripe, downloads + optimizes each product image
// (resize to ≤1200px wide, convert to webp q80), ensures each non-inquire product
// has a payment link, then renders product cards into store.html between the
// <!-- BUILD products --> ... <!-- /BUILD --> markers.
//
// product metadata in stripe drives behavior:
//   metadata.size           — string shown on the card (optional)
//   metadata.inquire_only   — "true" → renders a mailto link instead of buy
//   metadata.order          — integer; lower numbers come first (optional)
//   metadata.payment_link        — populated by this script; do not edit by hand
//   metadata.payment_link_price  — populated by this script; do not edit by hand
//
// images are written to ./store_assets/<product_id>/<index>.webp at build time
// and served from cloudflare's cdn alongside the html. the directory is
// regenerated each build, so it is gitignored.
//
// failure mode: if STRIPE_SECRET_KEY is missing or stripe is unreachable, the
// script logs a warning, leaves an empty product list in store.html, and
// exits 0 so the rest of the site still deploys. if a single image fails to
// download, the script falls back to the original stripe url for that image.

import Stripe from 'stripe';
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const STORE_HTML = './store.html';
const ASSETS_DIR = './store_assets';
const SUCCESS_URL = 'https://pharmaceutical.audio/store/thanks';
const SHIPPING_COUNTRIES = [
  'AU', 'AT', 'BE', 'CA', 'CH', 'CZ', 'DE', 'DK', 'ES', 'FI',
  'FR', 'GB', 'IE', 'IT', 'JP', 'NL', 'NO', 'NZ', 'PL', 'PT',
  'SE', 'US',
];

const IMAGE_MAX_WIDTH = 1200;
const IMAGE_QUALITY = 80;

const BUILD_OPEN = '<!-- BUILD products -->';
const BUILD_CLOSE = '<!-- /BUILD -->';

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  let products = [];

  if (!key) {
    console.warn('[build-store] STRIPE_SECRET_KEY not set — rendering empty store');
  } else {
    try {
      products = await fetchProducts(new Stripe(key));
      await processImages(products);
    } catch (err) {
      console.error('[build-store] stripe error — rendering empty store:', err.message);
      products = [];
    }
  }

  const itemsHtml = products.length === 0
    ? ''
    : products.map(renderProduct).join('\n\n');

  const template = await readFile(STORE_HTML, 'utf-8');
  const open = template.indexOf(BUILD_OPEN);
  const close = template.indexOf(BUILD_CLOSE);
  if (open === -1 || close === -1 || close < open) {
    throw new Error(`could not find ${BUILD_OPEN} ... ${BUILD_CLOSE} markers in store.html`);
  }
  const before = template.slice(0, open + BUILD_OPEN.length);
  const after = template.slice(close);
  const result = `${before}\n${itemsHtml}\n  ${after}`;

  await writeFile(STORE_HTML, result);
  console.log(`[build-store] wrote ${products.length} products to store.html`);
}

async function fetchProducts(stripe) {
  const all = [];
  let starting_after;
  for (;;) {
    const page = await stripe.products.list({
      active: true,
      limit: 100,
      expand: ['data.default_price'],
      ...(starting_after ? { starting_after } : {}),
    });
    all.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }

  const priced = all.filter((p) => p.default_price && typeof p.default_price === 'object');

  for (const product of priced) {
    if (isInquireOnly(product)) continue;
    const priceId = product.default_price.id;
    const cachedLink = product.metadata.payment_link;
    const cachedPriceId = product.metadata.payment_link_price;
    if (cachedLink && cachedPriceId === priceId) continue;

    const link = await stripe.paymentLinks.create({
      line_items: [{ price: priceId, quantity: 1 }],
      after_completion: { type: 'redirect', redirect: { url: SUCCESS_URL } },
      shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
    });

    await stripe.products.update(product.id, {
      metadata: {
        ...product.metadata,
        payment_link: link.url,
        payment_link_price: priceId,
      },
    });
    product.metadata.payment_link = link.url;
    product.metadata.payment_link_price = priceId;
    console.log(`[build-store] created payment link for ${product.name}`);
  }

  priced.sort((a, b) => {
    const ao = parseInt(a.metadata.order ?? '999', 10);
    const bo = parseInt(b.metadata.order ?? '999', 10);
    if (ao !== bo) return ao - bo;
    return b.created - a.created;
  });

  return priced;
}

async function processImages(products) {
  // download + optimize each image in parallel; attach local paths to product
  const tasks = [];
  for (const product of products) {
    product._localImages = [];
    const images = (product.images || []).slice(0, 8);
    for (let i = 0; i < images.length; i++) {
      const sourceUrl = images[i];
      const localPath = `/store_assets/${product.id}/${i}.webp`;
      const fsPath = `${ASSETS_DIR}/${product.id}/${i}.webp`;
      tasks.push(
        optimizeImage(sourceUrl, fsPath)
          .then(() => { product._localImages[i] = localPath; })
          .catch((err) => {
            console.warn(`[build-store] image ${i} of "${product.name}" failed (${err.message}); using stripe url`);
            product._localImages[i] = sourceUrl;
          })
      );
    }
  }
  await Promise.all(tasks);
  const total = products.reduce((n, p) => n + (p._localImages?.length || 0), 0);
  console.log(`[build-store] processed ${total} images`);
}

async function optimizeImage(url, fsPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());
  const output = await sharp(input)
    .rotate() // honor EXIF orientation
    .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: IMAGE_QUALITY })
    .toBuffer();
  await mkdir(dirname(fsPath), { recursive: true });
  await writeFile(fsPath, output);
}

function isInquireOnly(product) {
  return product.metadata.inquire_only === 'true';
}

function renderProduct(product) {
  const inquire = isInquireOnly(product);
  const size = product.metadata.size?.trim();
  const images = product._localImages || [];

  const galleryImgs = images.length === 0
    ? '      <!-- no images -->'
    : images
        .map((url, i) =>
          i === 0
            ? `      <img src="${escapeAttr(url)}" alt="" class="active" loading="lazy" decoding="async">`
            : `      <img data-src="${escapeAttr(url)}" alt="" loading="lazy" decoding="async">`)
        .join('\n');

  const action = inquire
    ? `      <a href="mailto:store@pharmaceutical.audio?subject=${encodeURIComponent('inquiry: ' + product.name)}">inquire →</a>`
    : `      <a href="${escapeAttr(product.metadata.payment_link)}">buy →</a>`;

  const sizeLine = size ? `      <span>size ${escapeHtml(size)}</span>\n` : '';

  return `  <div class="item">
    <div class="gallery">
${galleryImgs}
    </div>
    <div class="gallery-nav">
      <a class="prev">← prev</a>
      <a class="next">next →</a>
    </div>
    <div class="item-meta">
      <span>${escapeHtml(product.name)}</span>
${sizeLine}${action}
    </div>
  </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function escapeAttr(str) {
  return escapeHtml(str);
}

main().catch((err) => {
  console.error('[build-store] fatal:', err);
  process.exit(1);
});

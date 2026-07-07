export function extractPrice(): number | undefined {
  const ldScript = document.querySelector('script[type="application/ld+json"]');
  if (ldScript) {
    try {
      const data = JSON.parse(ldScript.textContent || '');
      const walk = (obj: unknown): number | undefined => {
        if (!obj || typeof obj !== 'object') return undefined;
        const o = obj as Record<string, unknown>;
        if (typeof o.price === 'number') return o.price;
        if (typeof o.price === 'string') return parseFloat(o.price);
        if (o.offers) return walk(o.offers);
        if (Array.isArray(o.offers)) return walk(o.offers[0]);
        for (const v of Object.values(o)) {
          const r = walk(v);
          if (r !== undefined) return r;
        }
        return undefined;
      };
      const price = walk(data);
      if (price !== undefined && !isNaN(price)) return price;
    } catch { /* ignore */ }
  }

  const meta = document.querySelector(
    '[property="product:price:amount"], [itemprop="price"], [name="twitter:data1"]',
  );
  if (meta) {
    const val = meta.getAttribute('content') || meta.textContent || '';
    const num = parseFloat(val.replace(/[^0-9.]/g, ''));
    if (!isNaN(num)) return num;
  }

  const selectors = [
    '.price', '.product-price', '[data-price]', '.sale-price',
    '.our-price', '.offer-price', '.price-value', '.final-price',
    '[class*="price"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) {
      const text = el.textContent?.replace(/[^0-9.]/g, '') || '';
      const num = parseFloat(text);
      if (!isNaN(num) && num > 0) return num;
    }
  }

  return undefined;
}

export function setupPriceExtractor() {
  chrome.runtime.onMessage.addListener((msg: any, _sender: chrome.runtime.MessageSender, sendResponse: (data: any) => void) => {
    if (msg.type === 'EXTRACT_PRODUCT_DATA') {
      sendResponse({
        imageUrl: msg.imageUrl,
        price: extractPrice(),
        pageUrl: window.location.href,
      });
    }
  });
}

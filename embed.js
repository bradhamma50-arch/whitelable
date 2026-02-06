
/**
 * White-Label Virtual Try-On Embed Script
 * v2.0 - Enterprise MVP Edition
 */
(function() {
  const currentScript = document.currentScript;
  const SITE_TOKEN = currentScript ? currentScript.getAttribute('data-token') : 'ENTERPRISE_DEFAULT';
  const ENGINE_URL = currentScript?.src ? new URL(currentScript.src).origin : window.location.origin;
  
  const CONFIG = {
    buttonClass: 'vto-try-on-btn',
    modalId: 'vto-modal-overlay',
    // Comprehensive high-confidence selectors for Shopify, WooCommerce, Wix, custom
    imageSelectors: [
      '.product-single__photo img',
      '.product__media img',
      '.woocommerce-product-gallery__image img',
      '.product-image img',
      '.main-image',
      'img[itemprop="image"]',
      'img[data-main-image]',
      'img.product-image-photo',
      '.gallery-item img',
      '#main-image',
      '.product-photo img',
      '.gallery__main-image',
      '#featured-image'
    ],
    ignoreSelectors: [
      'header img', 'footer img', '.logo img', '.thumbnail img', '.icon img', '.banner img', 'nav img', '.related-products img', '.cart img'
    ],
    srcAttrs: ['data-zoom', 'data-src', 'data-high-res', 'data-original-src', 'data-master', 'src'],
    minSize: 320 
  };

  function init() {
    scan();
    observe();
    listen();
  }

  function scan() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (isLikelyMainProduct(img) && !img.dataset.vtoProcessed) {
        injectButton(img);
      }
    });
  }

  function isLikelyMainProduct(img) {
    const rect = img.getBoundingClientRect();
    if (rect.width < CONFIG.minSize || rect.height < CONFIG.minSize) return false;

    // Reject UI noise
    const isIgnored = CONFIG.ignoreSelectors.some(sel => img.closest(sel));
    if (isIgnored) return false;

    // Matches standard gallery patterns
    const matches = CONFIG.imageSelectors.some(sel => img.matches(sel));
    const inProductWrapper = img.closest('.product, .product-item, .product-detail, [itemtype*="Product"], .product-container, #product-info');
    
    return matches || (inProductWrapper && rect.width > 350); 
  }

  function getHighResSrc(img) {
    for (const attr of CONFIG.srcAttrs) {
      const val = img.getAttribute(attr);
      if (val && (val.startsWith('http') || val.startsWith('//'))) {
          return val.startsWith('//') ? 'https:' + val : val;
      }
    }
    return img.src;
  }

  function injectButton(img) {
    img.dataset.vtoProcessed = "true";
    const btn = document.createElement('button');
    btn.innerText = 'Try On';
    btn.className = CONFIG.buttonClass;
    
    // Industrial grade white-label styling
    Object.assign(btn.style, {
      display: 'block',
      width: '100%',
      maxWidth: '320px',
      margin: '20px auto',
      padding: '18px 0',
      backgroundColor: '#000',
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: '0.3em',
      textAlign: 'center',
      transition: 'all 0.4s cubic-bezier(0.19, 1, 0.22, 1)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });

    btn.onmouseover = () => { 
        btn.style.backgroundColor = '#222'; 
        btn.style.transform = 'translateY(-2px)'; 
        btn.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
    };
    btn.onmouseout = () => { 
        btn.style.backgroundColor = '#000'; 
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = 'none';
    };

    btn.onclick = (e) => {
      e.preventDefault();
      openMirror(getHighResSrc(img));
    };

    const container = img.closest('.product-gallery, .product-image-container, .product__media-wrapper, .product-images, .gallery-wrap') || img;
    container.insertAdjacentElement('afterend', btn);
  }

  function openMirror(imgUrl) {
    if (document.getElementById(CONFIG.modalId)) return;
    const overlay = document.createElement('div');
    overlay.id = CONFIG.modalId;
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      backgroundColor: '#fff', zIndex: '2147483647', display: 'flex', flexDirection: 'column',
      animation: 'vtoEnter 0.6s cubic-bezier(0.19, 1, 0.22, 1)'
    });

    const style = document.createElement('style');
    style.textContent = `@keyframes vtoEnter { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
    document.head.appendChild(style);

    const close = document.createElement('button');
    close.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    Object.assign(close.style, {
      position: 'absolute', top: '25px', right: '35px', background: 'none', border: 'none', cursor: 'pointer', zIndex: '10'
    });
    close.onclick = () => overlay.remove();

    const iframe = document.createElement('iframe');
    const u = new URL(ENGINE_URL);
    u.searchParams.set('productImage', imgUrl);
    u.searchParams.set('token', SITE_TOKEN);
    iframe.src = u.toString();
    Object.assign(iframe.style, { width: '100%', height: '100%', border: 'none' });
    
    overlay.appendChild(close);
    overlay.appendChild(iframe);
    document.body.appendChild(overlay);
  }

  function observe() {
    new MutationObserver(() => scan()).observe(document.body, { childList: true, subtree: true });
  }

  function listen() {
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'VTO_FETCH_PRODUCT') {
        const productImg = findMainProductImage();
        if (productImg) {
          e.source.postMessage({ type: 'VTO_SET_PRODUCT_IMAGE', url: getHighResSrc(productImg) }, '*');
        }
      }
    });
  }

  function findMainProductImage() {
    for (const sel of CONFIG.imageSelectors) {
      const img = document.querySelector(sel);
      if (img && isLikelyMainProduct(img)) return img;
    }
    // Deep fallback search
    const all = Array.from(document.querySelectorAll('img')).filter(isLikelyMainProduct);
    return all.length > 0 ? all[0] : null;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

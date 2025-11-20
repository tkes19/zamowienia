import { EMBEDDED_FONTS } from '../assets/fonts/embedded-fonts.js';

// Wszystkie zapytania produktowe idą na ten sam origin (proxy /api/v1/products w backend/server.js)
const API_BASE = '/api/v1/products';

const GALLERY_API_BASE = (() => {
  const isGalleryLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const defaultBase = isGalleryLocal
    ? 'http://192.168.0.30:81/home'
    : 'https://rezon.myqnapcloud.com:81/home';
  return window.__GALLERY_API_BASE__ ?? defaultBase;
})();

let galleryFilesCache = [];

// Inicjalizacja elementów DOM
const resultsBody = document.getElementById('results-body');
const cartBody = document.getElementById('cart-body');
const cartTotal = document.querySelector('#cart-total');
const clearCartBtn = document.getElementById('clear-cart');
const exportBtn = document.getElementById('export-json');
const statusMessage = document.getElementById('status-message');
const downloadLink = document.getElementById('download-link');
const galleryCitySelect = document.getElementById('gallery-city');
const galleryProductSelect = document.getElementById('gallery-product');
const galleryPreviewImage = document.getElementById('gallery-preview-image');
const galleryPreviewPlaceholder = document.getElementById('gallery-preview-placeholder');
const galleryErrors = document.getElementById('gallery-errors');
const galleryLockCheckbox = document.getElementById('gallery-lock-product');

const EMBEDDED_FONTS_STATE = {
  'NotoSans-Regular.ttf': (EMBEDDED_FONTS && EMBEDDED_FONTS['NotoSans-Regular.ttf']) || null,
  'NotoSans-Bold.ttf': (EMBEDDED_FONTS && EMBEDDED_FONTS['NotoSans-Bold.ttf']) || null,
};

const normalizeBase64 = (value) => (typeof value === 'string' ? value.replace(/\s+/g, '') : null);

function arrayBufferToBase64(buffer) {
  if (!buffer) return null;

  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer ?? buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  if (typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(binary, 'binary').toString('base64');
  }

  return null;
}

async function fetchGalleryJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}${text ? ` – ${text}` : ''}`);
  }
  return response.json();
}

function formatGalleryProductLabel(slug = '') {
  return slug.replace(/_/g, ' ').toUpperCase();
}

async function loadGalleryCities() {
  if (!galleryCitySelect) return;
  try {
    galleryCitySelect.disabled = true;
    galleryCitySelect.innerHTML = '<option value="">Ładowanie…</option>';
    const data = await fetchGalleryJSON(`${GALLERY_API_BASE}/list_cities.php`);
    const visibleCities = Array.isArray(data.cities)
      ? data.cities.filter((name) => !/^\d+\./.test((name ?? '').trim()))
      : [];
    if (!visibleCities.length) {
      galleryCitySelect.innerHTML = '<option value="">Brak danych</option>';
      setGalleryPlaceholder('Brak dostępnych miejscowości.');
      return;
    }
    galleryCitySelect.innerHTML = visibleCities
      .map((city) => `<option value="${city}">${city}</option>`)
      .join('');
    galleryCitySelect.disabled = false;
    await loadGalleryProducts(visibleCities[0]);
  } catch (error) {
    console.error('Nie udało się pobrać listy miast:', error);
    galleryCitySelect.innerHTML = '<option value="">Błąd ładowania</option>';
    setGalleryPlaceholder('Nie udało się pobrać danych.');
    setGalleryError('Nie udało się pobrać listy miejscowości.');
  }
}

async function loadGalleryProducts(city) {
  if (!galleryProductSelect) return;
  const targetCity = city ?? galleryCitySelect?.value;
  if (!targetCity) {
    galleryProductSelect.innerHTML = '<option value="">Wybierz miejscowość</option>';
    galleryProductSelect.disabled = true;
    setGalleryPlaceholder('Wybierz miejscowość, aby zobaczyć produkty.');
    return;
  }

  try {
    const lockedSlug = galleryLockCheckbox?.checked ? galleryProductSelect?.value || '' : '';
    galleryProductSelect.disabled = true;
    galleryProductSelect.innerHTML = '<option value="">Ładowanie…</option>';
    const data = await fetchGalleryJSON(`${GALLERY_API_BASE}/list_products.php?city=${encodeURIComponent(targetCity)}`);
    galleryFilesCache = Array.isArray(data.files) ? data.files : [];
    const products = Array.isArray(data.products) ? data.products : [];
    const productOptions = ['<option value="">Wszystkie produkty</option>',
      ...products.map((slug) => `<option value="${slug}">${formatGalleryProductLabel(slug)}</option>`),
    ];
    galleryProductSelect.innerHTML = productOptions.join('');

    // jeśli blokada włączona i dany produkt istnieje w nowej miejscowości – przywróć go
    if (lockedSlug && products.includes(lockedSlug)) {
      galleryProductSelect.value = lockedSlug;
    }
    galleryProductSelect.disabled = false;
    setGalleryError(null);
    if (Array.isArray(data.errors) && data.errors.length) {
      setGalleryError(`Błędne pliki: ${data.errors.map((e) => e.file).join(', ')}`);
    }
    renderGalleryPreview();
  } catch (error) {
    console.error('Nie udało się pobrać produktów:', error);
    galleryProductSelect.innerHTML = '<option value="">Błąd ładowania</option>';
    galleryProductSelect.disabled = true;
    galleryFilesCache = [];
    setGalleryPlaceholder('Nie udało się pobrać produktów.');
    setGalleryError('Nie udało się pobrać listy produktów.');
  }
}

function renderGalleryPreview() {
  if (!galleryProductSelect) return;
  const slug = galleryProductSelect.value;
  const shown = slug ? galleryFilesCache.filter((file) => file.product === slug) : galleryFilesCache;
  if (!shown.length) {
    setGalleryPlaceholder(slug ? 'Brak obrazków dla wybranego produktu.' : 'Wybierz produkt, aby zobaczyć grafikę.');
    return;
  }
  showGalleryImage(shown[0]?.url, formatGalleryProductLabel(shown[0]?.product));
}

const PDF_FONTS = [
  {
    file: 'NotoSans-Regular.ttf',
    name: 'NotoSans',
    style: 'normal',
    url: 'assets/fonts/NotoSans-Regular.ttf'
  },
  {
    file: 'NotoSans-Bold.ttf',
    name: 'NotoSans',
    style: 'bold',
    url: 'assets/fonts/NotoSans-Bold.ttf'
  }
];

function sanitizeProjectsValue(value) {
  if (!value) return '';

  return value
    .split(',')
    .map(segment => segment.trim())
    .filter(Boolean)
    .map(segment => {
      if (segment.includes('-')) {
        const [start, end] = segment.split('-').map(num => num.trim());
        if (!start || !end) {
          return '';
        }
        return `${start}-${end}`;
      }
      return segment;
    })
    .filter(Boolean)
    .join(', ');
}

let pdfFontsPromise = null;

async function loadPdfFonts() {
  if (!pdfFontsPromise) {
    pdfFontsPromise = (async () => {
      const fontData = new Map();
      for (const font of PDF_FONTS) {
        const embeddedData = EMBEDDED_FONTS_STATE[font.file];
        if (typeof embeddedData === 'string' && embeddedData.length) {
          fontData.set(font.file, embeddedData);
          continue;
        }

        try {
          const response = await fetch(font.url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const buffer = await response.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          if (typeof base64 === 'string' && base64.length) {
            EMBEDDED_FONTS_STATE[font.file] = base64;
          }
          fontData.set(font.file, base64);
        } catch (error) {
          console.warn(`Nie udało się pobrać czcionki ${font.file}:`, error);
          fontData.set(font.file, null);
        }
      }

      return fontData;
    })();
  }

  return pdfFontsPromise;
}

let pdfFontDataPromise = null;

async function loadPdfFontData() {
  if (!pdfFontDataPromise) {
    pdfFontDataPromise = loadPdfFonts();
  }

  return pdfFontDataPromise;
}

async function ensurePdfFonts(doc) {
  const fontData = await loadPdfFontData();
  const fontList = doc.getFontList?.() ?? {};
  console.groupCollapsed('[PDF] Sprawdzanie czcionek');
  console.log('[PDF] Wstępnie dostępne rodziny:', fontList);
  for (const { file, name, style } of PDF_FONTS) {
    const hasFamily = Object.prototype.hasOwnProperty.call(fontList, name);
    const hasStyle = hasFamily && Object.prototype.hasOwnProperty.call(fontList[name], style);

    if (hasStyle) {
      console.log(`[PDF] Czcionka już dostępna: ${name} (${style})`);
      continue;
    }

    const data = fontData instanceof Map ? fontData.get(file) : undefined;
    if (typeof data === 'string' && data.length) {
      console.log(`[PDF] Dodawanie czcionki ${name} (${style}) z pliku ${file}. Długość base64:`, data.length);
      doc.addFileToVFS(file, data);
      try {
        doc.addFont(file, name, style, 'Identity-H');
        console.log(`[PDF] Dodano do VFS i zarejestrowano ${name}/${style} z kodowaniem Identity-H.`);
      } catch (error) {
        console.error(`[PDF] Błąd podczas rejestracji fontu ${name}/${style}:`, error);
      }
    } else {
      console.warn(`[PDF] Brak danych base64 dla ${file}.`, { hasEmbedded: Boolean(data), availableFonts: fontData });
    }
  }

  const updatedFontList = doc.getFontList?.() ?? {};
  const allLoaded = PDF_FONTS.every(({ name, style }) =>
    Object.prototype.hasOwnProperty.call(updatedFontList, name) &&
    Object.prototype.hasOwnProperty.call(updatedFontList[name], style)
  );
  console.log('[PDF] Zaktualizowana lista czcionek:', updatedFontList);
  console.log('[PDF] Czy wszystkie style dostępne?', allLoaded);
  console.groupEnd();
  return allLoaded;
}

const cart = new Map();

function formatCurrency(value) {
  return `${Number(value ?? 0).toFixed(2)} zł`;
}

function formatCurrencyPlain(value) {
  return Number(value ?? 0)
    .toFixed(2)
    .replace('.', ',') + ' zł';
}

function safeSplitText(doc, text, maxWidth) {
  if (!text) return [];
  const rawLines = doc.splitTextToSize(text, maxWidth) || [];
  return rawLines.map(line => line.replace(/[&]/g, ' ').trim()).filter(Boolean);
}

function setStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status status--${type}`;
}

function setGalleryError(message) {
  if (!galleryErrors) return;
  if (!message) {
    galleryErrors.hidden = true;
    galleryErrors.textContent = '';
    return;
  }
  galleryErrors.hidden = false;
  galleryErrors.textContent = message;
}

function setGalleryPlaceholder(text) {
  if (galleryPreviewPlaceholder) {
    galleryPreviewPlaceholder.textContent = text;
    galleryPreviewPlaceholder.hidden = false;
  }
  if (galleryPreviewImage) {
    galleryPreviewImage.hidden = true;
    galleryPreviewImage.removeAttribute('src');
    galleryPreviewImage.style.transform = '';
  }
}

function showGalleryImage(src, alt) {
  if (!galleryPreviewImage || !galleryPreviewPlaceholder) return;
  if (!src) {
    setGalleryPlaceholder('Brak obrazka dla wybranego produktu.');
    return;
  }
  galleryPreviewPlaceholder.hidden = true;
  galleryPreviewImage.hidden = false;
  galleryPreviewImage.alt = alt ?? 'Podgląd produktu';
  galleryPreviewImage.src = src;

  const frame = galleryPreviewImage.parentElement;
  if (frame && frame.classList.contains('gallery-preview__frame')) {
    initGalleryZoom(frame, galleryPreviewImage);
  }
}

function initGalleryZoom(frame, img) {
  const minScale = 1;
  const maxScale = 4;
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let startX = 0;
  let startY = 0;
  let isPanning = false;
  let zoomEnabled = false;

  if (frame.dataset.zoomInitialized === 'true') {
    return;
  }
  frame.dataset.zoomInitialized = 'true';

  const applyTransform = () => {
    img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    if (!zoomEnabled || scale === minScale) {
      frame.style.cursor = 'zoom-in';
    } else {
      frame.style.cursor = isPanning ? 'grabbing' : 'grab';
    }
  };

  const clampPan = () => {
    const frameRect = frame.getBoundingClientRect();
    const imgRectWidth = frameRect.width * scale;
    const imgRectHeight = frameRect.height * scale;

    const minX = Math.min(0, frameRect.width - imgRectWidth);
    const minY = Math.min(0, frameRect.height - imgRectHeight);

    panX = Math.min(0, Math.max(minX, panX));
    panY = Math.min(0, Math.max(minY, panY));
  };

  const onWheel = (event) => {
    if (!zoomEnabled) return; // pozwól normalnie przewijać stronę, gdy zoom nieaktywny
    event.preventDefault();
    const rect = frame.getBoundingClientRect();
    const offsetX = (event.clientX - rect.left - panX) / scale;
    const offsetY = (event.clientY - rect.top - panY) / scale;
    const zoomFactor = event.deltaY < 0 ? 1.15 : 0.85;

    const newScale = Math.min(maxScale, Math.max(minScale, scale * zoomFactor));
    if (newScale === scale) return;

    scale = newScale;
    panX = event.clientX - rect.left - offsetX * scale;
    panY = event.clientY - rect.top - offsetY * scale;
    clampPan();
    applyTransform();
  };

  const onPointerDown = (event) => {
    if (!zoomEnabled || scale === minScale) return;

    if (event.button === 0) {
      isPanning = true;
      startX = event.clientX - panX;
      startY = event.clientY - panY;
      frame.setPointerCapture(event.pointerId);
      event.preventDefault();
      applyTransform();
    }
  };

  const onPointerMove = (event) => {
    if (!isPanning) return;
    panX = event.clientX - startX;
    panY = event.clientY - startY;
    clampPan();
    applyTransform();
  };

  const endPan = () => {
    if (!isPanning) return;
    isPanning = false;
    applyTransform();
  };

  const onDblClick = (event) => {
    event.preventDefault();
    zoomEnabled = !zoomEnabled;

    if (!zoomEnabled) {
      // Wyłączenie zoomu – reset do domyślnego widoku
      scale = 1;
      panX = 0;
      panY = 0;
    }

    applyTransform();
  };

  const onContextMenu = (event) => {
    event.preventDefault();
  };

  frame.addEventListener('wheel', onWheel, { passive: false });
  frame.addEventListener('pointerdown', onPointerDown);
  frame.addEventListener('pointermove', onPointerMove);
  frame.addEventListener('pointerup', endPan);
  frame.addEventListener('pointercancel', endPan);
  frame.addEventListener('pointerleave', endPan);
  frame.addEventListener('dblclick', onDblClick);
  frame.addEventListener('contextmenu', onContextMenu);

  applyTransform();
}

function resetResultsPlaceholder(text = 'Brak wyników do wyświetlenia.') {
  resultsBody.innerHTML = `
    <tr class="table__placeholder">
      <td colspan="6">${text}</td>
    </tr>
  `;
}

function resetCartPlaceholder() {
  cartBody.innerHTML = `
    <tr class="table__placeholder">
      <td colspan="6">Koszyk jest pusty.</td>
    </tr>
  `;
}

function normalizeForMatching(value) {
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/[\u0300-\u036f]+/g, '')
    .replace(/[^0-9a-z]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenizeQuery(value) {
  const normalized = normalizeForMatching(value);
  return normalized ? normalized.split(' ') : [];
}

function buildSearchCorpus(product) {
  return normalizeForMatching(
    [
      product.name,
      product.slug,
      product.category,
      product.pc_id,
      product.description,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function getFieldTokens(value) {
  const normalized = normalizeForMatching(value);
  return normalized ? normalized.split(' ') : [];
}

function matchesTermsInField(value, terms, options = {}) {
  const { matchMode = 'prefix', tokens } = options;
  if (!value || !terms.length) {
    return false;
  }

  const fieldTokens = Array.isArray(tokens) ? tokens : getFieldTokens(value);
  if (!fieldTokens.length) {
    return false;
  }

  return terms.every(term =>
    fieldTokens.some(token =>
      matchMode === 'any' ? token.includes(term) : token.startsWith(term)
    )
  );
}

async function fetchProducts(searchQuery) {
  const trimmedQuery = typeof searchQuery === 'string' ? searchQuery.trim() : '';
  const url = trimmedQuery
    ? `${API_BASE}?search=${encodeURIComponent(trimmedQuery)}`
    : API_BASE;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Błąd serwera: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const rawProducts = Array.isArray(json)
    ? json
    : (json.data?.products || json.products || json.data || []);

  return Array.isArray(rawProducts) ? rawProducts : [];
}

async function searchProducts(event) {
  event.preventDefault();
  const mode = document.querySelector('#mode').value;
  const query = document.querySelector('#query').value.trim();

  if (!query) {
    setStatus('Podaj frazę wyszukiwania.', 'error');
    return;
  }

  setStatus('Wyszukiwanie produktów...', 'info');
  resetResultsPlaceholder('Trwa pobieranie danych...');

  try {
    const searchTerms = tokenizeQuery(query);

    if (!searchTerms.length) {
      setStatus('Nieprawidłowe zapytanie wyszukiwania.', 'error');
      return;
    }

    let products = await fetchProducts(query);

    if (!products.length && searchTerms.length > 1) {
      products = await fetchProducts();
    }

    const filteredProducts = products.filter(product => {
      if (!product) return false;

      const idTokens = getFieldTokens(product.pc_id);
      const nameTokens = getFieldTokens(product.name);

      const targetTokens = mode === 'pc_id' ? idTokens : nameTokens;
      if (matchesTermsInField(mode === 'pc_id' ? product.pc_id : product.name, searchTerms, { tokens: targetTokens })) {
        return true;
      }

      // Jeśli szukamy po identyfikatorze, pozwólmy na dopasowanie do nazw i odwrotnie
      const fallbackTokens = mode === 'pc_id' ? nameTokens : idTokens;
      return matchesTermsInField(mode === 'pc_id' ? product.name : product.pc_id, searchTerms, {
        tokens: fallbackTokens,
      });
    });

    if (!filteredProducts.length) {
      setStatus('Brak produktów spełniających kryteria wyszukiwania.', 'info');
      resetResultsPlaceholder('Brak wyników. Zmień frazę lub tryb wyszukiwania.');
      return;
    }

    renderResults(filteredProducts);
    setStatus(`Znaleziono ${filteredProducts.length} produkt(y).`, 'success');
  } catch (error) {
    console.error('Błąd wyszukiwania produktów:', error);
    setStatus(`Błąd pobierania danych: ${error.message}`, 'error');
    resetResultsPlaceholder('Nie udało się pobrać danych. Spróbuj ponownie.');
  }
}

function createBadge(stock = 0, optimal = 0) {
  if (stock <= 0) return '<span class="badge badge--zero">Brak na stanie</span>';
  if (optimal && stock < optimal * 0.25) return '<span class="badge badge--low">Niski stan</span>';
  return `<span class="badge">${stock} szt.</span>`;
}

function renderResults(products) {
  resultsBody.innerHTML = '';
  products.forEach(product => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="product-identifiers">
        <div class="product-name">${product.name ?? '-'}</div>
        <div class="product-id">${product.pc_id || ''}</div>
      </td>
      <td>
        <input
          type="text"
          class="projects-input"
          placeholder="np. 1-5,7"
          inputmode="numeric"
          pattern="[0-9,\-\s]*"
        />
      </td>
      <td class="price-column">${formatCurrency(product.price)}</td>
      <td>${createBadge(product.stock, product.stock_optimal)}</td>
      <td>
        <input
          type="number"
          class="qty-input"
          value="1"
          min="1"
          ${product.stock > 0 ? '' : 'disabled'}
        />
      </td>
      <td>
        <button type="button" class="btn btn--primary" ${product.stock > 0 ? '' : 'disabled'}>
          Dodaj
        </button>
      </td>
    `;

    const projectsInput = row.querySelector('.projects-input');
    const qtyInput = row.querySelector('.qty-input');
    const addBtn = row.querySelector('button');

    projectsInput.addEventListener('input', () => {
      projectsInput.value = projectsInput.value.replace(/[^0-9,\-\s]/g, '');
    });

    projectsInput.addEventListener('blur', () => {
      const value = projectsInput.value.trim();
      if (!value) {
        projectsInput.value = '';
        return;
      }

      if (!isValidProjectInput(value)) {
        alert('Podaj poprawny zakres: np. 1-5,7. Użyj tylko liczb, przecinków i myślników.');
        projectsInput.focus();
        return;
      }

      projectsInput.value = sanitizeProjectsValue(value);
    });

    addBtn.addEventListener('click', () => {
      const value = parseInt(qtyInput.value, 10);
      const quantity = Number.isFinite(value) && value > 0 ? value : 1;
      const projectsValue = projectsInput.value.trim();

      if (projectsValue && !isValidProjectInput(projectsValue)) {
        alert('Podaj poprawny zakres: np. 1-5,7. Użyj tylko liczb, przecinków i myślników.');
        projectsInput.focus();
        return;
      }

      const normalizedProjects = sanitizeProjectsValue(projectsValue);
      addToCart(product, quantity, normalizedProjects);
    });

    resultsBody.appendChild(row);
  });
}

function addToCart(product, quantity, projects) {
  const stock = product.stock ?? 0;
  if (stock <= 0) {
    setStatus(`Produkt ${product.name} jest niedostępny.`, 'error');
    return;
  }

  const key = product._id;
  const entry = cart.get(key);
  const newQty = Math.min((entry?.quantity ?? 0) + quantity, stock);

  const sanitizedProjects = sanitizeProjectsValue(projects);
  const currentProjects = sanitizedProjects || entry?.projects || '';

  cart.set(key, { product, quantity: newQty, projects: currentProjects });
  renderCart();
  setStatus(`Dodano produkt ${product.name} do koszyka.`, 'success');
}

function isValidProjectInput(value) {
  if (!value) return true;

  const pattern = /^\s*\d+(\s*-\s*\d+)?\s*(,\s*\d+(\s*-\s*\d+)?\s*)*$/;
  if (!pattern.test(value)) {
    return false;
  }

  const segments = value.split(',').map(segment => segment.trim());

  return segments.every(segment => {
    if (segment.includes('-')) {
      const [start, end] = segment.split('-').map(num => Number(num.trim()));
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        return false;
      }
      return start > 0 && end > 0 && start <= end;
    }

    const num = Number(segment);
    return Number.isInteger(num) && num > 0;
  });
}

function renderCart() {
  cartBody.innerHTML = '';

  if (!cart.size) {
    resetCartPlaceholder();
    if (cartTotal) {
      cartTotal.textContent = formatCurrency(0);
    }
    return;
  }

  let total = 0;
  const rows = Array.from(cart.entries()).map(([id, { product, quantity, projects = '' }]) => {
    const price = Number(product.price ?? 0);
    const lineTotal = price * quantity;
    total += lineTotal;

    return `
      <tr data-id="${id}">
        <td class="product-identifiers">
          <div class="product-name">${product.name ?? '-'}</div>
          <div class="product-id">${product.pc_id || ''}</div>
        </td>
        <td>
          <input
            type="text"
            class="projects-input"
            value="${projects}"
            placeholder="np. 1-5,7"
            data-id="${id}"
            inputmode="numeric"
            pattern="[0-9,\-\s]*"
          />
        </td>
        <td>
          <input
            type="number"
            class="qty-input"
            value="${quantity}"
            min="1"
            data-id="${id}"
          />
        </td>
        <td class="price-cell">${formatCurrency(price)}</td>
        <td class="price-cell">${formatCurrency(lineTotal)}</td>
        <td>
          <button type="button" class="btn btn--danger remove-from-cart" data-id="${id}">
            Usuń
          </button>
        </td>
      </tr>
    `;
  });

  cartBody.innerHTML = rows.join('');

  const qtyInputs = cartBody.querySelectorAll('.qty-input');
  const projectsInputs = cartBody.querySelectorAll('.projects-input');
  const removeBtns = cartBody.querySelectorAll('.remove-from-cart');

  qtyInputs.forEach(qtyInput => {
    qtyInput.addEventListener('input', () => {
      const id = qtyInput.dataset.id;
      const value = parseInt(qtyInput.value, 10);
      const entry = cart.get(id);
      const stock = entry?.product?.stock ?? Infinity;

      if (!Number.isFinite(value) || value < 1) {
        alert('Podaj dodatnią liczbę sztuk.');
        qtyInput.value = entry?.quantity ?? 1;
        return;
      }

      if (value > stock) {
        alert(`Maksymalna ilość: ${stock} szt.`);
        qtyInput.value = stock;
        return;
      }

      cart.set(id, { product: entry.product, quantity: value, projects: entry.projects ?? '' });
      renderCart();
    });
  });

  projectsInputs.forEach(projectsInput => {
    projectsInput.addEventListener('input', () => {
      projectsInput.value = projectsInput.value.replace(/[^0-9,\-\s]/g, '');
    });

    projectsInput.addEventListener('blur', () => {
      const id = projectsInput.dataset.id;
      const entry = cart.get(id);
      const value = projectsInput.value.trim();

      if (!entry) return;

      if (!value) {
        cart.set(id, { product: entry.product, quantity: entry.quantity, projects: '' });
        projectsInput.value = '';
        return;
      }

      if (!isValidProjectInput(value)) {
        alert('Podaj poprawny zakres: np. 1-5,7. Użyj tylko liczb, przecinków i myślników.');
        projectsInput.value = entry.projects ?? '';
        return;
      }

      const normalized = sanitizeProjectsValue(value);
      cart.set(id, { product: entry.product, quantity: entry.quantity, projects: normalized });
      projectsInput.value = normalized;
    });
  });

  removeBtns.forEach(removeBtn => {
    removeBtn.addEventListener('click', () => {
      cart.delete(removeBtn.dataset.id);
      renderCart();
    });
  });

  if (cartTotal) {
    cartTotal.textContent = formatCurrency(total);
  }
}

function clearCart() {
  cart.clear();
  renderCart();
  setStatus('Koszyk został wyczyszczony.', 'info');
}

function exportCart() {
  if (!cart.size) {
    alert('Koszyk jest pusty.');
    return;
  }

  const payload = Array.from(cart.values()).map(({ product, quantity, projects }) => ({
    id: product._id,
    pc_id: product.pc_id,
    name: product.name,
    price: product.price,
    quantity,
    stock: product.stock,
    stock_optimal: product.stock_optimal,
    projects,
  }));

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.click();
  URL.revokeObjectURL(url);
}

async function exportToPDF() {
  if (!cart.size) {
    setStatus('Koszyk jest pusty. Dodaj produkty przed wygenerowaniem PDF.', 'error');
    return;
  }

  const cleanText = (text) => (text === null || text === undefined ? '' : String(text));

  try {
    setStatus('Generowanie PDF...', 'info');
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const customFontLoaded = await ensurePdfFonts(doc);
    const primaryFont = customFontLoaded ? 'NotoSans' : 'helvetica';
    doc.setCharSpace?.(0);

    const setFont = (style = 'normal') => {
      doc.setFont(primaryFont, style);
    };

    const addText = (text, x, y, options = {}) => {
      const raw = text === null || text === undefined ? '' : text;
      const cleaned = cleanText(raw);
      doc.text(cleaned, x, y, options);
    };

    setFont('bold');
    
    const title = 'ZAMÓWIENIE';
    const date = new Date().toLocaleDateString('pl-PL');
    const orderNumber = new Date().getTime().toString().slice(-6);
    
    // Nagłówek
    doc.setFontSize(16);
    addText(title, 20, 20);
    
    // Informacje o zamówieniu
    setFont('normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    addText(`Data: ${date}`, 20, 30);
    addText(`Nr zamówienia: ${orderNumber}`, 20, 35);
    
    // Tytuły kolumn
    setFont('bold');
    doc.setTextColor(0, 0, 0);
    addText('Lp.', 15, 50);
    addText('Nazwa produktu', 30, 50);
    addText('Ilość', 140, 50, { align: 'right' });
    addText('Cena', 160, 50, { align: 'right' });
    addText('Wartość', 190, 50, { align: 'right' });
    
    // Linie oddzielające
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    // Linia nad tytułami
    doc.line(15, 47, 195, 47);
    // Linia pod tytułami
    doc.line(15, 52, 195, 52);
    
    // Pobierz produkty w tej samej kolejności co w koszyku
    const cartItems = Array.from(cart.entries());
    
    // Dane produktów
    const startY = 60;
    let currentY = startY;
    let total = 0;
    
    // Rysowanie listy produktów w kolejności z koszyka
    cartItems.forEach(([index, { product, quantity }], i) => {
      const productTotal = product.price * quantity;
      total += productTotal;
      
      // Nowa strona jeśli zabraknie miejsca
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }
      
      // Numer porządkowy
      setFont('normal');
      doc.setFontSize(10);
      addText((i + 1) + '.', 15, currentY);
      
      // Nazwa produktu z zawijaniem tekstu
      const maxNameWidth = 100; // Maksymalna szerokość nazwy w mm
      const lineHeight = 5; // Wysokość linii w mm
      
      // Przygotuj nazwę produktu - usuń podwójne spacje i przyciąć białe znaki
      const cleanName = (product.name || '').replace(/\s+/g, ' ').trim();
      
      // Podziel nazwę na linie, aby zmieściła się w dostępnej przestrzeni
      const nameLines = safeSplitText(doc, cleanName, maxNameWidth);
      
      // Narysuj każdą linię nazwy
      nameLines.forEach((line, lineIndex) => {
        addText(line.trim(), 30, currentY + (lineIndex * lineHeight));
      });
      
      // ID produktu (mniejszą czcionką pod nazwą)
      if (product.pc_id) {
        doc.setFontSize(8);
        setFont('normal');
        doc.setTextColor(100);
        addText(`ID: ${product.pc_id}`, 30, currentY + (nameLines.length * lineHeight) + 2);
      }

      // Ilość i ceny
      setFont('normal');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      
      // Oblicz wysokość dla wielolinijkowej nazwy produktu
      const nameHeight = nameLines.length * lineHeight + (product.pc_id ? 6 : 0);
      const contentHeight = Math.max(nameHeight, 8); // Minimalna wysokość wiersza
      
      // Wyśrodkuj ilość i ceny względem całego wiersza
      const textY = currentY + (contentHeight / 2) - 2;
      
      // Wyświetl ilość, cenę i wartość
      addText(quantity.toString(), 140, textY, { align: 'right' });
      addText(formatCurrencyPlain(product.price), 160, textY, { align: 'right' });
      addText(formatCurrencyPlain(productTotal), 190, textY, { align: 'right' });
      
      // Linia oddzielająca produkty
      doc.setDrawColor(240);
      doc.setLineWidth(0.2);
      doc.line(15, currentY + contentHeight + 2, 195, currentY + contentHeight + 2);
      
      currentY += contentHeight + 4;
    });
    
    // Suma
    setFont('bold');
    doc.setFontSize(12);
    addText('RAZEM:', 140, currentY + 10);
    addText(formatCurrencyPlain(total), 190, currentY + 10, { align: 'right' });
    
    // Linia podsumowania
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(140, currentY + 12, 195, currentY + 12);
    
    // Stopka
    doc.setFontSize(8);
    setFont('normal');
    doc.setTextColor(100);
    addText(
      `Wygenerowano: ${new Date().toLocaleString('pl-PL')} | Liczba pozycji: ${cartItems.length}`,
      105,
      287,
      { align: 'center' }
    );
    
    // Zapisanie pliku
    const fileName = `zamowienie_${date.replace(/\./g, '-')}_${orderNumber}.pdf`;
    doc.save(fileName);
    
    setStatus('Pobieranie pliku PDF...', 'success');
    
  } catch (error) {
    console.error('Błąd podczas generowania PDF:', error);
    setStatus('Wystąpił błąd podczas generowania pliku PDF: ' + error.message, 'error');
  }
}

// Inicjalizacja motywu
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
    updateThemeToggle(savedTheme);
  }
}

// Przełączanie motywu
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeToggle(newTheme);
}

// Aktualizacja ikony przycisku motywu
function updateThemeToggle(theme) {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;
  
  const moonIcon = themeToggle.querySelector('.fa-moon');
  const sunIcon = themeToggle.querySelector('.fa-sun');
  if (!moonIcon || !sunIcon) return;
  
  if (theme === 'light') {
    moonIcon.style.opacity = '0';
    moonIcon.style.transform = 'translateY(-20px)';
    sunIcon.style.opacity = '1';
    sunIcon.style.transform = 'translateY(0)';
  } else {
    moonIcon.style.opacity = '1';
    moonIcon.style.transform = 'translateY(0)';
    sunIcon.style.opacity = '0';
    sunIcon.style.transform = 'translateY(20px)';
  }
}

function togglePrices() {
  const body = document.body;
  const isHidden = body.classList.toggle('hide-prices');
  const toggleBtn = document.getElementById('toggle-price');
  if (!toggleBtn) return;
  
  if (isHidden) {
    toggleBtn.innerHTML = '<i class="fas fa-eye"></i> Pokaż ceny';
  } else {
    toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Ukryj ceny';
  }
  
  // Zapisz preferencje użytkownika
  localStorage.setItem('hidePrices', isHidden);
}

function initialize() {
  // Inicjalizacja motywu
  initTheme();
  
  resetResultsPlaceholder();
  resetCartPlaceholder();
  const searchForm = document.querySelector('#search-form');
  const exportPdfBtn = document.querySelector('#export-pdf');

  if (searchForm) {
    searchForm.addEventListener('submit', searchProducts);
  }

  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', clearCart);
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', exportCart);
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', exportToPDF);
  }
  
  // Inicjalizacja przycisku ukrywania cen
  const toggleBtn = document.getElementById('toggle-price');
  if (toggleBtn) {
    const storedPreference = localStorage.getItem('hidePrices');
    const defaultHidden = document.body.classList.contains('hide-prices');
    const hidePrices = storedPreference === null ? defaultHidden : storedPreference === 'true';

    document.body.classList.toggle('hide-prices', hidePrices);
    toggleBtn.innerHTML = hidePrices
      ? '<i class="fas fa-eye"></i> Pokaż ceny'
      : '<i class="fas fa-eye-slash"></i> Ukryj ceny';

    if (storedPreference === null) {
      localStorage.setItem('hidePrices', hidePrices);
    }

    toggleBtn.addEventListener('click', togglePrices);
  }

  if (galleryCitySelect && galleryProductSelect) {
    galleryCitySelect.addEventListener('change', () => loadGalleryProducts());
    galleryProductSelect.addEventListener('change', renderGalleryPreview);
    loadGalleryCities();
  }
}

initialize();

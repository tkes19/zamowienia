import { EMBEDDED_FONTS } from '../assets/fonts/embedded-fonts.js';

// Wszystkie zapytania produktowe idą na ten sam origin (proxy /api/v1/products w backend/server.js)
const API_BASE = '/api/v1/products';

// Proxy galerii również idzie przez backend (/api/gallery),
// dzięki czemu nie ma problemów z CORS ani certyfikatami QNAP-a.
const GALLERY_API_BASE = window.__GALLERY_API_BASE__ || '/api/gallery';

let galleryFilesCache = [];
let galleryProducts = [];
let selectedResultsRow = null;
let projectFilterMode = 'with';
let lastSearchResults = [];
let currentFormMode = 'projekty-miejscowosci';
let isCityModeInitialized = false;
let isClientsModeInitialized = false;
let cityModeProductSlug = '';
let cityModeProducts = [];
let cityModeFilesCache = [];
let clientsModeProductSlug = '';
let clientsModeProducts = [];
let clientsModeFilesCache = [];
let currentUser = null;

// Stan klienta zamówienia
let currentCustomer = null;
let pickerCustomers = [];
let pickerFilteredCustomers = [];

// Inicjalizacja elementów DOM
const resultsBody = document.getElementById('results-body');
const clientsLink = document.getElementById('clients-link');
const adminLink = document.getElementById('admin-link');
const logoutBtn = document.getElementById('logout-btn');
const cartBody = document.getElementById('cart-body');
const cartTotal = document.querySelector('#cart-total');
const clearCartBtn = document.getElementById('clear-cart');
const exportBtn = document.getElementById('export-json');
const statusMessage = document.getElementById('status-message');
const downloadLink = document.getElementById('download-link');
const formModeNav = document.getElementById('form-mode-nav');
const galleryCitySelect = document.getElementById('gallery-city');
const galleryProductSelect = document.getElementById('gallery-product');
const gallerySalespersonSelect = document.getElementById('gallery-salesperson');
const galleryObjectSelect = document.getElementById('gallery-object');
const galleryControlsCity = document.getElementById('gallery-controls-city');
const galleryControlsSales = document.getElementById('gallery-controls-sales');
const galleryPreviewImage = document.getElementById('gallery-preview-image');
const galleryPreviewPlaceholder = document.getElementById('gallery-preview-placeholder');
const galleryErrors = document.getElementById('gallery-errors');
const galleryLockCheckbox = document.getElementById('gallery-lock-product');
// Klient zamówienia
const orderCustomerNameEl = document.getElementById('order-customer-name');
const orderCustomerSearchInput = document.getElementById('order-customer-search');
const orderCustomerSelectEl = document.getElementById('order-customer-select');

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
    const data = await fetchGalleryJSON(`${GALLERY_API_BASE}/cities`);
    const visibleCities = Array.isArray(data.cities)
      ? data.cities.filter((name) => !/^\d+\./.test((name ?? '').trim()))
      : [];
    if (!visibleCities.length) {
      galleryCitySelect.innerHTML = '<option value="">Brak danych</option>';
      setGalleryPlaceholder('Brak dostępnych miejscowości.');
      galleryFilesCache = [];
      galleryProducts = [];
      updateProjectFilterAvailability();
      return;
    }
    const options = ['<option value="">Wszystkie miejscowości</option>',
      ...visibleCities.map((city) => `<option value="${city}">${city}</option>`),
    ];
    galleryCitySelect.innerHTML = options.join('');
    galleryCitySelect.disabled = false;
    galleryCitySelect.value = '';
    galleryFilesCache = [];
    galleryProducts = [];
    setGalleryPlaceholder('Wybierz miejscowość, aby zobaczyć projekty.');
    updateProjectFilterAvailability();
  } catch (error) {
    console.error('Nie udało się pobrać listy miast:', error);
    galleryCitySelect.innerHTML = '<option value="">Błąd ładowania</option>';
    setGalleryPlaceholder('Nie udało się pobrać danych.');
    setGalleryError('Nie udało się pobrać listy miejscowości.');
    galleryFilesCache = [];
    galleryProducts = [];
    updateProjectFilterAvailability();
  }
}

async function loadGalleryProductsForObject(salesperson, object) {
  if (!galleryProductSelect) return;

  const sp = salesperson ?? gallerySalespersonSelect?.value;
  const obj = object ?? galleryObjectSelect?.value;

  if (!sp || !obj) {
    galleryProductSelect.innerHTML = '<option value="">Najpierw wybierz handlowca i obiekt</option>';
    galleryProductSelect.disabled = true;
    galleryFilesCache = [];
    galleryProducts = [];
    setGalleryPlaceholder('Wybierz handlowca i obiekt, aby zobaczyć projekty.');
    updateProjectFilterAvailability();
    return;
  }

  try {
    const lockedSlug = galleryLockCheckbox?.checked ? galleryProductSelect?.value || '' : '';
    galleryProductSelect.disabled = true;
    galleryProductSelect.innerHTML = '<option value="">Ładowanie…</option>';

    const url = `${GALLERY_API_BASE}/products-object?salesperson=${encodeURIComponent(sp)}&object=${encodeURIComponent(obj)}`;
    const data = await fetchGalleryJSON(url);
    galleryFilesCache = Array.isArray(data.files) ? data.files : [];
    galleryProducts = Array.isArray(data.products) ? data.products : [];
    clientsModeFilesCache = galleryFilesCache;
    clientsModeProducts = galleryProducts;

    const baseOptions = ['<option value="">Wybierz produkt</option>',
      ...galleryProducts.map((slug) => `<option value="${slug}">${formatGalleryProductLabel(slug)}</option>`),
    ];

    let productOptions = [...baseOptions];
    let selectedSlug = '';
    let lockedMissingInObject = false;

    if (lockedSlug) {
      if (galleryProducts.includes(lockedSlug)) {
        selectedSlug = lockedSlug;
      } else {
        lockedMissingInObject = true;
        const missingLabel = `${formatGalleryProductLabel(lockedSlug)} — brak w tym obiekcie`;
        productOptions.push(`<option value="${lockedSlug}">${missingLabel}</option>`);
        selectedSlug = lockedSlug;
      }
    }

    galleryProductSelect.innerHTML = productOptions.join('');
    updateProjectFilterAvailability();

    setGalleryError(null);
    if (Array.isArray(data.errors) && data.errors.length) {
      setGalleryError(`Błędne pliki: ${data.errors.map((e) => e.file).join(', ')}`);
    }

    if (selectedSlug) {
      galleryProductSelect.value = selectedSlug;
      galleryProductSelect.disabled = false;

      if (lockedMissingInObject) {
        setGalleryPlaceholder('Brak projektu dla wybranego produktu w tym obiekcie.');
      } else {
        renderGalleryPreview();
      }
      return;
    }

    galleryProductSelect.disabled = false;
    setGalleryPlaceholder('Wybierz produkt, aby zobaczyć grafikę.');
  } catch (error) {
    console.error('Nie udało się pobrać produktów dla obiektu:', error);
    galleryProductSelect.innerHTML = '<option value="">Błąd ładowania</option>';
    galleryProductSelect.disabled = true;
    galleryFilesCache = [];
    setGalleryPlaceholder('Nie udało się pobrać produktów.');
    setGalleryError('Nie udało się pobrać listy produktów dla obiektu.');
    galleryProducts = [];
    updateProjectFilterAvailability();
  }
}

async function loadGalleryProducts(city) {
  if (!galleryProductSelect) return;
  const targetCity = city ?? galleryCitySelect?.value;
  if (!targetCity) {
    galleryProductSelect.innerHTML = '<option value="">Wybierz miejscowość</option>';
    galleryProductSelect.disabled = true;
    galleryFilesCache = [];
    galleryProducts = [];
    setGalleryPlaceholder('Wybierz miejscowość, aby zobaczyć produkty.');
    updateProjectFilterAvailability();
    return;
  }

  try {
    const lockedSlug = galleryLockCheckbox?.checked ? galleryProductSelect?.value || '' : '';
    galleryProductSelect.disabled = true;
    galleryProductSelect.innerHTML = '<option value="">Ładowanie…</option>';
    const data = await fetchGalleryJSON(`${GALLERY_API_BASE}/products/${encodeURIComponent(targetCity)}`);
    galleryFilesCache = Array.isArray(data.files) ? data.files : [];
    galleryProducts = Array.isArray(data.products) ? data.products : [];
    cityModeFilesCache = galleryFilesCache;
    cityModeProducts = galleryProducts;

    const baseOptions = ['<option value="">Wybierz produkt</option>',
      ...galleryProducts.map((slug) => `<option value="${slug}">${formatGalleryProductLabel(slug)}</option>`),
    ];

    let productOptions = [...baseOptions];
    let selectedSlug = '';
    let lockedMissingInCity = false;

    if (lockedSlug) {
      if (galleryProducts.includes(lockedSlug)) {
        selectedSlug = lockedSlug;
      } else {
        lockedMissingInCity = true;
        const missingLabel = `${formatGalleryProductLabel(lockedSlug)} — brak w tej miejscowości`;
        productOptions.push(`<option value="${lockedSlug}">${missingLabel}</option>`);
        selectedSlug = lockedSlug;
      }
    }

    galleryProductSelect.innerHTML = productOptions.join('');
    updateProjectFilterAvailability();

    setGalleryError(null);
    if (Array.isArray(data.errors) && data.errors.length) {
      setGalleryError(`Błędne pliki: ${data.errors.map((e) => e.file).join(', ')}`);
    }

    if (selectedSlug) {
      galleryProductSelect.value = selectedSlug;
      galleryProductSelect.disabled = false;

      if (lockedMissingInCity) {
        setGalleryPlaceholder('Brak projektu dla wybranego produktu w tej miejscowości.');
      } else {
        renderGalleryPreview();
      }
      return;
    }

    galleryProductSelect.disabled = false;
    // Brak jednoznacznie wybranego produktu – nie pokazujemy jeszcze podglądu.
    setGalleryPlaceholder('Wybierz produkt, aby zobaczyć grafikę.');
  } catch (error) {
    console.error('Nie udało się pobrać produktów:', error);
    galleryProductSelect.innerHTML = '<option value="">Błąd ładowania</option>';
    galleryProductSelect.disabled = true;
    galleryFilesCache = [];
    setGalleryPlaceholder('Nie udało się pobrać produktów.');
    setGalleryError('Nie udało się pobrać listy produktów.');
    galleryProducts = [];
    updateProjectFilterAvailability();
  }
}

function renderGalleryPreview() {
  if (!galleryProductSelect) return;
  const slug = galleryProductSelect.value;

  if (!slug) {
    setGalleryPlaceholder('Wybierz produkt, aby zobaczyć grafikę.');
    return;
  }

  // Spróbuj znaleźć pliki dokładnie dla danego produktu
  const shown = Array.isArray(galleryFilesCache)
    ? galleryFilesCache.filter((file) => file.product === slug)
    : [];

  // Jeśli brak dokładnego dopasowania, użyj pierwszego dostępnego pliku
  const fileToShow = shown[0] || (Array.isArray(galleryFilesCache) ? galleryFilesCache[0] : null);

  if (!fileToShow || !fileToShow.url) {
    setGalleryPlaceholder('Brak obrazków dla wybranego produktu.');
    return;
  }

  const label = formatGalleryProductLabel(fileToShow.product || slug);
  showGalleryImage(fileToShow.url, label);
}

function findGallerySlugsForQuery(query) {
  if (!galleryProducts.length || !query) return [];
  const searchTerms = tokenizeQuery(query);
  if (!searchTerms.length) return [];

  return galleryProducts.filter((slug) => {
    const label = formatGalleryProductLabel(slug);
    return matchesTermsInField(label, searchTerms);
  });
}

function findGallerySlugsByName(name) {
  if (!galleryProducts.length || !name) return [];
  const nameTerms = tokenizeQuery(name);
  if (!nameTerms.length) return [];

  return galleryProducts.filter((slug) => {
    const label = formatGalleryProductLabel(slug);
    return matchesTermsInField(label, nameTerms, { matchMode: 'any' });
  });
}

function applyGallerySelectionFromSlug(slug) {
  if (!galleryProductSelect || !slug) return;
  if (!galleryProducts.includes(slug)) return;
  galleryProductSelect.value = slug;
  renderGalleryPreview();
}

function syncGalleryWithSearch(query, products) {
  if (!galleryProductSelect || !galleryProducts.length) return;

  let matchingSlugs = findGallerySlugsForQuery(query);

  if (!matchingSlugs.length && Array.isArray(products) && products.length === 1) {
    matchingSlugs = findGallerySlugsByName(products[0]?.name);
  }

  if (matchingSlugs.length === 1) {
    applyGallerySelectionFromSlug(matchingSlugs[0]);
  } else {
    galleryProductSelect.value = '';
    setGalleryPlaceholder('Wybierz produkt, aby zobaczyć grafikę.');
  }
}

function handleResultProductSelection(product) {
  if (!product || !galleryProductSelect || !galleryProducts.length) return;

  const slugs = findGallerySlugsByName(product.name);
  if (!slugs.length) {
    const contextLabel = currentFormMode === 'klienci-indywidualni'
      ? 'w tym obiekcie'
      : 'w tej miejscowości';
    setGalleryPlaceholder(`Brak projektu dla wybranego produktu ${contextLabel}.`);
    return;
  }

  applyGallerySelectionFromSlug(slugs[0]);
}

function updateGalleryControlsVisibility() {
  if (!galleryControlsCity || !galleryControlsSales) return;
  const isCityMode = currentFormMode === 'projekty-miejscowosci';
  galleryControlsCity.hidden = !isCityMode;
  galleryControlsSales.hidden = isCityMode;
}

async function loadSalespeople() {
  if (!gallerySalespersonSelect) return;

  try {
    gallerySalespersonSelect.disabled = true;
    gallerySalespersonSelect.innerHTML = '<option value="">Ładowanie…</option>';

    const data = await fetchGalleryJSON(`${GALLERY_API_BASE}/salespeople`);
    const salesPeople = Array.isArray(data.salesPeople) ? data.salesPeople : [];

    if (!salesPeople.length) {
      gallerySalespersonSelect.innerHTML = '<option value="">Brak handlowców</option>';
      if (galleryObjectSelect) {
        galleryObjectSelect.disabled = true;
        galleryObjectSelect.innerHTML = '<option value="">Brak obiektów</option>';
      }
      return;
    }

    const options = ['<option value="">Wybierz handlowca</option>',
      ...salesPeople.map((name) => `<option value="${name}">${name}</option>`),
    ];

    gallerySalespersonSelect.innerHTML = options.join('');
    gallerySalespersonSelect.disabled = false;

    if (galleryObjectSelect) {
      galleryObjectSelect.disabled = true;
      galleryObjectSelect.innerHTML = '<option value="">Wybierz handlowca</option>';
    }
  } catch (error) {
    console.error('Nie udało się pobrać handlowców:', error);
    gallerySalespersonSelect.innerHTML = '<option value="">Błąd ładowania</option>';
    gallerySalespersonSelect.disabled = true;
    if (galleryObjectSelect) {
      galleryObjectSelect.disabled = true;
      galleryObjectSelect.innerHTML = '<option value="">Nie udało się pobrać obiektów</option>';
    }
  }
}

async function loadObjectsForSalesperson(salesperson) {
  if (!galleryObjectSelect) return;

  if (!salesperson) {
    galleryObjectSelect.disabled = true;
    galleryObjectSelect.innerHTML = '<option value="">Najpierw wybierz handlowca</option>';
    return;
  }

  try {
    galleryObjectSelect.disabled = true;
    galleryObjectSelect.innerHTML = '<option value="">Ładowanie…</option>';

    const url = `${GALLERY_API_BASE}/objects/${encodeURIComponent(salesperson)}`;
    const data = await fetchGalleryJSON(url);
    const objects = Array.isArray(data.objects) ? data.objects : [];

    if (!objects.length) {
      galleryObjectSelect.innerHTML = '<option value="">Brak obiektów</option>';
      return;
    }

    const options = ['<option value="">Wybierz obiekt</option>',
      ...objects.map((name) => `<option value="${name}">${name}</option>`),
    ];

    galleryObjectSelect.innerHTML = options.join('');
    galleryObjectSelect.disabled = false;
  } catch (error) {
    console.error('Nie udało się pobrać obiektów:', error);
    galleryObjectSelect.innerHTML = '<option value="">Błąd ładowania</option>';
    galleryObjectSelect.disabled = true;
  }
}

function setFormMode(mode) {
  if (!mode || currentFormMode === mode) return;

  const previousMode = currentFormMode;
  const previousSlug = galleryProductSelect ? galleryProductSelect.value || '' : '';

  // Jeśli blokada produktu NIE jest włączona, zapisz aktualny produkt
  // jako ostatnio użyty w poprzednim trybie.
  if (!galleryLockCheckbox || !galleryLockCheckbox.checked) {
    if (previousMode === 'projekty-miejscowosci') {
      cityModeProductSlug = previousSlug;
    } else if (previousMode === 'klienci-indywidualni') {
      clientsModeProductSlug = previousSlug;
    }
  }

  currentFormMode = mode;
  updateGalleryControlsVisibility();

  if (mode === 'projekty-miejscowosci') {
    // Przywróć listę produktów i cache dla trybu PM (jeśli już były pobrane)
    if (isCityModeInitialized) {
      galleryProducts = cityModeProducts;
      galleryFilesCache = cityModeFilesCache;

      if (galleryProductSelect) {
        if (galleryProducts.length) {
          const options = ['<option value="">Wybierz produkt</option>',
            ...galleryProducts.map((slug) => `<option value="${slug}">${formatGalleryProductLabel(slug)}</option>`),
          ];
          galleryProductSelect.innerHTML = options.join('');
          galleryProductSelect.disabled = false;
        } else {
          galleryProductSelect.innerHTML = '<option value="">Wybierz miejscowość</option>';
          galleryProductSelect.disabled = true;
        }
      }
      updateProjectFilterAvailability();
    }
    if (!isCityModeInitialized) {
      setGalleryPlaceholder('Wybierz miejscowość, aby zobaczyć projekty.');
      if (galleryCitySelect && !galleryCitySelect.value) {
        galleryCitySelect.value = '';
      }
      if (galleryProductSelect && !galleryProductSelect.value) {
        galleryProductSelect.innerHTML = '<option value="">Wybierz miejscowość</option>';
        galleryProductSelect.disabled = true;
      }
      galleryFilesCache = [];
      galleryProducts = [];
      updateProjectFilterAvailability();
      loadGalleryCities();
      isCityModeInitialized = true;
    }
  } else if (mode === 'klienci-indywidualni') {
    // Przy wejściu w KI nie wolno używać listy produktów z PM.
    // Jeśli nie mamy jeszcze produktów dla KI, zablokuj select.
    if (!isClientsModeInitialized) {
      setGalleryPlaceholder('Wybierz handlowca i obiekt, aby zobaczyć projekty.');
      updateProjectFilterAvailability();

      if (gallerySalespersonSelect) {
        gallerySalespersonSelect.disabled = true;
        gallerySalespersonSelect.innerHTML = '<option value="">Ładowanie…</option>';
      }
      if (galleryObjectSelect) {
        galleryObjectSelect.disabled = true;
        galleryObjectSelect.innerHTML = '<option value="">Najpierw wybierz handlowca</option>';
      }
      loadSalespeople();
      isClientsModeInitialized = true;
    } else {
      // Tryb KI był już inicjalizowany – przywróć jego własną listę produktów.
      galleryProducts = clientsModeProducts;
      galleryFilesCache = clientsModeFilesCache;

      if (galleryProductSelect) {
        if (galleryProducts.length) {
          const options = ['<option value="">Wybierz produkt</option>',
            ...galleryProducts.map((slug) => `<option value="${slug}">${formatGalleryProductLabel(slug)}</option>`),
          ];
          galleryProductSelect.innerHTML = options.join('');
          galleryProductSelect.disabled = false;
        } else {
          galleryProductSelect.disabled = true;
          galleryProductSelect.innerHTML = '<option value="">Najpierw wybierz handlowca i obiekt</option>';
        }
      }
      updateProjectFilterAvailability();
    }
  }

  // Po przełączeniu trybu zdecyduj, jaki produkt ma być widoczny.
  if (galleryProductSelect) {
    let targetSlug = '';

    if (galleryLockCheckbox && galleryLockCheckbox.checked) {
      // Blokada włączona – trzymaj aktualny produkt niezależnie od trybu.
      targetSlug = previousSlug;
    } else if (currentFormMode === 'projekty-miejscowosci') {
      targetSlug = cityModeProductSlug || '';
    } else if (currentFormMode === 'klienci-indywidualni') {
      targetSlug = clientsModeProductSlug || '';
    }

    if (targetSlug) {
      galleryProductSelect.value = targetSlug;
      renderGalleryPreview();
      handleGalleryProductChangeFromSelect();
    }
  }
}

async function handleGalleryProductChangeFromSelect() {
  if (!galleryProductSelect) return;
  const slug = galleryProductSelect.value;
  if (!slug) {
    return;
  }

  try {
    const label = formatGalleryProductLabel(slug);
    const searchTerms = tokenizeQuery(label);
    if (!searchTerms.length) {
      return;
    }

    setStatus('Ładowanie wybranego produktu...', 'info');
    resetResultsPlaceholder('Trwa pobieranie danych...');

    let products = await fetchProducts(label);

    if (!products.length && searchTerms.length > 1) {
      products = await fetchProducts();
    }

    const matching = products.filter((product) => {
      if (!product) return false;

      const nameTokens = getFieldTokens(product.name);
      const idTokens = getFieldTokens(product.pc_id);

      if (matchesTermsInField(product.name, searchTerms, { tokens: nameTokens })) {
        return true;
      }

      if (matchesTermsInField(product.pc_id, searchTerms, { tokens: idTokens })) {
        return true;
      }

      return false;
    });

    if (!matching.length) {
      setStatus('Nie znaleziono produktu powiązanego z wybranym projektem.', 'info');
      resetResultsPlaceholder('Brak produktu powiązanego z wybranym projektem.');
      lastSearchResults = [];
      return;
    }

    // Przy wyborze konkretnego produktu z galerii nie filtrujemy już po dostępności projektów,
    // bo sam wybór z galerii gwarantuje odpowiedni kontekst. Renderujemy bezpośrednio dopasowane produkty.
    lastSearchResults = matching;
    renderResults(matching);
    setStatus('Wybrano produkt z galerii. Uzupełnij ilość i dodaj do zamówienia.', 'info');
  } catch (error) {
    console.error('Błąd pobierania produktu dla wyboru z galerii:', error);
    setStatus('Błąd pobierania danych dla wybranego produktu.', 'error');
    resetResultsPlaceholder('Nie udało się pobrać danych dla wybranego produktu.');
    lastSearchResults = [];
  }
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
  // Na produkcji (HTTPS) nie możemy ładować obrazka bezpośrednio z HTTP QNAP-a,
  // dlatego korzystamy z proxy backendu (/api/gallery/image), który pobiera obraz
  // z GALLERY_BASE i zwraca go z tego samego originu.
  const proxiedUrl = `${GALLERY_API_BASE}/image?url=${encodeURIComponent(src)}`;
  galleryPreviewImage.src = proxiedUrl;

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
      lastSearchResults = [];
      syncGalleryWithSearch('', []);
      return;
    }

    lastSearchResults = filteredProducts;
    const visibleProducts = filterProductsByProjectAvailability(filteredProducts);

    if (!visibleProducts.length) {
      setStatus('Brak produktów spełniających wybrany filtr projektów w tej miejscowości.', 'info');
      resetResultsPlaceholder('Brak wyników dla wybranego filtra projektów.');
      syncGalleryWithSearch(query, filteredProducts);
      return;
    }

    renderResults(visibleProducts);
    syncGalleryWithSearch(query, visibleProducts);
  } catch (error) {
    console.error('Błąd wyszukiwania produktów:', error);
    setStatus(`Błąd pobierania danych: ${error.message}`, 'error');
    resetResultsPlaceholder('Nie udało się pobrać danych. Spróbuj ponownie.');
    lastSearchResults = [];
    syncGalleryWithSearch('', []);
  }
}

function createBadge(stock = 0, optimal = 0) {
  if (stock <= 0) return '<span class="badge badge--zero">Brak na stanie</span>';
  if (optimal && stock < optimal * 0.25) return '<span class="badge badge--low">Niski stan</span>';
  return `<span class="badge">${stock} szt.</span>`;
}

function hasGalleryContext() {
  return Boolean(galleryProducts && galleryProducts.length);
}

function filterProductsByProjectAvailability(products) {
  if (!Array.isArray(products)) return [];
  if (!hasGalleryContext()) return products;

  return products.filter((product) => {
    if (!product) return false;
    const slugsForProduct = findGallerySlugsByName(product.name);
    const hasProject = slugsForProduct.length > 0;
    return projectFilterMode === 'with' ? hasProject : !hasProject;
  });
}

function applyProjectFilterToLastResults(updateStatus = false) {
  if (!Array.isArray(lastSearchResults) || !lastSearchResults.length) {
    return;
  }

  const visibleProducts = filterProductsByProjectAvailability(lastSearchResults);
  if (!visibleProducts.length) {
    resetResultsPlaceholder('Brak wyników dla wybranego filtra projektów.');
    if (updateStatus) {
      setStatus('Brak produktów spełniających wybrany filtr projektów w tej miejscowości.', 'info');
    }
    return;
  }

  renderResults(visibleProducts);
}

function updateProjectFilterAvailability() {
  const filterRoot = document.getElementById('project-filter');
  if (!filterRoot) return;

  const hasContext = hasGalleryContext();
  if (!hasContext) {
    filterRoot.classList.add('project-filter--disabled');
    projectFilterMode = 'with';
    const options = filterRoot.querySelectorAll('.project-filter__option');
    options.forEach((btn) => {
      const mode = btn.dataset.projectFilter === 'without' ? 'without' : 'with';
      btn.classList.toggle('project-filter__option--active', mode === 'with');
    });
    return;
  }

  filterRoot.classList.remove('project-filter--disabled');
}

function initProjectFilter() {
  const filterRoot = document.getElementById('project-filter');
  if (!filterRoot) return;

  const options = Array.from(filterRoot.querySelectorAll('.project-filter__option'));
  options.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (filterRoot.classList.contains('project-filter--disabled')) return;

      const mode = btn.dataset.projectFilter === 'without' ? 'without' : 'with';
      if (projectFilterMode === mode) return;

      projectFilterMode = mode;
      options.forEach((opt) => {
        const optMode = opt.dataset.projectFilter === 'without' ? 'without' : 'with';
        opt.classList.toggle('project-filter__option--active', optMode === projectFilterMode);
      });

      applyProjectFilterToLastResults(true);
    });
  });

  updateProjectFilterAvailability();
}

function setSelectedResultsRow(row) {
  if (selectedResultsRow && selectedResultsRow !== row) {
    selectedResultsRow.classList.remove('results-row--selected');
  }
  selectedResultsRow = row || null;
  if (selectedResultsRow) {
    selectedResultsRow.classList.add('results-row--selected');
  }
}

function renderResults(products) {
  resultsBody.innerHTML = '';
  setSelectedResultsRow(null);
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

    if (hasGalleryContext()) {
      const slugsForProduct = findGallerySlugsByName(product.name);
      if (slugsForProduct.length) {
        row.classList.add('results-row--with-project');
      } else {
        row.classList.add('results-row--without-project');
      }
    }

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

    row.addEventListener('click', () => {
      setSelectedResultsRow(row);
      handleResultProductSelection(product);
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
  initProjectFilter();
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

  if (formModeNav) {
    const modeButtons = Array.from(formModeNav.querySelectorAll('.mode-nav__item'));
    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (!mode || mode === currentFormMode) return;

        modeButtons.forEach((other) => {
          other.classList.toggle('mode-nav__item--active', other === btn);
        });

        setFormMode(mode);
      });
    });
  }

  // Zmiana handlowca w trybie "Klienci indywidualni" – ładuje listę obiektów
  if (gallerySalespersonSelect) {
    gallerySalespersonSelect.addEventListener('change', () => {
      if (currentFormMode !== 'klienci-indywidualni') return;
      const salesperson = gallerySalespersonSelect.value;
      loadObjectsForSalesperson(salesperson);

      // Po zmianie handlowca czyścimy listę produktów
      if (galleryProductSelect) {
        galleryProductSelect.disabled = true;
        galleryProductSelect.innerHTML = '<option value="">Najpierw wybierz obiekt</option>';
      }
      galleryFilesCache = [];
      galleryProducts = [];
      updateProjectFilterAvailability();
      setGalleryPlaceholder('Wybierz obiekt, aby zobaczyć projekty.');
    });
  }

  // Zmiana miejscowości powinna ładować listę produktów dla tej miejscowości
  if (galleryCitySelect) {
    galleryCitySelect.addEventListener('change', () => {
      if (currentFormMode !== 'projekty-miejscowosci') return;
      const city = galleryCitySelect.value;
      loadGalleryProducts(city);
    });
  }

  if (galleryObjectSelect) {
    galleryObjectSelect.addEventListener('change', () => {
      if (currentFormMode !== 'klienci-indywidualni') return;
      const sp = gallerySalespersonSelect ? gallerySalespersonSelect.value : '';
      const obj = galleryObjectSelect.value;
      loadGalleryProductsForObject(sp, obj);
    });
  }

  // Zmiana produktu – niezależnie od trybu, powinna przeładować podgląd obrazka
  if (galleryProductSelect) {
    galleryProductSelect.addEventListener('change', () => {
      const slug = galleryProductSelect.value || '';
      if (currentFormMode === 'projekty-miejscowosci') {
        cityModeProductSlug = slug;
      } else if (currentFormMode === 'klienci-indywidualni') {
        clientsModeProductSlug = slug;
      }
      renderGalleryPreview();
      handleGalleryProductChangeFromSelect();
    });
  }

  updateGalleryControlsVisibility();
  
  // Inicjalizacja danych galerii
  if (currentFormMode === 'projekty-miejscowosci') {
    loadGalleryCities();
    isCityModeInitialized = true;
  } else if (currentFormMode === 'klienci-indywidualni') {
    loadSalespeople();
    isClientsModeInitialized = true;
  }
}
 
// -----------------------------
// Klient zamówienia – helpery (search + select)
// -----------------------------

function updateOrderCustomerBar() {
  if (!orderCustomerNameEl) return;

  if (!currentCustomer) {
    orderCustomerNameEl.textContent = 'Brak wybranego klienta';
    orderCustomerNameEl.classList.add('order-customer__value--empty');
    return;
  }

  const parts = [currentCustomer.name];
  if (currentCustomer.city) parts.push(currentCustomer.city);
  if (currentCustomer.zipCode) parts.push(currentCustomer.zipCode);
  const label = parts.filter(Boolean).join(' · ');

  orderCustomerNameEl.textContent = label || currentCustomer.name;
  orderCustomerNameEl.classList.remove('order-customer__value--empty');
}

function setOrderCustomer(customer) {
  currentCustomer = customer ? { ...customer } : null;
  updateOrderCustomerBar();

  // Ustaw także wartość w selectcie
  if (orderCustomerSelectEl) {
    orderCustomerSelectEl.value = customer ? customer.id : '';
  }
}

async function loadOrderCustomers() {
  try {
    const response = await fetch('/api/clients', { credentials: 'include' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const result = await response.json();
    pickerCustomers = Array.isArray(result.data) ? result.data : [];
    filterOrderCustomers(orderCustomerSearchInput?.value || '');
  } catch (error) {
    console.error('Nie udało się pobrać listy klientów:', error);
  }
}

function filterOrderCustomers(term) {
  const value = (term || '').toLowerCase().trim();
  pickerFilteredCustomers = pickerCustomers.filter((c) => {
    if (!value) return true;
    return (
      (c.name && c.name.toLowerCase().includes(value)) ||
      (c.city && c.city.toLowerCase().includes(value)) ||
      (c.email && c.email.toLowerCase().includes(value)) ||
      (c.phone && c.phone.toLowerCase().includes(value))
    );
  });
  renderOrderCustomerOptions();

  // Jeśli po filtrowaniu został dokładnie jeden klient – wybierz go automatycznie
  if (pickerFilteredCustomers.length === 1) {
    setOrderCustomer(pickerFilteredCustomers[0]);
  } else if (pickerFilteredCustomers.length === 0) {
    // Brak trafień – czyścimy wybór
    setOrderCustomer(null);
  }
}

function renderOrderCustomerOptions() {
  if (!orderCustomerSelectEl) return;

  const options = ['<option value="">--- wybierz klienta ---</option>'];

  pickerFilteredCustomers.forEach((c) => {
    const meta = [c.city, c.zipCode].filter(Boolean).join(' ');
    const label = meta ? `${c.name} (${meta})` : c.name;
    options.push(`<option value="${c.id}">${label}</option>`);
  });

  orderCustomerSelectEl.innerHTML = options.join('');

  // Przywróć zaznaczenie jeśli currentCustomer nadal jest w liście
  if (currentCustomer) {
    orderCustomerSelectEl.value = currentCustomer.id || '';
  }
}

function initOrderCustomerControls() {
  // Inicjalny tekst
  updateOrderCustomerBar();

  // Załaduj klientów przy starcie (tylko raz)
  loadOrderCustomers();

  if (orderCustomerSearchInput) {
    orderCustomerSearchInput.addEventListener('input', (e) => {
      filterOrderCustomers(e.target.value);
    });
  }

  if (orderCustomerSelectEl) {
    orderCustomerSelectEl.addEventListener('change', (e) => {
      const id = e.target.value;
      const customer = pickerCustomers.find((c) => c.id === id) || null;
      setOrderCustomer(customer);
    });
  }
}

// Sprawdzenie autoryzacji i inicjalizacja
async function checkAuthAndInitialize() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (response.ok) {
      const userData = await response.json();
      currentUser = userData;
      showUserNavigation(userData.role);
    }
  } catch (error) {
    console.log('Użytkownik niezalogowany lub błąd autoryzacji');
  }

  // Inicjalizacja niezależnie od stanu logowania
  initialize();
  initOrderCustomerControls();
}

// Pokazywanie nawigacji dla zalogowanych użytkowników
function showUserNavigation(role) {
  if (clientsLink && ['SALES_REP', 'SALES_DEPT', 'ADMIN'].includes(role)) {
    clientsLink.style.display = 'flex';
  }
  
  if (adminLink && role === 'ADMIN') {
    adminLink.style.display = 'flex';
  }
  
  if (logoutBtn) {
    logoutBtn.style.display = 'flex';
    logoutBtn.addEventListener('click', handleLogout);
  }
}

// Obsługa wylogowania
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Błąd wylogowania:', error);
    window.location.href = '/login.html';
  }
}

document.addEventListener('DOMContentLoaded', checkAuthAndInitialize);

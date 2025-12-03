import { EMBEDDED_FONTS } from '../assets/fonts/embedded-fonts.js';
import { computePerProjectQuantities } from './projectQuantityLogic.js';

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
// Uwaga na przyszłość: planowane są dodatkowe tryby formularza
// 'projekty-imienne' (PI) i 'projekty-hasla' (Ph).
// Dla nich również należy utrzymać osobno izolowaną logikę galerii,
// analogicznie jak dla trybów PM (projekty-miejscowosci) i KI (klienci-indywidualni).
let isCityModeInitialized = false;
let isClientsModeInitialized = false;
let cityModeProductSlug = '';
let cityModeProducts = [];
let cityModeFilesCache = [];
let clientsModeProductSlug = '';
let clientsModeProducts = [];
let clientsModeFilesCache = [];
let lastLockedProductSlug = ''; // Przechowuje produkt trzymany przez checkbox
let currentUser = null;

// Stan klienta zamówienia
let currentCustomer = null;
let pickerCustomers = [];
let pickerFilteredCustomers = [];

// Szablony zamówień
let orderTemplates = [];
let selectedTemplate = null;

// Inicjalizacja elementów DOM
const resultsBody = document.getElementById('results-body');
const clientsLink = document.getElementById('clients-link');
const adminLink = document.getElementById('admin-link');
const logoutBtn = document.getElementById('logout-btn');
const cartBody = document.getElementById('cart-body');
const cartTotal = document.querySelector('#cart-total');
const clearCartBtn = document.getElementById('clear-cart');
const exportBtn = document.getElementById('export-json');
const submitOrderBtn = document.getElementById('submit-order');
const statusMessage = document.getElementById('status-message');
const cartStatus = document.getElementById('cart-status');
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
const sortNewFirstCheckbox = document.getElementById('sort-new-first');
const sortAvailableFirstCheckbox = document.getElementById('sort-available-first');

// Elementy UI szablonów
const saveTemplateBtn = document.getElementById('save-template-btn');
const loadTemplateBtn = document.getElementById('load-template-btn');
const templateModal = document.getElementById('template-modal');
const templateModalClose = document.getElementById('template-modal-close');
const templatesList = document.getElementById('templates-list');
const templateSearchInput = document.getElementById('template-search');
const templateVisibilityFilter = document.getElementById('template-visibility-filter');
const saveTemplateModal = document.getElementById('save-template-modal');
const saveTemplateModalClose = document.getElementById('save-template-modal-close');
const saveTemplateForm = document.getElementById('save-template-form');
const templateNameInput = document.getElementById('template-name');
const templateDescriptionInput = document.getElementById('template-description');
const templateVisibilityInput = document.getElementById('template-visibility');
const templateTagsInput = document.getElementById('template-tags');

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

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setHeaderLoginError(message) {
  const errorEl = document.getElementById('header-login-error');
  if (!errorEl) return;
  if (!message) {
    errorEl.hidden = true;
    errorEl.textContent = '';
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = message;
}

let headerLoginInFlight = false;

async function handleHeaderLoginSubmit(event) {
  event.preventDefault();
  if (headerLoginInFlight) return;

  const form = event.currentTarget;
  const submitBtn = form.querySelector('.header__login-submit');
  const emailInput = form.querySelector('input[name="email"]');
  const passwordInput = form.querySelector('input[name="password"]');

  const email = emailInput?.value?.trim();
  const password = passwordInput?.value || '';

  if (!email || !password) {
    setHeaderLoginError('Podaj email i hasło');
    return;
  }

  headerLoginInFlight = true;
  setHeaderLoginError(null);
  if (submitBtn) submitBtn.disabled = true;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok || json.status !== 'success') {
      setHeaderLoginError(json.message || 'Nie udało się zalogować');
      return;
    }

    window.location.reload();
  } catch (error) {
    console.error('Błąd logowania:', error);
    setHeaderLoginError('Błąd połączenia z serwerem');
  } finally {
    headerLoginInFlight = false;
    if (submitBtn) submitBtn.disabled = false;
  }
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

async function sortGalleryProductOptions(selectEl) {
  if (!selectEl) return;

  const options = Array.from(selectEl.options || []);
  if (options.length <= 1) return;

  const currentValue = selectEl.value;
  const [firstOption, ...rest] = options;

  const newFirst = !!(typeof sortNewFirstCheckbox !== 'undefined' && sortNewFirstCheckbox && sortNewFirstCheckbox.checked);
  const availableFirst = !!(typeof sortAvailableFirstCheckbox !== 'undefined' && sortAvailableFirstCheckbox && sortAvailableFirstCheckbox.checked);

  const isLocked = !!(typeof galleryLockCheckbox !== 'undefined' && galleryLockCheckbox && galleryLockCheckbox.checked);

  await ensureMasterProductsLoaded();

  const getFlagsForOption = (opt) => {
    // 1) Spróbuj dopasować po ID produktu z bazy
    if (Array.isArray(masterProductsCache) && masterProductsCache.length) {
      const productIdAttr = opt.getAttribute('data-product-id');
      if (productIdAttr) {
        const productById = masterProductsCache.find((p) => String(p._id) === String(productIdAttr));
        if (productById) {
          const isNew = !!productById.new;
          const isAvailable = (productById.isActive !== false) && Number(productById.stock || 0) > 0;
          return { isNew, isAvailable };
        }
      }

      // 2) Spróbuj dopasować po identyfikatorze / indeksie
      const identifierAttr = opt.getAttribute('data-product-identifier') || '';
      const indexAttr = opt.getAttribute('data-product-index') || '';
      const idNorm = normalizeForMatching(identifierAttr || indexAttr);
      if (idNorm) {
        const productByCode = masterProductsCache.find((p) => {
          const nameNorm = normalizeForMatching(p.name);
          const pcIdNorm = normalizeForMatching(p.pc_id);
          return (nameNorm && nameNorm === idNorm) || (pcIdNorm && pcIdNorm === idNorm);
        });
        if (productByCode) {
          const isNew = !!productByCode.new;
          const isAvailable = (productByCode.isActive !== false) && Number(productByCode.stock || 0) > 0;
          return { isNew, isAvailable };
        }
      }
    }

    // 3) Fallback na flagi zapisane w atrybutach data-*, jeżeli są dostępne
    const hasDataFlags = opt.hasAttribute('data-product-new') || opt.hasAttribute('data-product-available');
    if (hasDataFlags) {
      const isNew = (opt.getAttribute('data-product-new') || 'false') === 'true';
      const isAvailable = (opt.getAttribute('data-product-available') || 'false') === 'true';
      return { isNew, isAvailable };
    }

    // 4) Ostateczny fallback – dopasowanie po samej etykiecie opcji
    const label = (opt.text || '').trim();
    const { isNew, isAvailable } = getMasterFlagsForLabel(label);
    return { isNew, isAvailable };
  };

  const computePriority = (isNew, isAvailable) => {
    if (newFirst && availableFirst) {
      if (isNew && isAvailable) return 0;            // Nowy + dostępny
      if (isNew && !isAvailable) return 1;          // Tylko nowy
      if (!isNew && isAvailable) return 2;          // Tylko dostępny
      return 3;                                     // Reszta
    }

    if (newFirst && isNew) return 0;
    if (availableFirst && isAvailable) return 0;

    return 1;
  };

  rest.sort((a, b) => {
    const { isNew: aNew, isAvailable: aAvail } = getFlagsForOption(a);
    const { isNew: bNew, isAvailable: bAvail } = getFlagsForOption(b);

    const aPri = computePriority(aNew, aAvail);
    const bPri = computePriority(bNew, bAvail);

    if (aPri !== bPri) return aPri - bPri;

    return (a.text || '').localeCompare(b.text || '', 'pl', { sensitivity: 'accent' });
  });

  if (newFirst || availableFirst) {
    try {
      const sample = rest.slice(0, 10).map((opt) => {
        const { isNew, isAvailable } = getFlagsForOption(opt);
        return {
          text: opt.text || '',
          value: opt.value,
          new: String(isNew),
          available: String(isAvailable),
        };
      });
    } catch (e) {
      // Ignoruj ewentualne błędy logowania
    }
  }

  selectEl.innerHTML = '';
  selectEl.append(firstOption, ...rest);

  // Jeśli blokada produktu jest włączona, nie zmieniaj aktualnego wyboru
  if (isLocked) {
    if (currentValue) {
      selectEl.value = currentValue;
    }
    return;
  }

  // Gdy aktywne są checkboxy sortowania, ustaw jako wybrany pierwszy element o najwyższym priorytecie
  if (newFirst || availableFirst) {
    let firstPriorityZeroValue = null;

    for (const opt of rest) {
      const { isNew, isAvailable } = getFlagsForOption(opt);
      const pri = computePriority(isNew, isAvailable);
      if (pri === 0) {
        firstPriorityZeroValue = opt.value;
        break;
      }
    }

    if (firstPriorityZeroValue) {
      selectEl.value = firstPriorityZeroValue;
    } else if (currentValue) {
      // Brak produktów spełniających priorytet – zachowaj dotychczasowy wybór
      selectEl.value = currentValue;
    }
  } else if (currentValue) {
    // Bez aktywnych checkboxów – po prostu zachowaj dotychczasowy wybór
    selectEl.value = currentValue;
  }
}

// Funkcja pomocnicza do pobierania roli użytkownika
async function getCurrentUserRole() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (response.status === 401) {
      return 'GUEST';
    }
    if (!response.ok) return 'GUEST';
    const result = await response.json();
    return result.role || 'GUEST';
  } catch (error) {
    console.error('Błąd pobierania roli użytkownika:', error);
    return 'GUEST';
  }
}

async function loadGalleryCities() {
  if (!galleryCitySelect) {
    console.error('[ERROR] galleryCitySelect is null!');
    return;
  }
  try {
    galleryCitySelect.disabled = true;
    galleryCitySelect.innerHTML = '<option value="">Ładowanie…</option>';
    
    // Pobierz miasta z filtrowaniem po przypisaniach użytkownika
    const data = await fetchGalleryJSON(`${GALLERY_API_BASE}/cities`);
    
    let visibleCities = Array.isArray(data.cities)
      ? data.cities.filter((name) => !/^\d+\./.test((name ?? '').trim()))
      : [];
    
    // Sprawdź rolę użytkownika, aby zdecydować o filtrowaniu
    const currentUserRole = await getCurrentUserRole();
    const isGuest = currentUserRole === 'GUEST' || !currentUserRole;
    
    let userAssignedCities = [];
    
    // ADMIN, SALES_DEPT i GRAPHICS widzą wszystkie miejscowości domyślnie
    if (['ADMIN', 'SALES_DEPT', 'GRAPHICS'].includes(currentUserRole)) {
      // Nie filtruj - pokaż wszystkie miejscowości
      userAssignedCities = data.assignedCities || [];
      
      // Dla GRAPHICS ustaw tryb read-only (nie mogą składać zamówień)
      if (currentUserRole === 'GRAPHICS') {
        document.body.classList.add('read-only-mode');
      } else {
        document.body.classList.remove('read-only-mode');
      }
    } else if (data.assignedCities && data.assignedCities.length > 0) {
      // SALES_REP i CLIENT z przypisaniami - filtruj miasta
      userAssignedCities = data.assignedCities;
      const assignedCities = new Set(data.assignedCities);
      visibleCities = visibleCities.filter(city => assignedCities.has(city));
    } else if (isGuest) {
      // Gość widzi wszystkie miasta w trybie tylko do odczytu
      document.body.classList.add('read-only-mode');
      setGalleryPlaceholder('Zaloguj się, aby składać zamówienia. Możesz przeglądać listę w trybie podglądu.');
      userAssignedCities = [];
    } else {
      // Brak przypisań - pokaż pustą listę
      visibleCities = [];
    }

    if (!visibleCities.length && !['ADMIN', 'SALES_DEPT', 'GRAPHICS'].includes(currentUserRole) && !isGuest) {
      // Jeśli użytkownik nie ma przypisań, pokaż opcję "Wszystkie miejscowości" do przeglądania
      if (data.assignedCities && data.assignedCities.length === 0) {
        // Pobierz wszystkie miasta (bez folderów technicznych) do opcji "Wszystkie miejscowości"
        const allCitiesFiltered = Array.isArray(data.cities)
          ? data.cities.filter((name) => !/^\d+\./.test((name ?? '').trim()))
          : [];
        
        const options = ['<option value="">Wybierz miejscowość (brak przypisanych)</option>',
          ...allCitiesFiltered.map((city) => {
            const citySafe = escapeHtml(city);
            return `<option value="${citySafe}">${citySafe} (podgląd)</option>`;
          }),
        ];
        galleryCitySelect.innerHTML = options.join('');
        galleryCitySelect.disabled = false;
        setGalleryPlaceholder('Nie masz przypisanych miejscowości. Wybierz "Wszystkie miejscowości" aby przeglądać.');
        document.body.classList.add('read-only-mode');
        updateProjectFilterAvailability();
        return;
      } else {
        galleryCitySelect.innerHTML = '<option value="">Brak danych</option>';
        setGalleryPlaceholder('Brak dostępnych miejscowości.');
      }
      galleryFilesCache = [];
      galleryProducts = [];
      updateProjectFilterAvailability();
      return;
    }
    
    // Jeśli tryb readOnly, dodaj informację
    if (data.readOnly) {
      document.body.classList.add('read-only-mode');
    } else {
      document.body.classList.remove('read-only-mode');
    }
    
    // Przechowaj wszystkie miasta do przełącznika "pokaż wszystkie" (PRZED filtrowaniem!)
    const allCitiesFiltered = Array.isArray(data.cities)
      ? data.cities.filter((name) => !/^\d+\./.test((name ?? '').trim()))
      : [];
    window._allCitiesForToggle = allCitiesFiltered;
    
    // Zapisz przypisane miasta PRZED filtrowaniem
    const assignedCitiesBeforeFilter = data.assignedCities && data.assignedCities.length > 0 
      ? data.assignedCities 
      : [];
    window._userAssignedCities = assignedCitiesBeforeFilter;
    
    // Pokaż przełącznik dla użytkowników z przypisaniami
    const showAllToggle = document.getElementById('show-all-cities-toggle');
    if (showAllToggle) {
      // Pobierz przypisane miejscowości z danych (niezależnie od roli)
      const hasAssignedCities = data.assignedCities && data.assignedCities.length > 0;
      
      if (['ADMIN', 'SALES_DEPT'].includes(currentUserRole) && hasAssignedCities) {
        // ADMIN i SALES_DEPT z przypisaniami - pokaż przełącznik "moje miejscowości"
        showAllToggle.style.display = 'inline';
        showAllToggle.textContent = 'moje miejscowości';
        showAllToggle.dataset.showingAll = 'true'; // domyślnie pokazują wszystkie
        showAllToggle.dataset.mode = 'all-to-assigned';
        // Zapisz przypisane miejscowości do przełącznika
        window._userAssignedCities = data.assignedCities;
      } else if (currentUserRole === 'GRAPHICS') {
        // GRAPHICS - nie pokazuj przełącznika (tylko podgląd)
        showAllToggle.style.display = 'none';
      } else if (hasAssignedCities && !['ADMIN', 'SALES_DEPT'].includes(currentUserRole)) {
        // Dla SALES_REP/CLIENT z przypisaniami pokaż przełącznik "pokaż wszystkie"
        showAllToggle.style.display = 'inline';
        showAllToggle.textContent = 'pokaż wszystkie';
        showAllToggle.dataset.showingAll = 'false';
        showAllToggle.dataset.mode = 'assigned-to-all';
      } else {
        showAllToggle.style.display = 'none';
      }
    }
    
    const options = ['<option value="">Wybierz miejscowość</option>',
      ...visibleCities.map((city) => {
        const citySafe = escapeHtml(city);
        return `<option value="${citySafe}">${citySafe}</option>`;
      }),
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
    await ensureMasterProductsLoaded();

    // Użyj lastLockedProductSlug jeśli checkbox jest zaznaczony
    const lockedSlug = galleryLockCheckbox?.checked ? lastLockedProductSlug : '';
    
    galleryProductSelect.disabled = true;
    galleryProductSelect.innerHTML = '<option value="">Ładowanie…</option>';

    const url = `${GALLERY_API_BASE}/products-object?salesperson=${encodeURIComponent(sp)}&object=${encodeURIComponent(obj)}`;
    const data = await fetchGalleryJSON(url);
    galleryFilesCache = Array.isArray(data.files) ? data.files : [];
    galleryProducts = Array.isArray(data.products) ? data.products : [];
    clientsModeFilesCache = galleryFilesCache;
    clientsModeProducts = galleryProducts;

    const projects = Array.isArray(data.projects) ? data.projects : [];
    const usedSlugs = new Set();
    const productOptions = ['<option value="">Wybierz produkt</option>'];

    // Najpierw opcje oparte na mapowaniu projektów → produktów z bazy
    projects.forEach((project) => {
      const slug = typeof project?.slug === 'string' ? project.slug.trim() : '';
      if (!slug) return;
      usedSlugs.add(slug);
      const displayName = project.displayName || formatGalleryProductLabel(slug);
      const mappedProducts = Array.isArray(project.products) ? project.products : [];

      if (mappedProducts.length) {
        mappedProducts.forEach((prod) => {
          const id = prod.id || prod.productId || '';
          const identifier = prod.identifier || prod.index || displayName;
          const label = displayName ? `${identifier} (${displayName})` : identifier;
          const isNew = prod.new === true;
          const isAvailable = prod.available === true;
          productOptions.push(
            `<option value="${slug}" data-project-slug="${slug}" data-product-id="${id}" data-product-identifier="${identifier}" data-product-index="${prod.index || ''}" data-product-new="${isNew ? 'true' : 'false'}" data-product-available="${isAvailable ? 'true' : 'false'}">${label}</option>`
          );
        });
      } else {
        const label = displayName;
        productOptions.push(
          `<option value="${slug}" data-project-slug="${slug}" data-product-new="false" data-product-available="false">${label}</option>`
        );
      }
    });

    // Slugi z galerii bez mapowania w bazie – pokaż je jak dotychczas
    const unmappedSlugs = galleryProducts.filter((slug) => typeof slug === 'string' && !usedSlugs.has(slug));
    unmappedSlugs.forEach((slug) => {
      const label = formatGalleryProductLabel(slug);
      const { isNew, isAvailable } = getMasterFlagsForLabel(label);
      productOptions.push(
        `<option value="${slug}" data-project-slug="${slug}" data-product-new="${isNew ? 'true' : 'false'}" data-product-available="${isAvailable ? 'true' : 'false'}">${label}</option>`
      );
    });

    let selectedSlug = '';
    let lockedMissingInObject = false;

    if (lockedSlug) {
      if (galleryProducts.includes(lockedSlug)) {
        selectedSlug = lockedSlug;
      } else {
        lockedMissingInObject = true;
        const missingLabel = `${formatGalleryProductLabel(lockedSlug)} — brak w tym obiekcie`;
        productOptions.push(
          `<option value="${lockedSlug}" data-project-slug="${lockedSlug}">${missingLabel}</option>`
        );
        selectedSlug = lockedSlug;
      }
    }

    galleryProductSelect.innerHTML = productOptions.join('');
    sortGalleryProductOptions(galleryProductSelect);
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
    // Użyj lastLockedProductSlug jeśli checkbox jest zaznaczony
    const lockedSlug = galleryLockCheckbox?.checked ? lastLockedProductSlug : '';
    
    galleryProductSelect.disabled = true;
    galleryProductSelect.innerHTML = '<option value="">Ładowanie…</option>';
    const data = await fetchGalleryJSON(`${GALLERY_API_BASE}/products/${encodeURIComponent(targetCity)}`);
    galleryFilesCache = Array.isArray(data.files) ? data.files : [];
    galleryProducts = Array.isArray(data.products) ? data.products : [];
    cityModeFilesCache = galleryFilesCache;
    cityModeProducts = galleryProducts;

    const projects = Array.isArray(data.projects) ? data.projects : [];
    const usedSlugs = new Set();
    const productOptions = ['<option value="">Wybierz produkt</option>'];

    // Opcje na podstawie mapowania projektów na produkty z bazy
    projects.forEach((project) => {
      const slug = typeof project?.slug === 'string' ? project.slug.trim() : '';
      if (!slug) return;
      usedSlugs.add(slug);
      const displayName = project.displayName || formatGalleryProductLabel(slug);
      const mappedProducts = Array.isArray(project.products) ? project.products : [];

      if (mappedProducts.length) {
        mappedProducts.forEach((prod) => {
          const id = prod.id || prod.productId || '';
          const identifier = prod.identifier || prod.index || displayName;
          const label = displayName ? `${identifier} (${displayName})` : identifier;
          const isNew = prod.new === true;
          const isAvailable = prod.available === true;
          productOptions.push(
            `<option value="${slug}" data-project-slug="${slug}" data-product-id="${id}" data-product-identifier="${identifier}" data-product-index="${prod.index || ''}" data-product-new="${isNew ? 'true' : 'false'}" data-product-available="${isAvailable ? 'true' : 'false'}">${label}</option>`
          );
        });
      } else {
        const label = displayName;
        productOptions.push(
          `<option value="${slug}" data-project-slug="${slug}" data-product-new="false" data-product-available="false">${label}</option>`
        );
      }
    });

    // Slugi z galerii bez mapowania w bazie – zachowaj stare zachowanie
    const unmappedSlugs = galleryProducts.filter((slug) => typeof slug === 'string' && !usedSlugs.has(slug));
    unmappedSlugs.forEach((slug) => {
      const label = formatGalleryProductLabel(slug);
      const { isNew, isAvailable } = getMasterFlagsForLabel(label);
      productOptions.push(
        `<option value="${slug}" data-project-slug="${slug}" data-product-new="${isNew ? 'true' : 'false'}" data-product-available="${isAvailable ? 'true' : 'false'}">${label}</option>`
      );
    });

    let selectedSlug = '';
    let lockedMissingInCity = false;

    if (lockedSlug) {
      if (galleryProducts.includes(lockedSlug)) {
        selectedSlug = lockedSlug;
      } else {
        lockedMissingInCity = true;
        const missingLabel = `${formatGalleryProductLabel(lockedSlug)} — brak w tej miejscowości`;
        productOptions.push(
          `<option value="${lockedSlug}" data-project-slug="${lockedSlug}">${missingLabel}</option>`
        );
        selectedSlug = lockedSlug;
      }
    }

    galleryProductSelect.innerHTML = productOptions.join('');
    sortGalleryProductOptions(galleryProductSelect);
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

  // Zawsze używaj bieżącego galleryFilesCache (z bieżącego kontekstu)
  const cacheToUse = galleryFilesCache;

  // Spróbuj znaleźć pliki dokładnie dla danego produktu
  const shown = Array.isArray(cacheToUse)
    ? cacheToUse.filter((file) => file.product === slug)
    : [];

  // Jeśli brak dokładnego dopasowania, NIE pokazuj pierwszego lepszego obrazka
  const fileToShow = shown[0] || null;

  if (!fileToShow || !fileToShow.url) {
    setGalleryPlaceholder('Brak obrazków dla wybranego produktu.');
    return;
  }

  const label = formatGalleryProductLabel(fileToShow.product || slug);
  showGalleryImage(fileToShow.url, label);
}

function findGallerySlugsForQuery(query) {
  if (!galleryProductSelect || !query) return [];

  const searchTerms = tokenizeQuery(query);
  if (!searchTerms.length) return [];

  const options = Array.from(galleryProductSelect.options || []).filter(
    (opt) => opt.value // pomijamy placeholder "Wybierz produkt"
  );

  const matches = [];

  for (const opt of options) {
    const label = (opt.text || '').trim();
    if (!label) continue;

    if (matchesTermsInField(label, searchTerms)) {
      const norm = normalizeForMatching(label);
      const tokens = norm ? norm.split(' ').filter(Boolean) : [];
      matches.push({
        slug: opt.value,
        label,
        tokenCount: tokens.length || 999,
        length: label.length,
      });
    }
  }

  if (!matches.length) return [];

  // Preferuj najbardziej "konkretny" wynik – najmniej słów, potem najkrótszą etykietę
  matches.sort((a, b) => {
    if (a.tokenCount !== b.tokenCount) return a.tokenCount - b.tokenCount;
    return a.length - b.length;
  });

  // Zwracamy tylko najlepiej pasujący slug – dzięki temu zapytania typu "bre scy"
  // wybiorą "BRELOK SCYZORYK", a nie dłuższe warianty z dodatkowymi słowami.
  return [matches[0].slug];
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

function findGallerySlugForProducts(products) {
  if (!galleryProductSelect || !Array.isArray(products) || !products.length) return '';

  const options = Array.from(galleryProductSelect.options || []);
  if (!options.length) return '';

  for (const product of products) {
    if (!product) continue;

    const id = String(product._id || product.id || '').trim();
    const identifier = (product.name || '').trim();
    const index = (product.pc_id || '').trim();

    const match = options.find((opt) => {
      const optId = (opt.dataset.productId || '').trim();
      const optIdentifier = (opt.dataset.productIdentifier || '').trim();
      const optIndex = (opt.dataset.productIndex || '').trim();

      if (id && optId && optId === id) return true;
      if (identifier && optIdentifier && optIdentifier === identifier) return true;
      if (index && optIndex && optIndex === index) return true;

      return false;
    });

    if (match && match.value) {
      return match.value;
    }
  }

  return '';
}

function syncGalleryWithSearch(query, products) {
  if (!galleryProductSelect || !galleryProducts.length) return;

  // Najpierw spróbuj dopasować po konkretnych produktach z wyników wyszukiwania
  const slugFromProducts = findGallerySlugForProducts(products || []);
  if (slugFromProducts) {
    applyGallerySelectionFromSlug(slugFromProducts);
    return;
  }

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

    // Sprawdź czy wyniki są filtrowane (handlowiec/klient z przypisaniami)
    const isFiltered = data.filtered === true;
    const noAssignments = isFiltered && salesPeople.length === 0;

    if (noAssignments) {
      gallerySalespersonSelect.innerHTML = '<option value="">Brak przypisanych folderów</option>';
      if (galleryObjectSelect) {
        galleryObjectSelect.disabled = true;
        galleryObjectSelect.innerHTML = '<option value="">Brak dostępu</option>';
      }
      // Pokaż komunikat użytkownikowi
      console.info('KI: Użytkownik nie ma przypisanych folderów. Skontaktuj się z administratorem.');
      return;
    }

    if (!salesPeople.length) {
      gallerySalespersonSelect.innerHTML = '<option value="">Brak handlowców</option>';
      if (galleryObjectSelect) {
        galleryObjectSelect.disabled = true;
        galleryObjectSelect.innerHTML = '<option value="">Brak obiektów</option>';
      }
      return;
    }

    const options = ['<option value="">Wybierz handlowca</option>',
      ...salesPeople.map((name) => {
        const safeName = escapeHtml(name || '');
        return `<option value="${safeName}">${safeName}</option>`;
      }),
    ];

    gallerySalespersonSelect.innerHTML = options.join('');
    gallerySalespersonSelect.disabled = false;

    // Pokaż select z powrotem i usuń info o folderze (jeśli istnieje)
    const parent = gallerySalespersonSelect.parentElement;
    if (parent) {
      parent.classList.remove('hidden');
      const folderInfo = document.getElementById('assigned-folder-info');
      if (folderInfo) {
        folderInfo.remove();
      }
    }

    if (galleryObjectSelect) {
      galleryObjectSelect.disabled = true;
      galleryObjectSelect.innerHTML = '<option value="">Wybierz handlowca</option>';
    }

    // Automatyczny wybór jedynego folderu dla handlowca/klienta
    if (isFiltered && salesPeople.length === 1) {
      const onlyFolder = salesPeople[0];
      gallerySalespersonSelect.value = onlyFolder;
      gallerySalespersonSelect.disabled = true;
      
      // Ukryj select i pokaż info o przypisanym folderze
      const parent = gallerySalespersonSelect.parentElement;
      if (parent) {
        parent.classList.add('hidden');
        
        // Stwórz lub zaktualizuj info o folderze
        let folderInfo = document.getElementById('assigned-folder-info');
        if (!folderInfo) {
          folderInfo = document.createElement('div');
          folderInfo.id = 'assigned-folder-info';
          folderInfo.className = 'bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4';
          parent.parentElement.insertBefore(folderInfo, parent);
        }
        const onlyFolderSafe = escapeHtml(onlyFolder || '');
        folderInfo.innerHTML = `
          <div class="flex items-center gap-2">
            <i class="fas fa-folder text-blue-600"></i>
            <span class="text-sm font-medium text-blue-900">Przypisany folder:</span>
            <span class="text-sm text-blue-700 font-semibold">${onlyFolderSafe}</span>
          </div>
        `;
      }
      
      // Automatycznie załaduj obiekty dla tego folderu
      loadObjectsForSalesperson(onlyFolder);
      
      console.info(`KI: Automatycznie wybrano jedyny przypisany folder: ${onlyFolder}`);
      return;
    }

    // Log info o filtrowanych wynikach
    if (isFiltered) {
      console.info(`KI: Załadowano ${salesPeople.length} przypisanych folderów (z ${data.totalAvailable || '?'} dostępnych)`);
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
  if (!galleryObjectSelect) return [];

  if (!salesperson) {
    galleryObjectSelect.disabled = true;
    galleryObjectSelect.innerHTML = '<option value="">Najpierw wybierz handlowca</option>';
    return [];
  }

  try {
    galleryObjectSelect.disabled = true;
    galleryObjectSelect.innerHTML = '<option value="">Ładowanie…</option>';

    const url = `${GALLERY_API_BASE}/objects/${encodeURIComponent(salesperson)}`;
    const response = await fetch(url, { credentials: 'include' });
    
    // Obsługa błędu 403 - brak dostępu do folderu
    if (response.status === 403) {
      galleryObjectSelect.innerHTML = '<option value="">Brak dostępu do tego folderu</option>';
      galleryObjectSelect.disabled = true;
      console.warn(`KI: Brak uprawnień do folderu "${salesperson}"`);
      return [];
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const objects = Array.isArray(data.objects) ? data.objects : [];

    if (!objects.length) {
      galleryObjectSelect.innerHTML = '<option value="">Brak obiektów</option>';
      return [];
    }

    const options = ['<option value="">Wybierz obiekt</option>',
      ...objects.map((name) => {
        const safeName = escapeHtml(name || '');
        return `<option value="${safeName}">${safeName}</option>`;
      }),
    ];

    galleryObjectSelect.innerHTML = options.join('');
    galleryObjectSelect.disabled = false;
    return objects;
  } catch (error) {
    console.error('Nie udało się pobrać obiektów:', error);
    galleryObjectSelect.innerHTML = '<option value="">Błąd ładowania</option>';
    galleryObjectSelect.disabled = true;
    return [];
  }
}

function setFormMode(mode) {
  if (!mode || currentFormMode === mode) return;

  const previousMode = currentFormMode;
  const previousSlug = galleryProductSelect ? galleryProductSelect.value || '' : '';

  // Jeśli blokada produktu jest włączona, zapisz aktualny produkt do lastLockedProductSlug
  if (galleryLockCheckbox && galleryLockCheckbox.checked) {
    lastLockedProductSlug = previousSlug;
  } else {
    // Jeśli blokada NIE jest włączona, zapisz aktualny produkt
    // jako ostatnio użyty w poprzednim trybie.
    if (previousMode === 'projekty-miejscowosci') {
      cityModeProductSlug = previousSlug;
    } else if (previousMode === 'klienci-indywidualni') {
      clientsModeProductSlug = previousSlug;
    }
  }

  currentFormMode = mode;
  updateGalleryControlsVisibility();

  if (mode === 'projekty-miejscowosci') {
    // Używaj WYŁĄCZNIE listy produktów dla PM
    galleryProducts = cityModeProducts;
    galleryFilesCache = cityModeFilesCache;

    if (galleryProductSelect) {
      // Sprawdź, czy checkbox "pamiętaj produkt" jest włączony i czy mamy trzymany produkt
      const lockedProductSlug = (galleryLockCheckbox && galleryLockCheckbox.checked) ? lastLockedProductSlug : '';
      const productsToShow = [...galleryProducts];
      
      // Jeśli checkbox włączony i trzymamy produkt, dodaj go do listy (jeśli go tam nie ma)
      if (lockedProductSlug && !productsToShow.includes(lockedProductSlug)) {
        productsToShow.push(lockedProductSlug);
      }
      
      if (productsToShow.length) {
        const options = ['<option value="">Wybierz produkt</option>',
          ...productsToShow.map((slug) => `<option value="${slug}">${formatGalleryProductLabel(slug)}</option>`),
        ];
        galleryProductSelect.innerHTML = options.join('');
        galleryProductSelect.disabled = false;
      } else {
        galleryProductSelect.innerHTML = '<option value="">Wybierz miejscowość</option>';
        galleryProductSelect.disabled = true;
      }
    }
    updateProjectFilterAvailability();
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
    // Używaj WYŁĄCZNIE listy produktów dla KI
    galleryProducts = clientsModeProducts;
    galleryFilesCache = clientsModeFilesCache;

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
    }

    if (galleryProductSelect) {
      // Sprawdź, czy checkbox "pamiętaj produkt" jest włączony i czy mamy trzymany produkt z PM
      const lockedProductSlug = (galleryLockCheckbox && galleryLockCheckbox.checked) ? lastLockedProductSlug : '';
      const productsToShow = [...galleryProducts];
      
      // Jeśli checkbox włączony i trzymamy produkt z PM, dodaj go do listy (jeśli go tam nie ma)
      if (lockedProductSlug && !productsToShow.includes(lockedProductSlug)) {
        productsToShow.push(lockedProductSlug);
      }
      
      if (productsToShow.length) {
        const options = ['<option value="">Wybierz produkt</option>',
          ...productsToShow.map((slug) => `<option value="${slug}">${formatGalleryProductLabel(slug)}</option>`),
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

  // Po przełączeniu trybu zdecyduj, jaki produkt ma być widoczny.
  if (galleryProductSelect) {
    let targetSlug = '';

    if (galleryLockCheckbox && galleryLockCheckbox.checked) {
      // Blokada włączona – zawsze trzymaj aktualny produkt, niezależnie od tego czy jest w liście.
      // (został dodany do opcji dropdownu w logice budowania opcji powyżej)
      if (lastLockedProductSlug) {
        targetSlug = lastLockedProductSlug;
      }
    } else if (currentFormMode === 'projekty-miejscowosci') {
      // Przywróć produkt PM TYLKO gdy miasto jest wybrane i slug istnieje w liście PM
      const city = galleryCitySelect ? galleryCitySelect.value : '';
      if (city && cityModeProductSlug && galleryProducts.includes(cityModeProductSlug)) {
        targetSlug = cityModeProductSlug;
      }
    } else if (currentFormMode === 'klienci-indywidualni') {
      // Przywróć produkt KI TYLKO gdy handlowiec i obiekt są wybrane i slug istnieje w liście KI
      const sp = gallerySalespersonSelect ? gallerySalespersonSelect.value : '';
      const obj = galleryObjectSelect ? galleryObjectSelect.value : '';
      if (sp && obj && clientsModeProductSlug && galleryProducts.includes(clientsModeProductSlug)) {
        targetSlug = clientsModeProductSlug;
      }
    }

    if (targetSlug) {
      galleryProductSelect.value = targetSlug;
      renderGalleryPreview();
      handleGalleryProductChangeFromSelect();
    }
  }
  
  // Przerenderuj pasek ulubionych dla nowego trybu
  renderFavoritesBar();
}

async function handleGalleryProductChangeFromSelect() {
  if (!galleryProductSelect) return;
  const slug = galleryProductSelect.value;
  if (!slug) {
    return;
  }

  try {
    setStatus('Ładowanie wybranego produktu...', 'info');
    resetResultsPlaceholder('Trwa pobieranie danych...');
    const selectedOption = galleryProductSelect.selectedOptions[0];
    const targetProductId = (selectedOption?.dataset.productId || '').trim();
    const targetIdentifier = (selectedOption?.dataset.productIdentifier || '').trim();
    const targetIndex = (selectedOption?.dataset.productIndex || '').trim();

    let matching = [];

    // Jeśli mamy pełne mapowanie (produkt z bazy przypisany do projektu) – użyj precyzyjnego dopasowania
    if (targetProductId || targetIdentifier || targetIndex) {
      let products = await fetchProducts();

      matching = products.filter((product) => {
        if (!product) return false;

        const id = String(product._id || product.id || '').trim();
        const identifier = (product.name || '').trim();
        const index = (product.pc_id || '').trim();

        if (targetProductId && id && id === targetProductId) return true;
        if (targetIdentifier && identifier && identifier === targetIdentifier) return true;
        if (targetIndex && index && index === targetIndex) return true;

        return false;
      });
    } else {
      // Brak mapowania produktu do projektu – wróć do starej logiki: szukaj po labelu z sluga
      const label = formatGalleryProductLabel(slug);
      const searchTerms = tokenizeQuery(label);
      if (!searchTerms.length) {
        return;
      }

      let products = await fetchProducts(label);

      if (!products.length && searchTerms.length > 1) {
        products = await fetchProducts();
      }

      matching = products.filter((product) => {
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
    }

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
  for (const { file, name, style } of PDF_FONTS) {
    const hasFamily = Object.prototype.hasOwnProperty.call(fontList, name);
    const hasStyle = hasFamily && Object.prototype.hasOwnProperty.call(fontList[name], style);

    if (hasStyle) {
      continue;
    }

    const data = fontData instanceof Map ? fontData.get(file) : undefined;
    if (typeof data === 'string' && data.length) {
      doc.addFileToVFS(file, data);
      try {
        doc.addFont(file, name, style, 'Identity-H');
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

// Alias używany w widoku Zamówienia
function formatPrice(value) {
  return formatCurrencyPlain(value);
}

function safeSplitText(doc, text, maxWidth) {
  if (!text) return [];
  const rawLines = doc.splitTextToSize(text, maxWidth) || [];
  return rawLines.map(line => line.replace(/[&]/g, ' ').trim()).filter(Boolean);
}

function setStatus(message, type = 'info', target = 'global') {
  const el = target === 'cart' ? cartStatus : statusMessage;
  if (!el) return;
  el.textContent = message;
  el.className = `status status--${type}`;
}

async function submitOrder() {
  try {
    // Walidacja: użytkownik
    if (!currentUser) {
      console.warn('[ORDER] Brak currentUser');
      setStatus('Musisz być zalogowany, aby wysłać zamówienie.', 'error', 'cart');
      return;
    }
    // Walidacja: klient
    if (!currentCustomer || !currentCustomer.id) {
      console.warn('[ORDER] Brak currentCustomer.id');
      setStatus('Wybierz klienta przed wysłaniem zamówienia.', 'error', 'cart');
      return;
    }

    // Walidacja: koszyk
    if (!cart || cart.size === 0) {
      console.warn('[ORDER] Koszyk pusty');
      setStatus('Koszyk jest pusty. Dodaj produkty przed wysłaniem zamówienia.', 'error', 'cart');
      return;
    }

    // Budowanie listy items
    const items = [];
    for (const [key, item] of cart.entries()) {
      // Sprawdź product.pc_id
      if (!item.product || !item.product.pc_id) {
        console.warn('[ORDER] Brak product.pc_id, pomijam:', item);
        continue;
      }

      // Sprawdź quantity
      const qty = Number(item.quantity);
      if (!qty || qty <= 0) {
        console.warn('[ORDER] quantity <= 0, pomijam:', item);
        continue;
      }

      const unitPrice = Number(item.product.price ?? 0);
      const selectedProjects = item.projects ?? '';
      const projectQuantities = Array.isArray(item.perProjectQuantities) && item.perProjectQuantities.length > 0
        ? JSON.stringify(item.perProjectQuantities)
        : null;

      items.push({
        productCode: item.product.pc_id,
        quantity: qty,
        unitPrice,
        selectedProjects,
        projectQuantities,
        quantitySource: item.quantitySource || 'total',  // Źródło prawdy: 'total' lub 'perProject'
        totalQuantity: qty,
        locationName: item.locationName || null,
        source: item.source || 'MIEJSCOWOSCI',
        productionNotes: item.itemNotes || null  // Uwagi produkcyjne do pozycji
      });
    }

    if (items.length === 0) {
      console.warn('[ORDER] Brak pozycji do wysłania');
      setStatus('W koszyku nie ma żadnych pozycji z dodatnią ilością.', 'error', 'cart');
      return;
    }

    setStatus('Wysyłam zamówienie…', 'info', 'cart');

    // Pobierz uwagi ogólne do zamówienia
    const orderGeneralNotesEl = document.getElementById('order-general-notes');
    const orderGeneralNotes = orderGeneralNotesEl ? orderGeneralNotesEl.value.trim() : null;

    const payload = {
      customerId: currentCustomer.id,
      notes: orderGeneralNotes || null,  // Uwagi ogólne do zamówienia
      items,
    };

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const message = result?.message || 'Nie udało się wysłać zamówienia.';
      setStatus(message, 'error', 'cart');
      console.error('[ORDER] Błąd wysyłki:', result || response.statusText);
      return;
    }

    const orderNumber = result?.data?.orderNumber;
    const total = result?.data?.total;

    setStatus(
      orderNumber
        ? `✅ Zamówienie wysłane! Numer: ${orderNumber}`
        : '✅ Zamówienie wysłane poprawnie.',
      'success',
      'cart'
    );

    // Wyczyść koszyk i pole uwag ogólnych
    cart.clear();
    renderCart();
    
    // Wyczyść pole uwag ogólnych
    if (orderGeneralNotesEl) {
      orderGeneralNotesEl.value = '';
    }

  } catch (error) {
    console.error('[ORDER] Wyjątek:', error);
    setStatus('Wystąpił błąd podczas wysyłania zamówienia.', 'error', 'cart');
  }
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
  
  
  // initGalleryZoom() jest wywoływana w initialize(), nie tutaj
  // const frame = galleryPreviewImage.parentElement;
  // if (frame && frame.classList.contains('gallery-preview__frame')) {
  //   initGalleryZoom(frame, galleryPreviewImage);
  // }
}

// Zaktualizuj przycisk ulubionych przy miejscowości (PM)
function updateCityFavoriteButton(cityName) {
  const favoriteBtn = document.getElementById('city-favorite-btn');
  if (!favoriteBtn) return;
  
  // Pokaż przycisk tylko dla zalogowanych użytkowników i gdy wybrano miejscowość
  if (!currentUser || !cityName) {
    favoriteBtn.style.display = 'none';
    return;
  }
  
  favoriteBtn.style.display = 'flex';
  favoriteBtn.dataset.itemId = cityName;
  favoriteBtn.dataset.cityName = cityName;
  
  // Zaktualizuj stan przycisku
  if (isFavorite('city', cityName)) {
    favoriteBtn.classList.add('is-favorite');
    favoriteBtn.innerHTML = '<i class="fas fa-star"></i>';
    favoriteBtn.title = 'Usuń z ulubionych';
  } else {
    favoriteBtn.classList.remove('is-favorite');
    favoriteBtn.innerHTML = '<i class="far fa-star"></i>';
    favoriteBtn.title = 'Dodaj do ulubionych';
  }
}

// Zaktualizuj przycisk ulubionych przy obiekcie (KI)
function updateObjectFavoriteButton(objectName) {
  const favoriteBtn = document.getElementById('object-favorite-btn');
  if (!favoriteBtn) return;
  
  // Pokaż przycisk tylko dla zalogowanych użytkowników i gdy wybrano obiekt
  if (!currentUser || !objectName) {
    favoriteBtn.style.display = 'none';
    return;
  }
  
  // Pobierz również handlowca, aby utworzyć unikalny identyfikator
  const salesperson = gallerySalespersonSelect?.value || '';
  const itemId = salesperson ? `${salesperson}/${objectName}` : objectName;
  
  favoriteBtn.style.display = 'flex';
  favoriteBtn.dataset.itemId = itemId;
  favoriteBtn.dataset.objectName = objectName;
  favoriteBtn.dataset.salesperson = salesperson;
  
  // Zaktualizuj stan przycisku
  if (isFavorite('ki_object', itemId)) {
    favoriteBtn.classList.add('is-favorite');
    favoriteBtn.innerHTML = '<i class="fas fa-star"></i>';
    favoriteBtn.title = 'Usuń z ulubionych';
  } else {
    favoriteBtn.classList.remove('is-favorite');
    favoriteBtn.innerHTML = '<i class="far fa-star"></i>';
    favoriteBtn.title = 'Dodaj do ulubionych';
  }
}

// Renderuj pasek ulubionych (PM: miejscowości, KI: obiekty)
function renderFavoritesBar() {
  const favoritesBar = document.getElementById('favorites-bar');
  const favoritesBarItems = document.getElementById('favorites-bar-items');
  
  if (!favoritesBar || !favoritesBarItems) return;
  
  // Pobierz aktualny tryb (PM/KI)
  const isKIMode = currentFormMode === 'klienci-indywidualni';
  
  // Filtruj ulubione według typu (city dla PM, ki_object dla KI)
  const typeFilter = isKIMode ? 'ki_object' : 'city';
  const filteredFavorites = userFavorites.filter(f => f.type === typeFilter);
  
  if (filteredFavorites.length === 0) {
    favoritesBar.classList.remove('has-favorites');
    favoritesBarItems.innerHTML = '';
    return;
  }
  
  favoritesBar.classList.add('has-favorites');
  
  favoritesBarItems.innerHTML = filteredFavorites.map(fav => {
    // Dla KI: item_id to "handlowiec/obiekt", wyświetlamy tylko nazwę obiektu
    const rawDisplayName = fav.name || (isKIMode ? (fav.item_id || '').split('/').pop() : fav.item_id);
    const displayNameSafe = escapeHtml(rawDisplayName || '');
    const itemIdSafe = escapeHtml(fav.item_id || '');
    const typeSafe = escapeHtml(fav.type || '');
    const favIdSafe = escapeHtml(String(fav.id));
    const titleSafe = escapeHtml(`Kliknij aby wybrać ${rawDisplayName || ''}`);
    const removeTitleSafe = escapeHtml('Usuń z ulubionych');
    return `
    <span class="favorites-bar__item" data-item-id="${itemIdSafe}" data-type="${typeSafe}" title="${titleSafe}">
      <i class="fas fa-star"></i>
      ${displayNameSafe}
      <button class="favorites-bar__remove" data-favorite-id="${favIdSafe}" title="${removeTitleSafe}">×</button>
    </span>
  `;
  }).join('');
  
  // Dodaj event listenery do elementów
  favoritesBarItems.querySelectorAll('.favorites-bar__item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.classList.contains('favorites-bar__remove')) return;
      
      const itemId = item.dataset.itemId;
      const type = item.dataset.type;
      
      if (type === 'city' && galleryCitySelect) {
        // Tryb PM - wybierz miejscowość
        galleryCitySelect.value = itemId;
        galleryCitySelect.dispatchEvent(new Event('change'));
      } else if (type === 'ki_object') {
        // Tryb KI - wybierz handlowca i obiekt
        const parts = itemId.split('/');
        if (parts.length === 2) {
          const [salesperson, objectName] = parts;
          if (gallerySalespersonSelect && galleryObjectSelect) {
            // Ustaw handlowca
            gallerySalespersonSelect.value = salesperson;
            
            // Załaduj obiekty i poczekaj na zakończenie
            const objects = await loadObjectsForSalesperson(salesperson);
            
            // Jeśli obiekt istnieje na liście, wybierz go
            if (objects.includes(objectName)) {
              galleryObjectSelect.value = objectName;
              // Załaduj produkty dla tego obiektu
              loadGalleryProductsForObject(salesperson, objectName);
              // Zaktualizuj przycisk ulubionych
              updateObjectFavoriteButton(objectName);
            }
          }
        }
      }
    });
  });
  
  // Dodaj event listenery do przycisków usuwania
  const removeButtons = favoritesBarItems.querySelectorAll('.favorites-bar__remove');
  removeButtons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const favoriteId = btn.dataset.favoriteId;
      await removeFromFavorites(favoriteId);
      renderFavoritesBar();
      
      // Zaktualizuj gwiazdkę przy aktualnie wybranym elemencie
      if (currentFormMode === 'klienci-indywidualni') {
        const currentObject = galleryObjectSelect?.value;
        if (currentObject) {
          updateObjectFavoriteButton(currentObject);
        }
      } else {
        const currentCity = galleryCitySelect?.value;
        if (currentCity) {
          updateCityFavoriteButton(currentCity);
        }
      }
    });
  });
}

function resetResultsPlaceholder(text = 'Brak wyników do wyświetlenia.') {
  const safeText = escapeHtml(text);
  resultsBody.innerHTML = `
    <tr class="table__placeholder">
      <td colspan="7">${safeText}</td>
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

let masterProductsCache = null;

async function ensureMasterProductsLoaded() {
  if (Array.isArray(masterProductsCache)) {
    return masterProductsCache;
  }
  try {
    const products = await fetchProducts();
    masterProductsCache = Array.isArray(products) ? products : [];
  } catch (error) {
    console.error('Błąd ładowania pełnej listy produktów do sortowania galerii:', error);
    masterProductsCache = [];
  }
  return masterProductsCache;
}

function getMasterFlagsForLabel(label) {
  if (!Array.isArray(masterProductsCache) || !masterProductsCache.length) {
    return { isNew: false, isAvailable: false };
  }

  const targetNorm = normalizeForMatching(label);
  if (!targetNorm) {
    return { isNew: false, isAvailable: false };
  }

  const targetTokens = targetNorm.split(' ').filter(Boolean);
  let fallbackMatch = null;

  for (const product of masterProductsCache) {
    if (!product) continue;
    const nameNorm = normalizeForMatching(product.name);
    if (!nameNorm) continue;

    // 1) Dokładne dopasowanie po znormalizowanej nazwie
    if (nameNorm === targetNorm) {
      const isNew = !!product.new;
      const isAvailable = (product.isActive !== false) && Number(product.stock || 0) > 0;
      return { isNew, isAvailable };
    }

    // 2) Luźniejsze dopasowanie – wszystkie tokeny nazwy produktu zawierają się w etykiecie
    if (!fallbackMatch && targetTokens.length) {
      const nameTokens = nameNorm.split(' ').filter(Boolean);
      const allTokensInTarget = nameTokens.every((t) => targetTokens.includes(t));
      if (allTokensInTarget) {
        fallbackMatch = product;
      }
    }
  }

  if (fallbackMatch) {
    const isNew = !!fallbackMatch.new;
    const isAvailable = (fallbackMatch.isActive !== false) && Number(fallbackMatch.stock || 0) > 0;
    return { isNew, isAvailable };
  }

  return { isNew: false, isAvailable: false };
}

async function searchProducts(event) {
  event.preventDefault();
  const mode = document.querySelector('#mode').value;
  const query = document.querySelector('#query').value.trim();
  const exactMatch = document.querySelector('#exact-match-toggle')?.checked || false;

  if (!query) {
    setStatus('Podaj frazę wyszukiwania.', 'error');
    return;
  }

  setStatus('Wyszukiwanie produktów...', 'info');
  resetResultsPlaceholder('Trwa pobieranie danych...');

  try {
    const searchTerms = tokenizeQuery(query);
    const normalizedQuery = normalizeForMatching(query);

    if (!searchTerms.length) {
      setStatus('Nieprawidłowe zapytanie wyszukiwania.', 'error');
      return;
    }

    let products = await fetchProducts(query);

    if (!products.length && (searchTerms.length > 1 || exactMatch)) {
      products = await fetchProducts();
    }

    const filteredProducts = products.filter(product => {
      if (!product) return false;

      // Tryb dokładnego dopasowania: licz słowa niezależnie od kolejności,
      // pozwalając na dopasowanie prefiksów ("mag" -> "magnes")
      if (exactMatch) {
        const targetValue = mode === 'pc_id' ? product.pc_id : product.name;
        const targetTokens = tokenizeQuery(targetValue);

        if (targetTokens.length !== searchTerms.length) {
          return false;
        }

        const availableTokens = [...targetTokens];
        return searchTerms.every(term => {
          const idx = availableTokens.findIndex(token => token.startsWith(term));
          if (idx === -1) return false;
          availableTokens.splice(idx, 1);
          return true;
        });
      }

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
    const slugFromMapping = findGallerySlugForProducts([product]);
    let hasProject = Boolean(slugFromMapping);

    if (!hasProject) {
      const slugsForProduct = findGallerySlugsByName(product.name);
      hasProject = slugsForProduct.length > 0;
    }
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
    const productNameSafe = escapeHtml(product.name ?? '-');
    const productIdSafe = escapeHtml(product.pc_id || '');
    const priceText = formatCurrency(product.price);
    const priceSafe = escapeHtml(priceText);
    row.innerHTML = `
      <td class="product-identifiers">
        <div class="product-name">${productNameSafe}</div>
        <div class="product-id">${productIdSafe}</div>
      </td>
      <td class="projects-cell">
        <div class="projects-field">
          <label class="projects-field__label">Nr projektów</label>
          <input type="text" class="projects-input" placeholder="1-5,7" inputmode="numeric" pattern="[0-9,\-\s]*" />
        </div>
        <div class="projects-field">
          <label class="projects-field__label">Ilości na proj.</label>
          <input type="text" class="qty-per-project-input-results" placeholder="po 20" />
        </div>
      </td>
      <td class="price-column">${priceSafe}</td>
      <td class="stock-cell">${createBadge(product.stock, product.stock_optimal)}</td>
      <td class="qty-cell">
        <input type="number" class="qty-input" value="1" min="1" ${product.stock > 0 ? '' : 'disabled'} title="Łącznie szt." />
      </td>
      <td class="notes-cell">
        <div class="notes-cell__wrapper">
          <textarea class="item-notes-input" placeholder="Uwagi..." title="Uwagi produkcyjne"></textarea>
        </div>
      </td>
      <td>
        <button type="button" class="btn btn--primary btn--sm" ${product.stock > 0 ? '' : 'disabled'}>Dodaj</button>
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
    const qtyPerProjectInput = row.querySelector('.qty-per-project-input-results');
    const itemNotesInput = row.querySelector('.item-notes-input');
    const qtyPreviewContainer = document.createElement('div');
    qtyPreviewContainer.className = 'qty-preview-results';
    const previewRow = document.createElement('tr');
    previewRow.className = 'results-preview-row';
    previewRow.style.display = 'none';
    const previewCell = document.createElement('td');
    previewCell.colSpan = 7;
    previewCell.appendChild(qtyPreviewContainer);
    previewRow.appendChild(previewCell);

    const hideQtyPreview = () => {
      qtyPreviewContainer.innerHTML = '';
      previewRow.style.display = 'none';
      qtyPreviewContainer.removeAttribute('data-variant');
    };

    const showQtyPreview = (message, variant = 'success') => {
      qtyPreviewContainer.innerHTML = `<span class="qty-preview-message qty-preview-message--${variant}">${message}</span>`;
      qtyPreviewContainer.setAttribute('data-variant', variant);
      previewRow.style.display = '';
    };

    const addBtn = row.querySelector('button');

    // --- Walidacja projektów ---
    projectsInput.addEventListener('input', () => {
      projectsInput.value = projectsInput.value.replace(/[^0-9,\-\s]/g, '');
    });

    projectsInput.addEventListener('blur', () => {
      const value = projectsInput.value.trim();
      if (!value) {
        projectsInput.value = '';
        hideQtyPreview();
        return;
      }

      if (!isValidProjectInput(value)) {
        showQtyPreview('❌ Podaj poprawny zakres: np. 1-5,7. Użyj tylko liczb, przecinków i myślników.', 'error');
        projectsInput.focus();
        return;
      }

      projectsInput.value = sanitizeProjectsValue(value);
      hideQtyPreview();
    });

    // --- Funkcje pomocnicze dla dwukierunkowej logiki ---

    const formatPerProjectPreview = (result) => {
      return result.perProjectQuantities
        .map(p => `Proj. ${p.projectNo}: ${p.qty}`)
        .join(' | ');
    };

    // Na podstawie total + projektów zbuduj listę np. 16 -> 6,5,5
    const buildPerProjectListFromTotal = () => {
      const projectsValue = projectsInput.value.trim();
      const totalValue = parseInt(qtyInput.value, 10);
      if (!projectsValue || !Number.isFinite(totalValue) || totalValue <= 0) {
        hideQtyPreview();
        return;
      }

      const result = computePerProjectQuantities(projectsValue, totalValue, '');
      if (!result.success) {
        showQtyPreview(`❌ ${result.error}`, 'error');
        return;
      }

      // Wpisujemy dokładną listę do pola B
      const list = result.perProjectQuantities.map(p => p.qty).join(',');
      qtyPerProjectInput.value = list;

      const preview = formatPerProjectPreview(result);
      showQtyPreview(`✓ Łącznie: ${result.totalQuantity} | ${preview}`, 'success');
    };

    // Na podstawie pola B (po X lub lista) przelicz total + podgląd
    const buildTotalFromPerProject = () => {
      const projectsValue = projectsInput.value.trim();
      const perValue = qtyPerProjectInput.value.trim();

      if (!perValue) {
        hideQtyPreview();
        return;
      }

      if (!projectsValue) {
        showQtyPreview('⚠️ Wpisz numery projektów', 'warning');
        return;
      }

      const result = computePerProjectQuantities(projectsValue, '', perValue);

      if (!result.success) {
        showQtyPreview(`❌ ${result.error}`, 'error');
        return;
      }

      qtyInput.value = result.totalQuantity;
      const preview = formatPerProjectPreview(result);
      showQtyPreview(`✓ Łącznie: ${result.totalQuantity} | ${preview}`, 'success');
    };

    // Flagi: które pole było faktycznie edytowane przez użytkownika
    let qtyInputDirty = false;        // pole ILOŚĆ
    let qtyPerProjectDirty = false;   // pole ILOŚCI NA PROJEKT

    qtyInput.addEventListener('input', () => {
      qtyInputDirty = true;
      qtyPerProjectDirty = false; // przełączamy się na tryb "suma jako źródło"
      qtyPerProjectInput.value = '';
      hideQtyPreview();
    });

    qtyInput.addEventListener('blur', () => {
      // Jeśli użytkownik tylko wszedł TAB-em i nic nie zmienił, nie przeliczamy rozkładu
      if (!qtyInputDirty) {
        return;
      }

      qtyInputDirty = false;

      if (!qtyInput.value.trim()) {
        qtyPerProjectInput.value = '';
        hideQtyPreview();
        return;
      }
      buildPerProjectListFromTotal();
    });

    // Pisanie w B czyści A, zapamiętujemy że to projekty są źródłem
    qtyPerProjectInput.addEventListener('input', () => {
      qtyPerProjectDirty = true;
      qtyInput.value = '';
      hideQtyPreview();
    });

    qtyPerProjectInput.addEventListener('blur', () => {
      if (!qtyPerProjectInput.value.trim()) {
        hideQtyPreview();
        return;
      }
      buildTotalFromPerProject();
    });

    addBtn.addEventListener('click', () => {
      const projectsValue = projectsInput.value.trim();
      const qtyTotalValue = parseInt(qtyInput.value, 10);
      const qtyPerProjectValue = qtyPerProjectInput.value.trim();
      const itemNotesValue = itemNotesInput.value.trim();

      if (projectsValue && !isValidProjectInput(projectsValue)) {
        showQtyPreview('❌ Podaj poprawny zakres: np. 1-5,7. Użyj tylko liczb, przecinków i myślników.', 'error');
        projectsInput.focus();
        return;
      }

      // Jeśli w polu B jest coś wpisane
      if (qtyPerProjectValue) {
        const normalizedProjects = sanitizeProjectsValue(projectsValue);

        // Przypadek 1: użytkownik ręcznie edytował pole B -> źródło to projekty
        if (qtyPerProjectDirty) {
          const result = computePerProjectQuantities(normalizedProjects, qtyTotalValue, qtyPerProjectValue);
          
          if (!result.success) {
            showQtyPreview(`❌ ${result.error}`, 'error');
            qtyPerProjectInput.focus();
            return;
          }

          result.quantityInputPerProject = qtyPerProjectValue;
          result.quantitySource = 'perProject';
          addToCartWithQuantityBreakdown(product, result, itemNotesValue);
        }
        // Przypadek 2: pole B zostało automatycznie wyliczone z A -> źródło to suma
        else {
          const result = computePerProjectQuantities(normalizedProjects, qtyTotalValue, '');

          if (!result.success) {
            showQtyPreview(`❌ ${result.error}`, 'error');
            return;
          }

          // Zapisz listę ilości na projekty do wyświetlenia
          result.quantityInputPerProject = result.perProjectQuantities
            .map(p => p.qty)
            .join(',');
          result.quantitySource = 'total';
          addToCartWithQuantityBreakdown(product, result, itemNotesValue);
        }
      } else {
        // Zwykłe dodanie bez rozkładu
        const quantity = Number.isFinite(qtyTotalValue) && qtyTotalValue > 0 ? qtyTotalValue : 1;
        const normalizedProjects = sanitizeProjectsValue(projectsValue);
        addToCart(product, quantity, normalizedProjects, itemNotesValue);
      }

      // Czyszczenie pól po dodaniu
      projectsInput.value = '';
      qtyInput.value = '1';
      qtyPerProjectInput.value = '';
      itemNotesInput.value = '';
      hideQtyPreview();
    });

    row.addEventListener('click', () => {
      setSelectedResultsRow(row);
      handleResultProductSelection(product);
    });

    resultsBody.appendChild(row);
    resultsBody.appendChild(previewRow);
  });
}

function addToCart(product, quantity, projects, itemNotes = '') {
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
  const currentNotes = itemNotes || entry?.itemNotes || '';

  // Pobierz nazwę lokalizacji i źródło w zależności od trybu
  let locationName = null;
  let source = 'MIEJSCOWOSCI';
  
  if (currentFormMode === 'projekty-miejscowosci' && galleryCitySelect) {
    locationName = galleryCitySelect.value || null;
    source = 'MIEJSCOWOSCI';
  } else if (currentFormMode === 'klienci-indywidualni' && galleryObjectSelect) {
    locationName = galleryObjectSelect.value || null;
    source = 'KATALOG_INDYWIDUALNY';
  }

  // Automatycznie oblicz rozkład na projekty jeśli są projekty i ilość
  let perProjectQuantities = [];
  let quantityInputPerProject = '';
  if (currentProjects && newQty > 0) {
    const result = computePerProjectQuantities(currentProjects, newQty, '');
    if (result.success && result.perProjectQuantities.length > 0) {
      perProjectQuantities = result.perProjectQuantities;
      quantityInputPerProject = perProjectQuantities.map(p => p.qty).join(',');
    }
  }

  cart.set(key, { 
    product, 
    quantity: newQty, 
    projects: currentProjects,
    quantityInputTotal: String(newQty),  // Pole A: łącznie sztuk
    quantityInputPerProject: quantityInputPerProject,  // Pole B: ilości na projekty
    perProjectQuantities: perProjectQuantities,  // Rozkład na projekty
    quantitySource: 'total',  // Źródło prawdy: 'total' (suma) lub 'perProject' (ilości na projekt)
    locationName,  // Nazwa miejscowości (PM) lub obiektu KI
    source,  // 'MIEJSCOWOSCI' lub 'KATALOG_INDYWIDUALNY'
    itemNotes: currentNotes  // Uwagi do pozycji
  });
  renderCart();
  setStatus(`Dodano produkt ${product.name} do koszyka.`, 'success');
}

function addToCartWithQuantityBreakdown(product, computeResult, itemNotes = '') {
  const stock = product.stock ?? 0;
  if (stock <= 0) {
    setStatus(`Produkt ${product.name} jest niedostępny.`, 'error');
    return;
  }

  const key = product._id;
  const entry = cart.get(key);
  const { totalQuantity, perProjectQuantities, mode, quantityInputPerProject } = computeResult;
  const currentNotes = itemNotes || entry?.itemNotes || '';

  // Pobierz nazwę lokalizacji i źródło w zależności od trybu
  let locationName = null;
  let source = 'MIEJSCOWOSCI';
  
  if (currentFormMode === 'projekty-miejscowosci' && galleryCitySelect) {
    locationName = galleryCitySelect.value || null;
    source = 'MIEJSCOWOSCI';
  } else if (currentFormMode === 'klienci-indywidualni' && galleryObjectSelect) {
    locationName = galleryObjectSelect.value || null;
    source = 'KATALOG_INDYWIDUALNY';
  }

  // Określ źródło prawdy na podstawie mode z computeResult
  const quantitySource = mode === 'total' ? 'total' : 'perProject';

  cart.set(key, { 
    product, 
    quantity: totalQuantity, 
    projects: computeResult.projects?.join(',') || '',
    quantityInputTotal: mode === 'total' ? String(totalQuantity) : '',
    quantityInputPerProject: quantityInputPerProject || '',
    perProjectQuantities: perProjectQuantities,
    quantitySource,  // Źródło prawdy: 'total' lub 'perProject'
    locationName,  // Nazwa miejscowości (PM) lub obiektu KI
    source,  // 'MIEJSCOWOSCI' lub 'KATALOG_INDYWIDUALNY'
    itemNotes: currentNotes  // Uwagi do pozycji
  });
  renderCart();
  setStatus(`Dodano produkt ${product.name} do koszyka (rozkład na projekty).`, 'success');
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
  const rowsHtml = [];
  
  Array.from(cart.entries()).forEach(([id, { 
    product, 
    quantity, 
    projects = '',
    quantityInputTotal = '',
    quantityInputPerProject = '',
    perProjectQuantities = [],
    quantitySource = 'total',
    itemNotes = ''
  }]) => {
    const price = Number(product.price ?? 0);
    const lineTotal = price * quantity;
    total += lineTotal;

    // Wylicz wartość pola "Ilości na projekt" - jeśli jest rozkład, pokaż go jako listę
    let qtyPerProjectDisplay = quantityInputPerProject || '';
    if (!qtyPerProjectDisplay && perProjectQuantities && perProjectQuantities.length > 0) {
      // Jeśli nie ma wpisanej wartości, ale jest rozkład - pokaż ilości jako listę
      qtyPerProjectDisplay = perProjectQuantities.map(p => p.qty).join(',');
    }

    // Klasy CSS dla oznaczenia źródła prawdy
    const qtySourceClass = quantitySource === 'perProject' ? 'qty-source-per-project' : 'qty-source-total';
    const qtyInputClass = quantitySource === 'total' ? 'qty-source-highlight' : '';
    const perProjectInputClass = quantitySource === 'perProject' ? 'qty-source-highlight' : '';

    const productNameSafe = escapeHtml(product.name ?? '-');
    const productIdSafe = escapeHtml(product.pc_id || '');
    const projectsSafe = escapeHtml(projects || '');
    const qtyPerProjectDisplaySafe = escapeHtml(qtyPerProjectDisplay || '');
    const itemNotesSafe = escapeHtml(itemNotes || '');
    const lineTotalText = formatCurrency(lineTotal);
    const lineTotalSafe = escapeHtml(lineTotalText);

    // Główny wiersz
    rowsHtml.push(`
      <tr data-id="${id}" class="${qtySourceClass}">
        <td class="product-identifiers" title="${productNameSafe}">
          <div class="product-name">${productNameSafe}</div>
          <div class="product-id">${productIdSafe}</div>
        </td>
        <td class="cart-projects-col">
          <input type="text" class="projects-input" value="${projectsSafe}" placeholder="1-5,7" data-id="${id}" inputmode="numeric" pattern="[0-9,\-\s]*" title="Nr projektów" />
          <input type="text" class="qty-per-project-input ${perProjectInputClass}" value="${qtyPerProjectDisplaySafe}" placeholder="po 20" data-id="${id}" title="Ilości na projekty: po X lub lista 10,20,30" />
        </td>
        <td>
          <input type="number" class="qty-input ${qtyInputClass}" value="${quantity}" min="1" data-id="${id}" title="Łączna ilość" />
        </td>
        <td class="cart-notes-cell">
          <textarea class="cart-notes-input" data-id="${id}" placeholder="Uwagi do pozycji..." title="Uwagi produkcyjne">${itemNotesSafe}</textarea>
        </td>
        <td class="price-cell">${lineTotalSafe}</td>
        <td class="cart-actions-cell">
          <button type="button" class="btn btn--danger btn--sm remove-from-cart" data-id="${id}">Usuń</button>
        </td>
      </tr>
    `);
  });

  cartBody.innerHTML = rowsHtml.join('');

  const qtyInputs = cartBody.querySelectorAll('.qty-input');
  const projectsInputs = cartBody.querySelectorAll('.projects-input');
  const qtyPerProjectInputs = cartBody.querySelectorAll('.qty-per-project-input');
  const removeBtns = cartBody.querySelectorAll('.remove-from-cart');

  // Obsługa pola ilości (A) - edycja przelicza rozkład na projekty
  qtyInputs.forEach(qtyInput => {
    qtyInput.addEventListener('blur', () => {
      const id = qtyInput.dataset.id;
      const value = parseInt(qtyInput.value, 10);
      const entry = cart.get(id);
      if (!entry) return;
      
      const stock = entry?.product?.stock ?? Infinity;

      if (!Number.isFinite(value) || value < 1) {
        qtyInput.value = entry?.quantity ?? 1;
        return;
      }

      if (value > stock) {
        qtyInput.value = stock;
        cart.set(id, { 
          ...entry, 
          quantity: stock,
          quantityInputPerProject: '',
          perProjectQuantities: []
        });
        renderCart();
        return;
      }

      // Jeśli są projekty, przelicz rozkład
      const projectsStr = entry.projects || '';
      if (projectsStr && value > 0) {
        const result = computePerProjectQuantities(projectsStr, value, '');
        if (result.success) {
          // Zapisz wyliczone ilości jako listę (np. "14,13,13")
          const qtyList = result.perProjectQuantities.map(p => p.qty).join(',');
          cart.set(id, { 
            ...entry, 
            quantity: value,
            quantityInputPerProject: qtyList,
            perProjectQuantities: result.perProjectQuantities,
            quantitySource: 'total'  // Edycja sumy = źródło to suma
          });
        } else {
          cart.set(id, { 
            ...entry, 
            quantity: value,
            quantityInputPerProject: '',
            perProjectQuantities: [],
            quantitySource: 'total'
          });
        }
      } else {
        cart.set(id, { 
          ...entry, 
          quantity: value,
          quantityInputPerProject: '',
          perProjectQuantities: [],
          quantitySource: 'total'
        });
      }
      renderCart();
    });
  });

  // Obsługa pola projektów - walidacja i przeliczenie
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
        cart.set(id, { ...entry, projects: '', quantityInputPerProject: '', perProjectQuantities: [] });
        renderCart();
        return;
      }

      if (!isValidProjectInput(value)) {
        setStatus('Podaj poprawny zakres numerów projektów: np. 1-5,7. Użyj tylko liczb, przecinków i myślników.', 'error', 'cart');
        projectsInput.value = entry.projects ?? '';
        return;
      }

      const normalized = sanitizeProjectsValue(value);
      const totalQty = entry.quantity || 0;
      const oldPerProject = entry.perProjectQuantities || [];
      
      // Parsuj nowe numery projektów
      const newProjectNumbers = parseProjects(normalized);
      
      if (newProjectNumbers.length === 0) {
        cart.set(id, { ...entry, projects: normalized, quantityInputPerProject: '', perProjectQuantities: [] });
        renderCart();
        return;
      }
      
      // Inteligentne przeliczanie - zachowaj istniejące ilości, dodaj nowe projekty
      if (oldPerProject.length > 0 && totalQty > 0) {
        // Mapa starych ilości: projectNo -> qty
        const oldQtyMap = new Map(oldPerProject.map(p => [p.projectNo, p.qty]));
        
        // Oblicz ile zostało do rozdzielenia na nowe projekty
        const existingProjects = newProjectNumbers.filter(pn => oldQtyMap.has(pn));
        const newProjects = newProjectNumbers.filter(pn => !oldQtyMap.has(pn));
        
        let newPerProjectQuantities = [];
        
        if (newProjects.length > 0) {
          // Są nowe projekty - rozdziel pozostałą ilość
          const usedQty = existingProjects.reduce((sum, pn) => sum + (oldQtyMap.get(pn) || 0), 0);
          const remainingQty = Math.max(0, totalQty - usedQty);
          const qtyPerNewProject = newProjects.length > 0 ? Math.floor(remainingQty / newProjects.length) : 0;
          const extraQty = remainingQty - (qtyPerNewProject * newProjects.length);
          
          // Zachowaj stare ilości dla istniejących projektów
          existingProjects.forEach(pn => {
            newPerProjectQuantities.push({ projectNo: pn, qty: oldQtyMap.get(pn) });
          });
          
          // Dodaj nowe projekty z rozdzieloną ilością
          newProjects.forEach((pn, idx) => {
            const qty = qtyPerNewProject + (idx < extraQty ? 1 : 0);
            newPerProjectQuantities.push({ projectNo: pn, qty });
          });
          
          // Posortuj po numerze projektu
          newPerProjectQuantities.sort((a, b) => a.projectNo - b.projectNo);
        } else {
          // Tylko istniejące projekty (może usunięto niektóre)
          existingProjects.forEach(pn => {
            newPerProjectQuantities.push({ projectNo: pn, qty: oldQtyMap.get(pn) });
          });
          newPerProjectQuantities.sort((a, b) => a.projectNo - b.projectNo);
        }
        
        const newTotal = newPerProjectQuantities.reduce((sum, p) => sum + p.qty, 0);
        const qtyList = newPerProjectQuantities.map(p => p.qty).join(',');
        
        cart.set(id, { 
          ...entry, 
          projects: normalized,
          quantity: newTotal,
          quantityInputPerProject: qtyList,
          perProjectQuantities: newPerProjectQuantities
        });
      } else if (totalQty > 0) {
        // Brak starych danych - przelicz z sumy
        const result = computePerProjectQuantities(normalized, totalQty, '');
        if (result.success) {
          const qtyList = result.perProjectQuantities.map(p => p.qty).join(',');
          cart.set(id, { 
            ...entry, 
            projects: normalized,
            quantityInputPerProject: qtyList,
            perProjectQuantities: result.perProjectQuantities
          });
        } else {
          cart.set(id, { ...entry, projects: normalized });
        }
      } else {
        cart.set(id, { ...entry, projects: normalized });
      }
      renderCart();
    });
  });

  // Obsługa pola "po X" (B) - przelicza sumę automatycznie
  qtyPerProjectInputs.forEach(qtyPerProjectInput => {
    qtyPerProjectInput.addEventListener('blur', () => {
      const id = qtyPerProjectInput.dataset.id;
      const entry = cart.get(id);
      if (!entry) return;

      const projectsStr = entry.projects || '';
      const perProjectQtyStr = qtyPerProjectInput.value.trim();

      // Jeśli puste, czyścimy
      if (!perProjectQtyStr) {
        cart.set(id, { 
          ...entry,
          quantityInputPerProject: '',
          perProjectQuantities: []
        });
        renderCart();
        return;
      }

      // Sprawdź czy są projekty
      if (!projectsStr) {
        setStatus('Wpisz najpierw numery projektów w kolumnie "Nr projektów / Ilości na proj."', 'error', 'cart');
        qtyPerProjectInput.value = entry.quantityInputPerProject || '';
        return;
      }

      // Obliczamy rozkład - ignorujemy starą sumę, liczymy nową z "po X" lub listy
      const result = computePerProjectQuantities(projectsStr, '', perProjectQtyStr);

      if (!result.success) {
        setStatus(result.error, 'error', 'cart');
        qtyPerProjectInput.value = entry.quantityInputPerProject || '';
        return;
      }

      // Zapisujemy wynik - jeśli to "po X", zamień na listę ilości
      const qtyList = result.perProjectQuantities.map(p => p.qty).join(',');
      const newEntry = { 
        ...entry,
        quantity: result.totalQuantity,
        quantityInputPerProject: qtyList,
        perProjectQuantities: result.perProjectQuantities,
        quantitySource: 'perProject'  // Edycja ilości na projekt = źródło to ilości
      };
      cart.set(id, newEntry);
      
      renderCart();
    });
  });

  removeBtns.forEach(removeBtn => {
    removeBtn.addEventListener('click', () => {
      cart.delete(removeBtn.dataset.id);
      renderCart();
    });
  });

  // Obsługa pola uwag do pozycji
  const notesInputs = cartBody.querySelectorAll('.cart-notes-input');
  notesInputs.forEach(notesInput => {
    notesInput.addEventListener('input', () => {
      const id = notesInput.dataset.id;
      const entry = cart.get(id);
      if (!entry) return;

      cart.set(id, { 
        ...entry,
        itemNotes: notesInput.value.trim()
      });
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
    doc.setFontSize(9);
    addText('Lp.', 15, 50);
    addText('Nazwa produktu', 25, 50);
    addText('Lokalizacja', 95, 50);
    addText('Ilość', 140, 50, { align: 'right' });
    addText('Cena', 162, 50, { align: 'right' });
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
    
    // Sprawdź czy są mieszane źródła (PM + KI)
    const allSources = cartItems.map(([_, item]) => item.source).filter(Boolean);
    const uniqueSources = new Set(allSources);
    const showSourceBadge = uniqueSources.size > 1;
    
    // Mapowanie źródeł na skróty
    const SOURCE_LABELS_PDF = {
      MIEJSCOWOSCI: 'PM',
      KATALOG_INDYWIDUALNY: 'KI',
      KLIENCI_INDYWIDUALNI: 'KI',
      IMIENNE: 'Im',
      HASLA: 'H',
      OKOLICZNOSCIOWE: 'Ok'
    };
    
    // Dane produktów
    const startY = 60;
    let currentY = startY;
    let total = 0;
    
    // Rysowanie listy produktów w kolejności z koszyka
    cartItems.forEach(([index, { product, quantity, locationName, source }], i) => {
      const productTotal = product.price * quantity;
      total += productTotal;
      
      // Nowa strona jeśli zabraknie miejsca
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }
      
      // Numer porządkowy
      setFont('normal');
      doc.setFontSize(9);
      addText((i + 1) + '.', 15, currentY);
      
      // Nazwa produktu z zawijaniem tekstu
      const maxNameWidth = 60; // Maksymalna szerokość nazwy w mm (zmniejszona dla lokalizacji)
      const lineHeight = 4; // Wysokość linii w mm
      
      // Przygotuj nazwę produktu - usuń podwójne spacje i przyciąć białe znaki
      const cleanName = (product.name || '').replace(/\s+/g, ' ').trim();
      
      // Podziel nazwę na linie, aby zmieściła się w dostępnej przestrzeni
      const nameLines = safeSplitText(doc, cleanName, maxNameWidth);
      
      // Narysuj każdą linię nazwy
      nameLines.forEach((line, lineIndex) => {
        addText(line.trim(), 25, currentY + (lineIndex * lineHeight));
      });
      
      // ID produktu (mniejszą czcionką pod nazwą)
      if (product.pc_id) {
        doc.setFontSize(7);
        setFont('normal');
        doc.setTextColor(100);
        addText(`ID: ${product.pc_id}`, 25, currentY + (nameLines.length * lineHeight) + 1);
      }

      // Lokalizacja (PM: miejscowość, KI: obiekt) z opcjonalnym badge'em źródła
      setFont('normal');
      doc.setFontSize(8);
      doc.setTextColor(80);
      
      // Dodaj prefix [PM] lub [KI] tylko gdy są mieszane źródła
      const sourcePrefix = showSourceBadge && source ? `[${SOURCE_LABELS_PDF[source] || source}] ` : '';
      const locationDisplay = sourcePrefix + (locationName || '-');
      
      // Skróć lokalizację jeśli za długa
      const maxLocWidth = 40;
      const locLines = safeSplitText(doc, locationDisplay, maxLocWidth);
      locLines.slice(0, 2).forEach((line, lineIndex) => {
        addText(line.trim(), 95, currentY + (lineIndex * lineHeight));
      });

      // Ilość i ceny
      setFont('normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      
      // Oblicz wysokość dla wielolinijkowej nazwy produktu
      const nameHeight = nameLines.length * lineHeight + (product.pc_id ? 5 : 0);
      const contentHeight = Math.max(nameHeight, 8); // Minimalna wysokość wiersza
      
      // Wyśrodkuj ilość i ceny względem całego wiersza
      const textY = currentY + (contentHeight / 2) - 2;
      
      // Wyświetl ilość, cenę i wartość
      addText(quantity.toString(), 140, textY, { align: 'right' });
      addText(formatCurrencyPlain(product.price), 162, textY, { align: 'right' });
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

  // Przycisk eksportu JSON – tymczasowo bez akcji (funkcja handleExportJson została usunięta)
  // if (exportBtn) {
  //   exportBtn.addEventListener('click', handleExportJson);
  // }

  if (submitOrderBtn) {
    submitOrderBtn.addEventListener('click', submitOrder);
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
  
  // Inicjalizacja przycisku ulubionych przy miejscowości (PM)
  const cityFavoriteBtn = document.getElementById('city-favorite-btn');
  if (cityFavoriteBtn) {
    cityFavoriteBtn.addEventListener('click', async () => {
      const type = cityFavoriteBtn.dataset.type;
      const cityName = cityFavoriteBtn.dataset.cityName;
      
      if (!type || !cityName) return;
      
      if (isFavorite(type, cityName)) {
        // Znajdź ID ulubionego i usuń
        const favorite = userFavorites.find(f => f.type === type && f.item_id === cityName);
        if (favorite) {
          await removeFromFavorites(favorite.id);
        }
      } else {
        // Dodaj do ulubionych
        await addToFavorites(type, cityName, cityName);
      }
      
      // Zaktualizuj UI
      updateCityFavoriteButton(cityName);
      renderFavoritesBar();
    });
  }
  
  // Inicjalizacja przycisku ulubionych przy obiekcie (KI)
  const objectFavoriteBtn = document.getElementById('object-favorite-btn');
  if (objectFavoriteBtn) {
    objectFavoriteBtn.addEventListener('click', async () => {
      const itemId = objectFavoriteBtn.dataset.itemId;
      const objectName = objectFavoriteBtn.dataset.objectName;
      
      if (!itemId || !objectName) return;
      
      if (isFavorite('ki_object', itemId)) {
        // Znajdź ID ulubionego i usuń
        const favorite = userFavorites.find(f => f.type === 'ki_object' && f.item_id === itemId);
        if (favorite) {
          await removeFromFavorites(favorite.id);
        }
      } else {
        // Dodaj do ulubionych - użyj nazwy obiektu jako displayName
        await addToFavorites('ki_object', itemId, objectName);
      }
      
      // Zaktualizuj UI
      updateObjectFavoriteButton(objectName);
      renderFavoritesBar();
    });
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
      
      // Zaktualizuj przycisk ulubionych przy miejscowości
      updateCityFavoriteButton(city);
    });
  }
  
  // Przełącznik "pokaż wszystkie" miejscowości
  const showAllToggle = document.getElementById('show-all-cities-toggle');
  if (showAllToggle) {
    showAllToggle.addEventListener('click', () => {
      const showingAll = showAllToggle.dataset.showingAll === 'true';
      
      if (showingAll) {
        // Pokaż tylko przypisane
        const options = ['<option value="">Wybierz miejscowość</option>',
          ...(window._userAssignedCities || []).map((city) => {
            const citySafe = escapeHtml(city || '');
            return `<option value="${citySafe}">${citySafe}</option>`;
          }),
        ];
        galleryCitySelect.innerHTML = options.join('');
        showAllToggle.textContent = 'pokaż wszystkie';
        showAllToggle.dataset.showingAll = 'false';
      } else {
        // Pokaż wszystkie
        const options = ['<option value="">Wybierz miejscowość</option>',
          ...(window._allCitiesForToggle || []).map((city) => {
            const citySafe = escapeHtml(city || '');
            return `<option value="${citySafe}">${citySafe}</option>`;
          }),
        ];
        galleryCitySelect.innerHTML = options.join('');
        showAllToggle.textContent = 'tylko moje';
        showAllToggle.dataset.showingAll = 'true';
      }
      
      galleryCitySelect.value = '';
      updateCityFavoriteButton('');
    });
  }

  if (galleryObjectSelect) {
    galleryObjectSelect.addEventListener('change', () => {
      if (currentFormMode !== 'klienci-indywidualni') return;
      const sp = gallerySalespersonSelect ? gallerySalespersonSelect.value : '';
      const obj = galleryObjectSelect.value;
      loadGalleryProductsForObject(sp, obj);
      // Zaktualizuj przycisk ulubionych dla obiektu KI
      updateObjectFavoriteButton(obj);
    });
  }

  // Zmiana produktu – niezależnie od trybu, powinna przeładować podgląd obrazka
  if (galleryProductSelect) {
    galleryProductSelect.addEventListener('change', () => {
      const slug = galleryProductSelect.value || '';
      
      // Zapisz slug TYLKO gdy kontekst jest pełny (miasto dla PM, handlowiec+obiekt dla KI)
      if (currentFormMode === 'projekty-miejscowosci') {
        const city = galleryCitySelect ? galleryCitySelect.value : '';
        if (city) {
          cityModeProductSlug = slug;
        }
      } else if (currentFormMode === 'klienci-indywidualni') {
        const sp = gallerySalespersonSelect ? gallerySalespersonSelect.value : '';
        const obj = galleryObjectSelect ? galleryObjectSelect.value : '';
        if (sp && obj) {
          clientsModeProductSlug = slug;
        }
      }
      
      // Jeśli checkbox blokady jest włączony, zaktualizuj lastLockedProductSlug na nowo wybrany produkt
      if (galleryLockCheckbox?.checked && slug) {
        lastLockedProductSlug = slug;
      }
      
      renderGalleryPreview();
      handleGalleryProductChangeFromSelect();
    });
  }

  // Checkboxy sortowania listy produktów galerii
  if (sortNewFirstCheckbox) {
    sortNewFirstCheckbox.addEventListener('change', () => {
      sortGalleryProductOptions(galleryProductSelect);
    });
  }

  if (sortAvailableFirstCheckbox) {
    sortAvailableFirstCheckbox.addEventListener('change', () => {
      sortGalleryProductOptions(galleryProductSelect);
    });
  }

  // Listener dla checkboxa "pamiętaj produkt"
  if (galleryLockCheckbox) {
    galleryLockCheckbox.addEventListener('change', () => {
      if (galleryLockCheckbox.checked) {
        // Gdy checkbox jest włączany, zapamiętaj aktualnie wybrany produkt
        const currentSlug = galleryProductSelect?.value || '';
        lastLockedProductSlug = currentSlug;
      } else {
        // Gdy checkbox jest wyłączany, wyczyść lastLockedProductSlug
        lastLockedProductSlug = '';
      }
    });
  }

  updateGalleryControlsVisibility();
  
  // Inicjalizacja galerii zoom
  initGalleryZoom();
  
  // Inicjalizacja modułu szablonów
  initTemplatesModule();
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
    const salesRep = c.salesRepName ? ` (handlowiec: ${c.salesRepName})` : '';
    const label = meta ? `${c.name} (${meta})${salesRep}` : `${c.name}${salesRep}`;
    const idSafe = escapeHtml(String(c.id));
    const labelSafe = escapeHtml(label || '');
    options.push(`<option value="${idSafe}">${labelSafe}</option>`);
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
  const headerLoginToggle = document.getElementById('header-login-toggle');
  const headerLoginForm = document.getElementById('header-login-form');
  const headerUser = document.getElementById('header-user');
  const headerUserName = document.getElementById('header-user-name');
  const headerUserRole = document.getElementById('header-user-role');

  if (headerLoginForm && !headerLoginForm.dataset.bound) {
    headerLoginForm.addEventListener('submit', handleHeaderLoginSubmit);
    headerLoginForm.dataset.bound = 'true';
  }

  if (headerLoginForm && !headerLoginForm.dataset.bound) {
    headerLoginForm.addEventListener('submit', handleHeaderLoginSubmit);
    headerLoginForm.dataset.bound = 'true';
  }

  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (response.ok) {
      const userData = await response.json();
      currentUser = userData;

      // Usuń tryb gościa – pokaż pełny widok
      document.body.classList.remove('hide-guest');

      // Ukryj przycisk i panel logowania, pokaż info o użytkowniku
      if (headerLoginToggle) headerLoginToggle.style.display = 'none';
      if (headerLoginForm) headerLoginForm.style.display = 'none';
      if (headerUser) headerUser.style.display = 'flex';

      // Wyświetl dane użytkownika w pasku – imię i nazwisko (lub inna nazwa) w pierwszej linii
      if (headerUserName) {
        const displayName = userData.fullName || userData.name || userData.email || '';
        headerUserName.textContent = displayName;
      }
      if (headerUserRole) {
        const roleLabels = {
          'ADMIN': 'Administrator',
          'SALES_REP': 'Handlowiec',
          'SALES_DEPT': 'Dział sprzedaży',
          'WAREHOUSE': 'Magazyn',
          'NEW_USER': 'Nowy użytkownik'
        };
        headerUserRole.textContent = roleLabels[userData.role] || userData.role || '';
      }

      showUserNavigation(userData.role);
      
      // Załaduj ulubione użytkownika
      loadUserFavorites();
    } else {
      // Niezalogowany – tryb gościa
      currentUser = null;
      document.body.classList.add('hide-guest');

      if (headerLoginToggle) headerLoginToggle.style.display = 'inline-flex';
      if (headerUser) headerUser.style.display = 'none';
    }
  } catch (error) {
    console.log('Użytkownik niezalogowany lub błąd autoryzacji');
    currentUser = null;
    document.body.classList.add('hide-guest');

    if (headerLoginToggle) headerLoginToggle.style.display = 'inline-flex';
    if (headerUser) headerUser.style.display = 'none';
  }

  // Inicjalizacja niezależnie od stanu logowania
  initialize();
  initOrderCustomerControls();
}

// Pokazywanie nawigacji dla zalogowanych użytkowników
function showUserNavigation(role) {
  const ordersLink = document.getElementById('orders-link');
  
  if (ordersLink) {
    if (['SALES_REP', 'SALES_DEPT', 'ADMIN', 'WAREHOUSE', 'PRODUCTION'].includes(role)) {
      ordersLink.href = '/orders';
      ordersLink.style.display = 'flex';
    } else {
      ordersLink.style.display = 'none';
    }
  }
  
  if (clientsLink && ['SALES_REP', 'SALES_DEPT', 'ADMIN'].includes(role)) {
    clientsLink.style.display = 'flex';
  }
  
  // Panel admina - tylko dla ADMIN
  if (adminLink) {
    if (role === 'ADMIN') {
      adminLink.style.display = 'flex';
      adminLink.href = '/admin';
      adminLink.innerHTML = '<i class="fas fa-cog"></i> Panel admina';
    } else if (role === 'SALES_DEPT') {
      // Dział sprzedaży - przycisk do ustawień
      adminLink.style.display = 'flex';
      adminLink.href = '/admin';
      adminLink.innerHTML = '<i class="fas fa-cog"></i> Ustawienia';
    } else if (role === 'GRAPHICS') {
      // Graficy - przycisk do przypisywania miejscowości
      adminLink.style.display = 'flex';
      adminLink.href = '/admin#city-access';
      adminLink.innerHTML = '<i class="fas fa-folder-plus"></i> Nowe miejscowości';
    } else {
      adminLink.style.display = 'none';
    }
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
  } catch (error) {
    console.error('Błąd wylogowania:', error);
  }
  // Po wylogowaniu przeładuj stronę – checkAuthAndInitialize ustawi tryb gościa
  window.location.href = '/';
}

// ========================================
// Galeria – Double-tap zoom i touch interactions
// ========================================

function initGalleryZoom() {
  const galleryFrame = document.getElementById('gallery-preview-frame');
  const galleryImage = document.getElementById('gallery-preview-image');

  if (!galleryFrame || !galleryImage) return;

  let isZoomed = false;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  // Drag – przesuwanie powiększonego obrazu
  galleryImage.addEventListener('mousedown', (e) => {
    if (!isZoomed || e.button !== 0) return; // tylko lewy przycisk i tylko w trybie zoom
    isDragging = true;
    dragStartX = e.clientX - offsetX;
    dragStartY = e.clientY - offsetY;
    galleryImage.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging || !isZoomed) return; // bez isDragging nie przesuwaj
    offsetX = e.clientX - dragStartX;
    offsetY = e.clientY - dragStartY;
    updateImageTransform();
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    galleryImage.style.cursor = isZoomed ? 'grab' : 'auto';
  });

  // Scroll do powiększania/zmniejszania
  galleryImage.addEventListener('wheel', (e) => {
    // Jeśli nie jesteśmy w trybie zoomu – pozwól na normalne przewijanie strony
    if (!isZoomed) {
      return;
    }

    e.preventDefault();

    const rect = galleryImage.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomSpeed = 0.1;
    const newScale = e.deltaY > 0 ? scale - zoomSpeed : scale + zoomSpeed;

    if (newScale < 1 || newScale > 5) return;

    // Przelicz offset tak, aby punkt pod kursorem pozostał pod kursorem
    const prevScale = scale;
    scale = newScale;

    const scaleRatio = scale / prevScale;
    offsetX = cursorX - (cursorX - offsetX) * scaleRatio;
    offsetY = cursorY - (cursorY - offsetY) * scaleRatio;

    if (scale <= 1) {
      resetZoom();
    } else {
      updateImageTransform();
    }
  }, { passive: false });

  // Double-click – przełącz zoom (włącz/wyłącz)
  galleryImage.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (isZoomed) {
      resetZoom();
    } else {
      // Włącz zoom startowy
      isZoomed = true;
      scale = 2;
      offsetX = 0;
      offsetY = 0;
      updateImageTransform();
    }
  });

  function resetZoom() {
    isZoomed = false;
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    updateImageTransform();
    galleryImage.style.cursor = 'auto';
  }

  function updateImageTransform() {
    galleryImage.style.transform = `scale(${scale}) translate(${offsetX / scale}px, ${offsetY / scale}px)`;
    galleryImage.style.cursor = isZoomed ? 'grab' : 'auto';
  }
}

// ============================================
// WIDOK ZAMÓWIENIA
// ============================================

const ordersSection = document.getElementById('orders-section');
const orderDetailsSection = document.getElementById('order-details-section');
const ordersBody = document.getElementById('orders-body');
const ordersNavBtn = document.getElementById('orders-nav-btn');
const ordersFilterStatus = document.getElementById('orders-filter-status');
const ordersFilterUser = document.getElementById('orders-filter-user');
const ordersFilterUserLabel = document.getElementById('orders-filter-user-label');
const ordersFilterDateFrom = document.getElementById('orders-filter-date-from');
const ordersFilterDateTo = document.getElementById('orders-filter-date-to');
const ordersFilterApply = document.getElementById('orders-filter-apply');
const ordersFilterReset = document.getElementById('orders-filter-reset');
const ordersTableHeaderUser = document.getElementById('orders-table-header-user');
const orderDetailsBack = document.getElementById('order-details-back');
const orderDetailsContent = document.getElementById('order-details-content');
const orderDetailsTitle = document.getElementById('order-details-title');

let currentUserRole = null;
let allOrders = [];

// Pobierz rolę użytkownika
async function loadUserRole() {
  try {
    const response = await fetch('/api/user', { credentials: 'include' });
    if (!response.ok) return;
    const result = await response.json();
    currentUserRole = result.data?.role;
    
    // Jeśli ADMIN lub SALES_DEPT, pokaż filtr handlowca i kolumnę w tabeli
    if (currentUserRole === 'ADMIN' || currentUserRole === 'SALES_DEPT') {
      ordersFilterUserLabel.style.display = '';
      ordersTableHeaderUser.style.display = '';
      loadAllUsers();
    }
  } catch (error) {
    console.error('Błąd pobierania roli:', error);
  }
}

// Załaduj listę handlowców (dla admina)
async function loadAllUsers() {
  try {
    const response = await fetch('/api/users', { credentials: 'include' });
    if (!response.ok) return;
    const result = await response.json();
    const users = result.data || [];
    
    ordersFilterUser.innerHTML = '<option value="">Wszyscy handlowcy</option>' +
      users.map(u => `<option value="${u.id}">${u.shortCode} - ${u.name}</option>`).join('');
  } catch (error) {
    console.error('Błąd pobierania handlowców:', error);
  }
}

// Załaduj zamówienia
async function loadOrders() {
  try {
    ordersBody.innerHTML = '<tr class="table__placeholder"><td colspan="7">Ładowanie…</td></tr>';
    
    const endpoint = (currentUserRole === 'ADMIN' || currentUserRole === 'SALES_DEPT')
      ? '/api/orders'
      : '/api/orders/my';
    const params = new URLSearchParams();
    
    if (ordersFilterStatus.value) params.append('status', ordersFilterStatus.value);
    if (ordersFilterDateFrom.value) params.append('dateFrom', ordersFilterDateFrom.value);
    if (ordersFilterDateTo.value) params.append('dateTo', ordersFilterDateTo.value);
    if (currentUserRole === 'ROLE_ADMIN' && ordersFilterUser.value) {
      params.append('userId', ordersFilterUser.value);
    }
    
    const url = `${endpoint}?${params.toString()}`;
    const response = await fetch(url, { credentials: 'include' });
    
    if (!response.ok) {
      ordersBody.innerHTML = '<tr class="table__placeholder"><td colspan="7">Błąd ładowania zamówień</td></tr>';
      return;
    }
    
    const result = await response.json();
    allOrders = result.data || [];
    
    renderOrdersTable();
  } catch (error) {
    console.error('Błąd pobierania zamówień:', error);
    ordersBody.innerHTML = '<tr class="table__placeholder"><td colspan="7">Błąd ładowania zamówień</td></tr>';
  }
}

// Renderuj tabelę zamówień
function renderOrdersTable() {
  if (allOrders.length === 0) {
    ordersBody.innerHTML = '<tr class="table__placeholder"><td colspan="7">Brak zamówień</td></tr>';
    return;
  }
  
  ordersBody.innerHTML = allOrders.map(order => {
    const date = new Date(order.createdAt).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const statusClass = `status-badge--${order.status.toLowerCase().replace(/_/g, '-')}`;
    const statusLabelSafe = escapeHtml(order.status || '');
    const orderNumberSafe = escapeHtml(order.orderNumber || '');
    const dateSafe = escapeHtml(date || '');
    const customerNameSafe = escapeHtml(order.Customer?.name || '-');
    const userShortSafe = escapeHtml(order.User?.shortCode || '-');
    
    const userCell = (currentUserRole === 'ADMIN' || currentUserRole === 'SALES_DEPT') 
      ? `<td>${userShortSafe}</td>`
      : '';
    
    return `
      <tr>
        <td><strong>${orderNumberSafe}</strong></td>
        <td>${dateSafe}</td>
        <td>${customerNameSafe}</td>
        ${userCell}
        <td><span class="status-badge ${statusClass}">${statusLabelSafe}</span></td>
        <td class="price-column">${formatPrice(order.total)}</td>
        <td>
          <button class="btn btn--link btn--small" onclick="showOrderDetails('${order.id}')">
            Szczegóły
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Pokaż szczegóły zamówienia
async function showOrderDetails(orderId) {
  try {
    const response = await fetch(`/api/orders/${orderId}`, { credentials: 'include' });
    
    if (!response.ok) {
      alert('Nie udało się pobrać szczegółów zamówienia');
      return;
    }
    
    const result = await response.json();
    const order = result.data;
    
    // Ukryj listę, pokaż szczegóły
    ordersSection.style.display = 'none';
    orderDetailsSection.style.display = '';
    
    orderDetailsTitle.textContent = `Zamówienie ${order.orderNumber}`;
    
    const statusClass = `status-badge--${order.status.toLowerCase().replace(/_/g, '-')}`;
    
    const itemsHtml = (order.items || []).map(item => {
      const productName = item.Product?.name || item.Product?.identifier || '-';
      const productNameSafe = escapeHtml(productName || '-');
      const projectsSafe = escapeHtml(item.selectedProjects || '-');
      const locationSafe = escapeHtml(item.locationName || '-');
      const qtySafe = escapeHtml(String(item.quantity));
      const unitPriceText = formatPrice(item.unitPrice);
      const lineTotalText = formatPrice(item.quantity * item.unitPrice);
      const unitPriceSafe = escapeHtml(unitPriceText);
      const lineTotalSafe = escapeHtml(lineTotalText);
      return `
        <tr>
          <td>${productNameSafe}</td>
          <td>${projectsSafe}</td>
          <td>${qtySafe}</td>
          <td class="price-column">${unitPriceSafe}</td>
          <td class="price-column">${lineTotalSafe}</td>
          <td>${locationSafe}</td>
        </tr>
      `;
    }).join('');
    
    const orderNumberSafe = escapeHtml(order.orderNumber || '');
    const customerNameSafe = escapeHtml(order.Customer?.name || '-');
    const userShortSafe = escapeHtml(order.User?.shortCode || '-');
    const statusLabelSafe = escapeHtml(order.status || '');
    const createdDateSafe = escapeHtml(new Date(order.createdAt).toLocaleDateString('pl-PL'));
    const totalSafe = escapeHtml(formatPrice(order.total));
    const notesSafe = order.notes ? escapeHtml(order.notes) : '';
    
    orderDetailsContent.innerHTML = `
      <div class="order-details-grid">
        <div class="order-detail-item">
          <div class="order-detail-item__label">Numer zamówienia</div>
          <div class="order-detail-item__value">${orderNumberSafe}</div>
        </div>
        <div class="order-detail-item">
          <div class="order-detail-item__label">Klient</div>
          <div class="order-detail-item__value">${customerNameSafe}</div>
        </div>
        <div class="order-detail-item">
          <div class="order-detail-item__label">Handlowiec</div>
          <div class="order-detail-item__value">${userShortSafe}</div>
        </div>
        <div class="order-detail-item">
          <div class="order-detail-item__label">Status</div>
          <div class="order-detail-item__value">
            <span class="status-badge ${statusClass}">${statusLabelSafe}</span>
          </div>
        </div>
        <div class="order-detail-item">
          <div class="order-detail-item__label">Data utworzenia</div>
          <div class="order-detail-item__value">${createdDateSafe}</div>
        </div>
        <div class="order-detail-item">
          <div class="order-detail-item__label">Suma</div>
          <div class="order-detail-item__value">${totalSafe}</div>
        </div>
      </div>
      
      <h3>Pozycje zamówienia</h3>
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>Produkt</th>
              <th>Projekty</th>
              <th>Ilość</th>
              <th class="price-column">Cena j.</th>
              <th class="price-column">Wartość</th>
              <th>Lokalizacja</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || '<tr><td colspan="6">Brak pozycji</td></tr>'}
          </tbody>
        </table>
      </div>
      
      ${order.notes ? `<p><strong>Notatki:</strong> ${notesSafe}</p>` : ''}
    `;
  } catch (error) {
    console.error('Błąd pobierania szczegółów:', error);
    alert('Błąd pobierania szczegółów zamówienia');
  }
}

// Obsługa przycisków (tylko jeśli elementy istnieją w aktualnym widoku)
if (ordersNavBtn && ordersSection && orderDetailsSection) {
  ordersNavBtn.addEventListener('click', () => {
    ordersSection.style.display = '';
    orderDetailsSection.style.display = 'none';
    loadUserRole();
    loadOrders();
  });
}

if (ordersFilterApply && ordersFilterReset) {
  ordersFilterApply.addEventListener('click', loadOrders);
  ordersFilterReset.addEventListener('click', () => {
    ordersFilterStatus.value = '';
    ordersFilterUser.value = '';
    ordersFilterDateFrom.value = '';
    ordersFilterDateTo.value = '';
    loadOrders();
  });
}

if (orderDetailsBack && orderDetailsSection && ordersSection) {
  orderDetailsBack.addEventListener('click', () => {
    orderDetailsSection.style.display = 'none';
    ordersSection.style.display = '';
  });
}

// ============================================
// MODUŁ SZABLONÓW ZAMÓWIEŃ
// ============================================

async function loadOrderTemplates() {
  try {
    const response = await fetch('/api/order-templates', {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Nie udało się pobrać szablonów');
    }

    const result = await response.json();
    orderTemplates = result.data || [];
    renderTemplatesList();
  } catch (error) {
    console.error('Błąd ładowania szablonów:', error);
  }
}

function renderTemplatesList() {
  if (!templatesList) return;

  const searchTerm = templateSearchInput?.value?.toLowerCase() || '';
  const visibilityFilter = templateVisibilityFilter?.value || '';

  let filtered = orderTemplates.filter(t => {
    const matchesSearch = !searchTerm || t.name.toLowerCase().includes(searchTerm);
    const matchesVisibility = !visibilityFilter || t.visibility === visibilityFilter;
    return matchesSearch && matchesVisibility;
  });

  // Sortuj: ulubione na górze, potem po dacie aktualizacji
  filtered.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  if (filtered.length === 0) {
    templatesList.innerHTML = '<p class="templates-empty">Brak szablonów</p>';
    return;
  }

  const html = filtered.map(template => {
    const visibilityBadge = template.visibility === 'TEAM' 
      ? '<span class="template-badge template-badge--team">Zespołowy</span>'
      : '<span class="template-badge template-badge--private">Prywatny</span>';
    
    const ownerNameSafe = escapeHtml(template.ownerName || '');
    const ownerBadge = template.isOwner 
      ? '<span class="template-badge template-badge--owner">Mój</span>'
      : `<span class="template-badge template-badge--shared">${ownerNameSafe}</span>`;

    const favoriteIcon = template.isFavorite 
      ? '<i class="fas fa-star template-favorite-icon template-favorite-icon--active"></i>'
      : '<i class="far fa-star template-favorite-icon"></i>';

    const usageInfo = template.usage_count > 0 
      ? `Użyto ${template.usage_count}x`
      : 'Nieużywany';
    const usageInfoSafe = escapeHtml(usageInfo);

    const tagsHtml = Array.isArray(template.tags) && template.tags.length > 0
      ? template.tags.map(tag => `<span class="template-tag">${escapeHtml(tag)}</span>`).join('')
      : '';

    const idSafe = escapeHtml(String(template.id));
    const nameSafe = escapeHtml(template.name || '');
    const descriptionSafe = escapeHtml(template.description || '');

    return `
      <div class="template-item" data-template-id="${idSafe}">
        <div class="template-header">
          <div class="template-header-main">
            <h4 class="template-name">${nameSafe}</h4>
            <div class="template-meta">
              ${visibilityBadge}
              ${ownerBadge}
              <span class="template-usage">${usageInfoSafe}</span>
            </div>
          </div>
          <div class="template-header-actions">
            <button class="btn btn--sm btn--primary template-use-btn" data-template-id="${idSafe}">
              <i class="fas fa-download"></i> Wczytaj
            </button>
            <button class="btn btn--sm btn--secondary template-duplicate-btn" data-template-id="${idSafe}">
              <i class="fas fa-copy"></i> Duplikuj
            </button>
            ${template.isOwner ? `
              <button class="btn btn--sm btn--secondary template-edit-btn" data-template-id="${idSafe}">
                <i class="fas fa-edit"></i> Edytuj
              </button>
              <button class="btn btn--sm btn--danger template-delete-btn" data-template-id="${idSafe}">
                <i class="fas fa-trash"></i> Usuń
              </button>
            ` : ''}
            <button class="template-favorite-btn" data-template-id="${idSafe}" data-is-favorite="${template.isFavorite}">
              ${favoriteIcon}
            </button>
          </div>
        </div>
        ${template.description ? `<p class="template-description">${descriptionSafe}</p>` : ''}
        ${tagsHtml ? `<div class="template-tags">${tagsHtml}</div>` : ''}
      </div>
    `;
  }).join('');

  templatesList.innerHTML = html;

  // Dodaj event listenery
  templatesList.querySelectorAll('.template-use-btn').forEach(btn => {
    btn.addEventListener('click', () => useTemplate(btn.dataset.templateId));
  });

  templatesList.querySelectorAll('.template-duplicate-btn').forEach(btn => {
    btn.addEventListener('click', () => duplicateTemplate(btn.dataset.templateId));
  });

  templatesList.querySelectorAll('.template-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTemplate(btn.dataset.templateId));
  });

  templatesList.querySelectorAll('.template-favorite-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleTemplateFavorite(btn.dataset.templateId, btn.dataset.isFavorite === 'false'));
  });

  templatesList.querySelectorAll('.template-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editTemplate(btn.dataset.templateId));
  });
}

async function saveTemplate() {
  if (!saveTemplateForm) return;

  const name = templateNameInput?.value?.trim();
  const description = templateDescriptionInput?.value?.trim();
  const visibility = templateVisibilityInput?.value || 'PRIVATE';
  const tagsStr = templateTagsInput?.value?.trim() || '';
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

  if (!name) {
    setStatus('Nazwa szablonu jest wymagana.', 'error', 'cart');
    return;
  }

  if (cart.size === 0) {
    setStatus('Koszyk jest pusty. Dodaj produkty przed zapisaniem szablonu.', 'error', 'cart');
    return;
  }

  // Zbierz pozycje z koszyka
  const items = [];
  for (const [key, item] of cart.entries()) {
    if (!item.product || !item.product.pc_id) continue;

    const qty = Number(item.quantity);
    if (!qty || qty <= 0) continue;

    items.push({
      productCode: item.product.pc_id,
      quantity: qty,
      unitPrice: Number(item.product.price ?? 0),
      selectedProjects: item.projects ?? '',
      projectQuantities: Array.isArray(item.perProjectQuantities) && item.perProjectQuantities.length > 0
        ? JSON.stringify(item.perProjectQuantities)
        : null,
      totalQuantity: qty,
      locationName: item.locationName || null,
      source: item.source || 'MIEJSCOWOSCI'
    });
  }

  if (items.length === 0) {
    setStatus('Brak pozycji do zapisania w szablonie.', 'error', 'cart');
    return;
  }

  try {
    const response = await fetch('/api/order-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, description, visibility, tags, items })
    });

    const result = await response.json();

    if (!response.ok) {
      setStatus(result.message || 'Nie udało się zapisać szablonu.', 'error', 'cart');
      return;
    }

    closeSaveTemplateModal();
    loadOrderTemplates();
    setStatus(`Szablon "${name}" został zapisany.`, 'success', 'cart');
  } catch (error) {
    console.error('Błąd zapisywania szablonu:', error);
    setStatus('Błąd podczas zapisywania szablonu.', 'error', 'cart');
  }
}

async function useTemplate(templateId) {
  try {
    const response = await fetch(`/api/order-templates/${templateId}/use`, {
      method: 'POST',
      credentials: 'include'
    });

    const result = await response.json();

    if (!response.ok) {
      setStatus(result.message || 'Nie udało się wczytać szablonu.', 'error', 'cart');
      return;
    }

    // Wyczyść koszyk
    cart.clear();

    // Wczytaj pozycje z szablonu do koszyka
    const items = result.data.items || [];
    for (const item of items) {
      const product = {
        pc_id: item.productCode,
        name: item.productName,
        price: item.productPrice
      };

      const cartKey = `${item.productCode}_${item.locationName || 'katalog'}`;
      cart.set(cartKey, {
        product,
        quantity: item.quantity,
        projects: item.selectedProjects || '',
        perProjectQuantities: item.projectQuantities ? JSON.parse(item.projectQuantities) : [],
        locationName: item.locationName,
        source: item.source || 'MIEJSCOWOSCI'
      });
    }

    renderCart();
    closeTemplateModal();
    setStatus(`Szablon "${result.data.templateName}" został wczytany do koszyka.`, 'success', 'cart');
  } catch (error) {
    console.error('Błąd wczytywania szablonu:', error);
    setStatus('Błąd podczas wczytywania szablonu.', 'error', 'cart');
  }
}

async function duplicateTemplate(templateId) {
  const name = prompt('Podaj nazwę dla kopii szablonu:');
  if (!name || !name.trim()) return;

  try {
    const response = await fetch(`/api/order-templates/${templateId}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: name.trim() })
    });

    const result = await response.json();

    if (!response.ok) {
      setStatus(result.message || 'Nie udało się zduplikować szablonu.', 'error');
      return;
    }

    loadOrderTemplates();
    setStatus(`Szablon został zduplikowany jako "${result.data.name}".`, 'success');
  } catch (error) {
    console.error('Błąd duplikowania szablonu:', error);
    setStatus('Błąd podczas duplikowania szablonu.', 'error');
  }
}

async function deleteTemplate(templateId) {
  if (!confirm('Czy na pewno chcesz usunąć ten szablon?')) return;

  try {
    const response = await fetch(`/api/order-templates/${templateId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    const result = await response.json();

    if (!response.ok) {
      setStatus(result.message || 'Nie udało się usunąć szablonu.', 'error');
      return;
    }

    loadOrderTemplates();
    setStatus('Szablon został usunięty.', 'success');
  } catch (error) {
    console.error('Błąd usuwania szablonu:', error);
    setStatus('Błąd podczas usuwania szablonu.', 'error');
  }
}

async function toggleTemplateFavorite(templateId, isFavorite) {
  try {
    const response = await fetch(`/api/order-templates/${templateId}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isFavorite })
    });

    const result = await response.json();

    if (!response.ok) {
      setStatus(result.message || 'Nie udało się zaktualizować ulubionych.', 'error');
      return;
    }

    loadOrderTemplates();
    setStatus(isFavorite ? 'Dodano szablon do ulubionych.' : 'Usunięto szablon z ulubionych.', 'success');
  } catch (error) {
    console.error('Błąd aktualizacji ulubionych:', error);
    setStatus('Błąd podczas aktualizacji ulubionych.', 'error');
  }
}

async function editTemplate(templateId) {
  const template = orderTemplates.find(t => t.id === templateId);
  if (!template) return;

  const name = prompt('Nowa nazwa szablonu:', template.name);
  if (!name || name.trim() === template.name) return;

  try {
    const response = await fetch(`/api/order-templates/${templateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: name.trim() })
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || 'Nie udało się zaktualizować szablonu');
      return;
    }

    alert('Szablon został zaktualizowany');
    loadOrderTemplates();
  } catch (error) {
    console.error('Błąd aktualizacji szablonu:', error);
    alert('Błąd podczas aktualizacji szablonu');
  }
}

function openTemplateModal() {
  if (!templateModal) return;
  templateModal.style.display = 'flex';
  loadOrderTemplates();
}

function closeTemplateModal() {
  if (!templateModal) return;
  templateModal.style.display = 'none';
}

function openSaveTemplateModal() {
  if (!saveTemplateModal) return;
  saveTemplateModal.style.display = 'flex';
  
  // Wyczyść formularz
  if (templateNameInput) templateNameInput.value = '';
  if (templateDescriptionInput) templateDescriptionInput.value = '';
  if (templateVisibilityInput) templateVisibilityInput.value = 'PRIVATE';
  if (templateTagsInput) templateTagsInput.value = '';
}

function closeSaveTemplateModal() {
  if (!saveTemplateModal) return;
  saveTemplateModal.style.display = 'none';
}

function initTemplatesModule() {
  // Przyciski otwierające modale
  if (loadTemplateBtn) {
    loadTemplateBtn.addEventListener('click', openTemplateModal);
  }

  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener('click', openSaveTemplateModal);
  }

  // Przyciski zamykające modale
  if (templateModalClose) {
    templateModalClose.addEventListener('click', closeTemplateModal);
  }

  if (saveTemplateModalClose) {
    saveTemplateModalClose.addEventListener('click', closeSaveTemplateModal);
  }

  // Zamykanie modali po kliknięciu poza nimi
  if (templateModal) {
    templateModal.addEventListener('click', (e) => {
      if (e.target === templateModal) closeTemplateModal();
    });
  }

  if (saveTemplateModal) {
    saveTemplateModal.addEventListener('click', (e) => {
      if (e.target === saveTemplateModal) closeSaveTemplateModal();
    });
  }

  // Formularz zapisywania szablonu
  if (saveTemplateForm) {
    saveTemplateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveTemplate();
    });
  }

  // Filtrowanie szablonów
  if (templateSearchInput) {
    templateSearchInput.addEventListener('input', renderTemplatesList);
  }

  if (templateVisibilityFilter) {
    templateVisibilityFilter.addEventListener('change', renderTemplatesList);
  }
}

// ============================================
// KONIEC MODUŁU SZABLONÓW
// ============================================

// Dropdown logowania w nagłówku
const headerLoginToggle = document.getElementById('header-login-toggle');
const headerLoginForm = document.getElementById('header-login-form');
const headerAuth = document.querySelector('.header__auth');

if (headerLoginToggle && headerLoginForm && headerAuth) {
  headerLoginToggle.addEventListener('click', () => {
    const isVisible = headerLoginForm.style.display === 'block';
    headerLoginForm.style.display = isVisible ? 'none' : 'block';
  });

  document.addEventListener('click', (event) => {
    if (!headerAuth.contains(event.target)) {
      headerLoginForm.style.display = 'none';
    }
  });
}

// ============================================
// MODUŁ: ULUBIONE (FAVORITES)
// ============================================

let userFavorites = [];
let favoritesLoading = false;

// Pobierz ulubione użytkownika
async function loadUserFavorites() {
  if (!currentUser || favoritesLoading) return;
  
  try {
    favoritesLoading = true;
    const response = await fetch('/api/favorites');
    const result = await response.json();
    
    if (result.status === 'success') {
      userFavorites = (result.data || []).map(f => ({
        id: f.id,
        type: f.type,
        // Normalizujemy nazwę pola na item_id, bo cała reszta kodu (isFavorite, renderFavoritesBar itd.) tego oczekuje
        item_id: f.item_id || f.itemId,
        name: f.displayName
      }));
      updateFavoritesUI();
    } else {
      console.error('Błąd pobierania ulubionych:', result.message);
    }
  } catch (error) {
    console.error('Błąd pobierania ulubionych:', error);
  } finally {
    favoritesLoading = false;
  }
}

// Dodaj do ulubionych
async function addToFavorites(type, itemId, name) {
  if (!currentUser) {
    setStatus('Musisz być zalogowany, aby dodać do ulubionych', 'error');
    return;
  }
  
  try {
    // Sprawdź limit 12 ulubionych dla danego typu
    const currentTypeFavorites = userFavorites.filter(f => f.type === type);
    if (currentTypeFavorites.length >= 12) {
      setStatus('Możesz mieć maksymalnie 12 ulubionych pozycji tego typu', 'error');
      return;
    }
    
    
    const response = await fetch('/api/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        type: type,
        itemId: itemId,
        displayName: name
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      // Backend zwraca dane w polu 'data', mapuj na format frontendu
      const newFavorite = result.data;
      // Mapuj pola z backendu na format frontendu
      userFavorites.push({
        id: newFavorite.id,
        type: newFavorite.type,
        // Backend może zwrócić item_id albo itemId – obsłuż oba warianty, a w ostateczności użyj itemId przekazanego w żądaniu
        item_id: newFavorite.item_id || newFavorite.itemId || itemId,
        name: newFavorite.displayName || name
      });
      updateFavoritesUI();
      setStatus('Dodano do ulubionych', 'success');
    } else {
      setStatus('Błąd: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('[ERROR] Error adding to favorites:', error);
    setStatus('Wystąpił błąd podczas dodawania do ulubionych', 'error');
  }
}

// Usuń z ulubionych (przyjmuje favoriteId lub obiekt {type, itemId})
async function removeFromFavorites(favoriteIdOrType, itemId = null) {
  if (!currentUser) return;
  
  try {
    let type, targetItemId, favoriteId;
    
    if (itemId !== null) {
      // Wywołanie z type i itemId
      type = favoriteIdOrType;
      targetItemId = itemId;
    } else {
      // Wywołanie z favoriteId - znajdź type i itemId
      favoriteId = favoriteIdOrType;
      // Konwertuj favoriteId na number, ponieważ HTML zwraca string
      const favoriteIdNum = parseInt(favoriteId, 10);
      const favorite = userFavorites.find(f => f.id === favoriteIdNum);
      if (!favorite) {
        console.error('[ERROR] Favorite not found:', favoriteId);
        return;
      }
      type = favorite.type;
      targetItemId = favorite.item_id;
    }
    
    const response = await fetch(`/api/favorites/${type}/${encodeURIComponent(targetItemId)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      userFavorites = userFavorites.filter(f => !(f.type === type && f.item_id === targetItemId));
      updateFavoritesUI();
      setStatus('Usunięto z ulubionych', 'success');
    } else {
      setStatus('Błąd: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('[ERROR] Error removing from favorites:', error);
    setStatus('Wystąpił błąd podczas usuwania z ulubionych', 'error');
  }
}

// Sprawdź, czy pozycja jest w ulubionych
function isFavorite(type, itemId) {
  return userFavorites.some(f => f.type === type && f.item_id === itemId);
}

// Zaktualizuj UI ulubionych
function updateFavoritesUI() {
  // Dodaj/usuń klasy CSS dla przycisków ulubionych
  document.querySelectorAll('.favorite-btn').forEach(btn => {
    const type = btn.dataset.type;
    const itemId = btn.dataset.itemId;
    
    if (isFavorite(type, itemId)) {
      btn.classList.add('is-favorite');
      btn.innerHTML = '<i class="fas fa-star"></i>';
    } else {
      btn.classList.remove('is-favorite');
      btn.innerHTML = '<i class="far fa-star"></i>';
    }
  });
  
  // Renderuj pasek ulubionych miejscowości
  renderFavoritesBar();
}

document.addEventListener('DOMContentLoaded', checkAuthAndInitialize);

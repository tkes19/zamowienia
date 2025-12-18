/**
 * Panel Produkcji - Logika frontendu
 * Kompaktowy widok dla operatorów
 */

// ============================================
// STAN APLIKACJI
// ============================================
let orders = [];
let filteredOrders = [];
let workOrders = []; // Zbiorcze ZP (ProductionWorkOrder)
let summary = {}; // Podsumowanie kolejki
let currentOperationId = null;
let currentOrderId = null;
let selectedProblemType = null;
let refreshInterval = null;
let orderTimers = {};

let productionSse = null;
let productionSseReconnectTimer = null;
let productionSseRefreshTimer = null;

let inactivityLogoutTimer = null;
const INACTIVITY_LOGOUT_MS = 20 * 60 * 1000;

function scheduleProductionSseReconnect() {
    if (productionSseReconnectTimer) return;
    productionSseReconnectTimer = setTimeout(() => {
        productionSseReconnectTimer = null;
        startProductionSse();
    }, 3000);
}

function scheduleInactivityLogout() {
    if (inactivityLogoutTimer) {
        clearTimeout(inactivityLogoutTimer);
    }

    inactivityLogoutTimer = setTimeout(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (e) {
            // ignore
        }
        window.location.href = '/kiosk';
    }, INACTIVITY_LOGOUT_MS);
}

function setupInactivityLogout() {
    const handler = () => scheduleInactivityLogout();
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
        document.addEventListener(evt, handler, { passive: true });
    });
    scheduleInactivityLogout();
}

function scheduleProductionSseRefresh() {
    if (productionSseRefreshTimer) return;
    productionSseRefreshTimer = setTimeout(() => {
        productionSseRefreshTimer = null;
        loadOrdersSilent();
        loadStats();
    }, 400);
}

function startProductionSse() {
    if (productionSse) {
        try { productionSse.close(); } catch (e) {}
        productionSse = null;
    }

    try {
        productionSse = new EventSource('/api/events');

        productionSse.addEventListener('ready', () => {
            // połączenie OK
        });

        productionSse.addEventListener('message', (ev) => {
            try {
                const payload = JSON.parse(ev.data || '{}');
                if (payload?.type === 'productionStatusChanged') {
                    scheduleProductionSseRefresh();
                }
            } catch (e) {
                // ignore
            }
        });

        productionSse.addEventListener('error', () => {
            scheduleProductionSseReconnect();
        });
    } catch (e) {
        scheduleProductionSseReconnect();
    }
}

// Maszyny w pokoju operatora
let currentRoomId = null;
let roomMachines = [];
let selectedMachineId = null;

// Rozwinięte szczegóły ZP
let openWorkOrderDetails = new Set(JSON.parse(localStorage.getItem('prodOpenWorkOrders') || '[]'));

// Ustawienia widoku
let viewMode = localStorage.getItem('prodViewMode') || 'grid'; // grid, list
let sortMode = localStorage.getItem('prodSortMode') || 'priority';
let displayMode = localStorage.getItem('prodDisplayMode') || 'workorders'; // orders, workorders (Zbiorcze ZP) - domyślnie workorders
const WORKORDER_VIEWS = ['open', 'completed'];
let workOrdersView = WORKORDER_VIEWS.includes(localStorage.getItem('prodWorkOrdersView')) 
    ? localStorage.getItem('prodWorkOrdersView') 
    : 'open'; // open, completed
let activeFilters = {
    urgent: false,
    small: false,
    pinned: false
};

// Przypięte zlecenia (zapisane lokalnie)
let pinnedOrders = JSON.parse(localStorage.getItem('pinnedOrders') || '[]');

// Product Image Modal elements
const productImageModal = document.getElementById('product-image-modal');
const productImageClose = document.getElementById('product-image-close');
const productImageContent = document.getElementById('product-image-content');
const productImageTitle = document.getElementById('product-image-title');
const productImageDetails = document.getElementById('product-image-details');
const productImageDownload = document.getElementById('product-image-download');
const productImageZoom = document.getElementById('product-image-zoom');

// ============================================
// FUNKCJE POMOCNICZE
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isOverdue(dateStr) {
    if (!dateStr) return false;
    const dueDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
}

/**
 * Formatuje czas do terminu w czytelny sposób
 * @param {number} minutes - Czas w minutach (może być ujemny)
 * @returns {string} - np. "2 dni", "5h", "Przeterminowane: 3h"
 */
function formatTimeToDeadline(minutes) {
    if (minutes === null || minutes === undefined) return '';
    
    const absMinutes = Math.abs(minutes);
    const isOverdue = minutes < 0;
    
    let text;
    if (absMinutes < 60) {
        text = `${absMinutes} min`;
    } else if (absMinutes < 24 * 60) {
        const hours = Math.floor(absMinutes / 60);
        text = `${hours}h`;
    } else {
        const days = Math.floor(absMinutes / (24 * 60));
        const remainingHours = Math.floor((absMinutes % (24 * 60)) / 60);
        text = remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days} dni`;
    }
    
    return isOverdue ? `Przeterminowane: ${text}` : `Pozostało: ${text}`;
}

/**
 * Zwraca klasę CSS dla timeStatus
 * @param {string} timeStatus - ON_TIME, AT_RISK, OVERDUE, UNKNOWN
 * @returns {string} - Klasa CSS
 */
function getTimeStatusClass(timeStatus) {
    switch (timeStatus) {
        case 'OVERDUE': return 'time-status-overdue';
        case 'AT_RISK': return 'time-status-at-risk';
        case 'ON_TIME': return 'time-status-on-time';
        default: return 'time-status-unknown';
    }
}

/**
 * Generuje badge SLA/termin dla kafelka ZP
 * @param {string} deliveryDate - Data dostawy (ISO string)
 * @returns {string} - HTML badge lub pusty string
 */
function getSlaBadge(deliveryDate) {
    if (!deliveryDate) return '';
    
    const delivery = new Date(deliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return `<span class="sla-badge sla-overdue"><i class="fas fa-exclamation-triangle"></i> Przeterminowane</span>`;
    } else if (diffDays === 0) {
        return `<span class="sla-badge sla-today"><i class="fas fa-clock"></i> Dziś!</span>`;
    } else if (diffDays === 1) {
        return `<span class="sla-badge sla-tomorrow"><i class="fas fa-calendar-day"></i> Jutro</span>`;
    } else if (diffDays <= 3) {
        return `<span class="sla-badge sla-soon"><i class="fas fa-calendar-alt"></i> ${diffDays} dni</span>`;
    }
    
    return '';
}

// Formatuj czas trwania (sekundy -> MM:SS lub HH:MM:SS)
function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Aktualizuj wszystkie timery na stronie
function updateTimers() {
    const timers = document.querySelectorAll('.wo-timer[data-start]');
    const now = Date.now();
    
    timers.forEach(timer => {
        const startTime = new Date(timer.dataset.start).getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        const timerValue = timer.querySelector('.timer-value');
        if (timerValue && elapsed >= 0) {
            timerValue.textContent = formatDuration(elapsed);
            
            // Zmień kolor po 30 minutach
            if (elapsed > 1800) {
                timer.classList.add('timer-warning');
            }
            // Zmień kolor po godzinie
            if (elapsed > 3600) {
                timer.classList.remove('timer-warning');
                timer.classList.add('timer-danger');
            }
        }
    });
}

// Skróty klawiszowe
function handleKeyboardShortcuts(e) {
    // Ignoruj jeśli focus jest w input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
    }
    
    switch(e.key.toLowerCase()) {
        case 'r':
            // R = Odśwież
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                refreshOrders();
                showToast('Odświeżono listę zleceń', 'success');
            }
            break;
        case 'z':
            // Z = Przełącz widok ZP
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                toggleDisplayMode();
            }
            break;
        case 'f':
            // F = Tryb pełnoekranowy
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                toggleFullscreen();
            }
            break;
        case 'escape':
            // ESC = Zamknij modalne
            closeAllModals();
            break;
    }
}

// Tryb pełnoekranowy
function toggleFullscreen() {
    const header = document.querySelector('.prod-header');
    const stats = document.querySelector('.prod-stats');
    const toolbar = document.querySelector('.prod-toolbar');
    
    document.body.classList.toggle('fullscreen-mode');
    
    if (document.body.classList.contains('fullscreen-mode')) {
        if (header) header.style.display = 'none';
        if (stats) stats.style.display = 'none';
        showToast('Tryb pełnoekranowy (F aby wyjść)', 'info');
    } else {
        if (header) header.style.display = '';
        if (stats) stats.style.display = '';
    }
}

// Zamknij wszystkie modale
function closeAllModals() {
    const modals = document.querySelectorAll('.modal, .prod-modal');
    modals.forEach(modal => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    });
    closeProductImage();
}

// Parsuje projectQuantities - może być JSON array lub string "4,3,3"
function parseProjectQuantities(projectQuantities, selectedProjects) {
    if (!projectQuantities) return null;
    
    try {
        // Jeśli to JSON array obiektów [{projectNo: 1, qty: 4}, ...]
        if (projectQuantities.startsWith('[')) {
            const parsed = JSON.parse(projectQuantities);
            if (Array.isArray(parsed)) {
                // Format: [{projectNo: 1, qty: 4}, {projectNo: 2, qty: 3}]
                return parsed.map(p => ({
                    project: p.projectNo || p.project || '?',
                    qty: p.qty || p.quantity || 0
                }));
            }
        }
    } catch (e) {
        // Nie JSON, spróbuj jako string
    }
    
    // Jeśli to string "4,3,3" i mamy projekty "1,2,3"
    const qtys = projectQuantities.split(',').map(q => parseInt(q.trim(), 10) || 0);
    const projs = selectedProjects ? selectedProjects.split(',').map(p => p.trim()) : [];
    
    return qtys.map((qty, i) => ({
        project: projs[i] || (i + 1).toString(),
        qty: qty
    }));
}

// Formatuje projekty i ilości do czytelnej formy
function formatProjectsDisplay(selectedProjects, projectQuantities) {
    const parsed = parseProjectQuantities(projectQuantities, selectedProjects);
    if (!parsed || parsed.length === 0) return null;
    
    return parsed.map(p => `<span class="proj-item"><span class="proj-num">${p.project}</span><span class="proj-qty">${p.qty}</span></span>`).join('');
}

// ============================================
// INICJALIZACJA
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('[PRODUCTION] DOM loaded');
    checkAuth();
    initViewSettings();
    startProductionSse();
    loadOrders(true);
    loadStats();

    setupInactivityLogout();
    
    // Szybki polling przez pierwsze 2 minuty (co 5s), potem normalny (co 30s)
    startFastPolling();
    
    // Aktualizacja timerów co sekundę
    setInterval(updateTimers, 1000);
    
    // Skróty klawiszowe
    document.addEventListener('keydown', handleKeyboardShortcuts);
});

/**
 * Szybki polling na start - co 5s przez 2 minuty, potem co 30s
 * Unika pełnego re-renderu jeśli dane się nie zmieniły
 */
let lastOrdersHash = '';

function startFastPolling() {
    const FAST_INTERVAL = 5000;   // 5 sekund
    const NORMAL_INTERVAL = 30000; // 30 sekund
    const FAST_DURATION = 120000;  // 2 minuty
    
    // Szybki polling
    refreshInterval = setInterval(() => {
        loadOrdersSilent();
        loadStats();
    }, FAST_INTERVAL);
    
    // Po 2 minutach przełącz na normalny
    setTimeout(() => {
        clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            loadOrdersSilent();
            loadStats();
        }, NORMAL_INTERVAL);
        console.log('[PRODUCTION] Przełączono na normalny polling (30s)');
    }, FAST_DURATION);
    
    console.log('[PRODUCTION] Szybki polling aktywny (5s przez 2 min)');
}

/**
 * Cichy polling - odświeża dane tylko jeśli się zmieniły (bez pulsowania)
 */
function computeOrdersHash(payload) {
    return JSON.stringify({
        orderIds: (payload.data || []).map(o => o.id + ':' + o.status),
        woIds: (payload.workOrders || []).map(wo => wo.id + ':' + (wo.orders ? wo.orders.length : 0))
    });
}

async function loadOrdersSilent() {
    try {
        const url = `/api/production/orders/active?workOrdersView=${workOrdersView}`;
        const response = await fetch(url, { credentials: 'include' });
        const data = await response.json();
        
        if (data.status === 'success') {
            // Sprawdź czy dane się zmieniły
            const newHash = computeOrdersHash(data);
            
            if (newHash !== lastOrdersHash) {
                lastOrdersHash = newHash;
                orders = data.data || [];
                workOrders = data.workOrders || [];
                summary = data.summary || {};
                applyFiltersAndSort();
                renderOrders();
                updateSummaryDisplay();
                console.log('[PRODUCTION] Dane zaktualizowane (wykryto zmiany)');
            }
            // Jeśli brak zmian - nie renderuj ponownie (brak pulsowania)
        }
    } catch (error) {
        console.error('[PRODUCTION] Błąd cichego pollingu:', error);
    }
}

function initViewSettings() {
    // Przywróć tryb widoku
    applyViewMode();
    
    // Przywróć sortowanie
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = sortMode;
    
    // Przywróć tryb wyświetlania (pozycje / zbiorcze ZP)
    updateDisplayModeButton();
    updateWorkOrdersViewButtons();
}

// Setup product image modal event listeners
function setupProductImageModal() {
    if (productImageClose) {
        productImageClose.addEventListener('click', closeProductImage);
    }
    
    if (productImageZoom) {
        productImageZoom.addEventListener('click', toggleImageZoom);
    }
    
    if (productImageDownload) {
        productImageDownload.addEventListener('click', downloadImage);
    }
    
    // Close modal on backdrop click
    if (productImageModal) {
        productImageModal.addEventListener('click', (e) => {
            if (e.target === productImageModal) {
                closeProductImage();
            }
        });
    }
}

// ============================================
// WIDOK I FILTRY
// ============================================
function toggleViewMode() {
    const modes = ['grid', 'compact', 'list'];
    const currentIndex = modes.indexOf(viewMode);
    viewMode = modes[(currentIndex + 1) % modes.length];
    localStorage.setItem('prodViewMode', viewMode);
    applyViewMode();
}

function applyViewMode() {
    document.body.classList.remove('compact-mode', 'list-mode');
    
    const btn = document.getElementById('viewModeBtn');
    if (btn) {
        if (viewMode === 'list') {
            document.body.classList.add('list-mode');
            btn.innerHTML = '<i class="fas fa-list"></i>';
            btn.title = 'Widok listy';
        } else if (viewMode === 'compact') {
            document.body.classList.add('compact-mode');
            btn.innerHTML = '<i class="fas fa-compress-alt"></i>';
            btn.title = 'Widok kompaktowy';
        } else {
            btn.innerHTML = '<i class="fas fa-th-large"></i>';
            btn.title = 'Widok kafelków';
        }
    }
}

function toggleFilter(filterName) {
    activeFilters[filterName] = !activeFilters[filterName];
    
    const btn = document.getElementById('filter' + filterName.charAt(0).toUpperCase() + filterName.slice(1));
    if (btn) {
        btn.classList.toggle('active', activeFilters[filterName]);
    }
    
    applyFiltersAndSort();
    renderOrders();
}

// Przypinanie zleceń
function togglePin(orderId) {
    const id = String(orderId);
    const index = pinnedOrders.indexOf(id);
    if (index > -1) {
        pinnedOrders.splice(index, 1);
    } else {
        pinnedOrders.push(id);
    }
    localStorage.setItem('pinnedOrders', JSON.stringify(pinnedOrders));
    console.log('[PIN] Pinned orders:', pinnedOrders);
    applyFiltersAndSort();
    renderOrders();
}

function isPinned(orderId) {
    return pinnedOrders.includes(String(orderId));
}

function sortOrders() {
    const select = document.getElementById('sortSelect');
    if (select) {
        sortMode = select.value;
        localStorage.setItem('prodSortMode', sortMode);
    }
    
    // Sortuj odpowiednią tablicę w zależności od trybu wyświetlania
    if (displayMode === 'workorders') {
        // Tryb Zbiorcze ZP - sortuj tablicę workOrders
        sortWorkOrders();
    } else {
        // Tryb pojedynczych pozycji - sortuj przefiltrowane zamówienia
        applyFiltersAndSort();
    }
    
    renderOrders();
}

function sortWorkOrders() {
    // Sortowanie tablicy workOrders dla widoku Zbiorczych ZP
    workOrders.sort((a, b) => {
        // Przypięte zawsze na górze (chyba że sortujemy po pinned)
        if (sortMode !== 'pinned') {
            const aPinned = isPinned(a.id);
            const bPinned = isPinned(b.id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
        }
        
        switch (sortMode) {
            case 'priority':
                // Oblicz priorytet ZP na podstawie najwyższego priorytetu w zamówieniach
                const aPriority = getWorkOrderPriority(a);
                const bPriority = getWorkOrderPriority(b);
                return aPriority - bPriority;
            case 'pinned':
                const aPinned = isPinned(a.id);
                const bPinned = isPinned(b.id);
                if (aPinned && !bPinned) return -1;
                if (!aPinned && bPinned) return 1;
                const pinnedPriorityA = getWorkOrderPriority(a);
                const pinnedPriorityB = getWorkOrderPriority(b);
                return pinnedPriorityA - pinnedPriorityB;
            case 'quantity-asc':
                return (a.totalQuantity || 0) - (b.totalQuantity || 0);
            case 'quantity-desc':
                return (b.totalQuantity || 0) - (a.totalQuantity || 0);
            case 'date':
                // Sortuj po dacie zamówienia handlowa (najstarsze na górze)
                const aOrderDate = a.orders?.[0]?.sourceOrder?.createdAt ? new Date(a.orders[0].sourceOrder.createdAt).getTime() : Infinity;
                const bOrderDate = b.orders?.[0]?.sourceOrder?.createdAt ? new Date(b.orders[0].sourceOrder.createdAt).getTime() : Infinity;
                return aOrderDate - bOrderDate;
            default:
                return 0;
        }
    });
}

// Pomocnicza funkcja do pobierania priorytetu ZP
function getWorkOrderPriority(workOrder) {
    if (!workOrder.orders || workOrder.orders.length === 0) return 3;
    // Zwróć najwyższy priorytet spośród zamówień w ZP (użyj computedPriority jeśli dostępne)
    return Math.min(...workOrder.orders.map(order => order.computedPriority || order.priority || 3));
}

// Oblicza status Zbiorczego ZP na podstawie statusów poszczególnych zamówień
function computeWorkOrderStatus(wo) {
    if (!wo.orders || wo.orders.length === 0) {
        return 'planned';
    }
    
    const statuses = wo.orders.map(o => o.status);
    const allCompleted = statuses.every(s => s === 'completed');
    const anyInProgress = statuses.some(s => s === 'in_progress' || s === 'paused');
    const anyApproved = statuses.some(s => s === 'approved');
    
    if (allCompleted) {
        return 'completed';
    } else if (anyInProgress) {
        return 'in_progress';
    } else if (anyApproved) {
        return 'approved';
    } else {
        return 'planned';
    }
}

function applyFiltersAndSort() {
    // Filtrowanie
    filteredOrders = orders.filter(order => {
        // Filtr: Pilne (priorytet 1-2)
        if (activeFilters.urgent && (order.priority || 3) > 2) {
            return false;
        }
        // Filtr: Małe zlecenia (<= 20 szt)
        if (activeFilters.small && (order.quantity || 0) > 20) {
            return false;
        }
        // Filtr: Tylko przypięte
        if (activeFilters.pinned && !isPinned(order.id)) {
            return false;
        }
        // Filtr: Wybrana maszyna
        if (selectedMachineId && !orderMatchesSelectedMachine(order)) {
            return false;
        }
        return true;
    });
    
    // Sortowanie
    filteredOrders.sort((a, b) => {
        // Przypięte zawsze na górze (chyba że sortujemy po pinned)
        if (sortMode !== 'pinned') {
            const aPinned = isPinned(a.id);
            const bPinned = isPinned(b.id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
        }
        
        switch (sortMode) {
            case 'priority':
                return (a.priority || 3) - (b.priority || 3);
            case 'pinned':
                const aPinned = isPinned(a.id);
                const bPinned = isPinned(b.id);
                if (aPinned && !bPinned) return -1;
                if (!aPinned && bPinned) return 1;
                return (a.priority || 3) - (b.priority || 3);
            case 'quantity-asc':
                return (a.quantity || 0) - (b.quantity || 0);
            case 'quantity-desc':
                return (b.quantity || 0) - (a.quantity || 0);
            case 'date':
                return new Date(a.createdat || 0) - new Date(b.createdat || 0);
            default:
                return 0;
        }
    });
}

// Sprawdza, czy zlecenie pasuje do wybranej maszyny w pokoju
function orderMatchesSelectedMachine(order) {
    if (workOrdersView === 'completed') {
        return true;
    }
    if (!selectedMachineId || !roomMachines || roomMachines.length === 0) {
        return true;
    }

    const machine = roomMachines.find(m => m.id === selectedMachineId);
    if (!machine) return true;

    const ops = Array.isArray(order.operations) ? order.operations : [];
    if (ops.length === 0) return true;

    const machineId = machine.id;
    const machineType = machine.type || (machine.WorkCenter && machine.WorkCenter.type) || null;

    return ops.some(op => {
        const opWorkStationId =
            (op.workStation && op.workStation.id) ||
            op.workstationid ||
            op.workStationId ||
            null;

        if (opWorkStationId && opWorkStationId === machineId) {
            return true;
        }

        const opType = op.operationtype || op.operationType;
        if (!machineType || !opType) return false;

        if (opType === machineType) return true;
        if (opType === `path_${machineType}`) return true;
        return opType.includes(machineType);
    });
}

// ============================================
// AUTORYZACJA
// ============================================

// Multiroom - dostępne pokoje użytkownika
let availableRooms = [];
let activeRoomId = null;

function checkAuth() {
    // Ciasteczka są HttpOnly, więc nie możemy ich sprawdzić w JS przez document.cookie.
    // Musimy zaufać, że przeglądarka je wyśle i sprawdzić odpowiedź z API.

    fetch('/api/auth/me', { credentials: 'include' })
        .then(r => {
            if (r.status === 401 || r.status === 403) {
                // Brak autoryzacji lub brak uprawnień (brak sesji) – wróć do logowania
                window.location.href = '/login.html';
                return null;
            }
            return r.json();
        })
        .then(data => {
            if (!data || data.status !== 'success') {
                return;
            }

            const role = data.role;
            const allowedRoles = ['ADMIN', 'PRODUCTION', 'OPERATOR', 'PRODUCTION_MANAGER'];

            // Zalogowany, ale bez uprawnień do panelu produkcji – pokaż komunikat zamiast logowania
            if (!allowedRoles.includes(role)) {
                const ordersList = document.getElementById('ordersList');
                if (ordersList) {
                    ordersList.innerHTML = `
                        <div class="prod-empty">
                            <i class="fas fa-lock"></i>
                            <div class="prod-empty-text">Brak uprawnień do panelu produkcji.</div>
                            <div style="color: var(--prod-text-muted); margin-top: 8px; font-size: 14px;">
                                Zaloguj się jako użytkownik z rolą PRODUKCJA lub OPERATOR.
                            </div>
                        </div>
                    `;
                }

                const quickActions = document.querySelector('.prod-quick-actions');
                if (quickActions) {
                    quickActions.style.display = 'none';
                }

                return;
            }

            const userName = data.name || data.email || 'Operator';
            const userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl.textContent = userName;
            }

            // Pokaż link do Grafiki dla kierownika produkcji i admina
            const prodNavGraphics = document.getElementById('prod-nav-graphics');
            if (prodNavGraphics && ['PRODUCTION_MANAGER', 'ADMIN'].includes(role)) {
                prodNavGraphics.style.display = 'flex';
            }

            const prodNavAssignments = document.getElementById('prod-nav-assignments');
            if (prodNavAssignments && ['PRODUCTION_MANAGER', 'ADMIN'].includes(role)) {
                prodNavAssignments.style.display = 'flex';
            }

            // Multiroom: zapisz dostępne pokoje
            availableRooms = data.productionRooms || [];
            const hasMultipleRooms = data.hasMultipleRooms || availableRooms.length > 1;

            // Sprawdź czy jest zapisany aktywny pokój w localStorage
            const savedRoomId = localStorage.getItem('activeProductionRoomId');
            const savedRoomValid = savedRoomId && availableRooms.some(r => r.id === parseInt(savedRoomId, 10));

            // Ustal aktywny pokój
            if (savedRoomValid) {
                activeRoomId = parseInt(savedRoomId, 10);
            } else if (data.productionroomid) {
                activeRoomId = parseInt(data.productionroomid, 10);
            } else if (availableRooms.length > 0) {
                const primaryRoom = availableRooms.find(r => r.isPrimary) || availableRooms[0];
                activeRoomId = primaryRoom.id;
            }

            // Zapisz aktywny pokój
            if (activeRoomId) {
                localStorage.setItem('activeProductionRoomId', activeRoomId);
            }

            // Wyświetl badge pokoju lub selector multiroom
            const roomBadge = document.getElementById('roomBadge');
            const roomNameEl = document.getElementById('roomName');

            if (hasMultipleRooms && roomBadge) {
                // Multiroom: pokaż dropdown zamiast statycznego badge
                renderRoomSelector(roomBadge, availableRooms, activeRoomId);
            } else if (roomBadge && roomNameEl) {
                // Pojedynczy pokój: statyczny badge
                const activeRoom = availableRooms.find(r => r.id === activeRoomId);
                const roomName = activeRoom?.name || data.productionRoomName;
                if (roomName) {
                    roomNameEl.textContent = roomName;
                    roomBadge.style.display = 'flex';
                }
            }

            // Zapamiętaj pokój produkcyjny operatora i wczytaj maszyny w pokoju
            if (activeRoomId) {
                currentRoomId = activeRoomId;
                loadRoomMachines();
            }
        })
        .catch((err) => {
            console.error('Błąd sprawdzania autoryzacji:', err);
            // W razie błędu sieciowego nie wylogowujemy od razu,
            // bo może to być tylko chwilowy brak neta na hali.
            const userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl.textContent = 'Offline?';
            }
        });
}

/**
 * Renderuje selector pokoju produkcyjnego (multiroom)
 */
function renderRoomSelector(container, rooms, selectedRoomId) {
    const selectedRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0];
    
    container.innerHTML = `
        <div class="room-selector" style="position: relative;">
            <button id="roomSelectorBtn" class="room-selector-btn" title="Zmień pokój produkcyjny">
                <i class="fas fa-door-open"></i>
                <span id="roomName">${escapeHtml(selectedRoom?.name || 'Wybierz pokój')}</span>
                <i class="fas fa-chevron-down" style="font-size: 10px; margin-left: 4px;"></i>
            </button>
            <div id="roomSelectorDropdown" class="room-selector-dropdown hidden">
                ${rooms.map(room => `
                    <div class="room-selector-item ${room.id === selectedRoomId ? 'active' : ''}" 
                         data-room-id="${room.id}">
                        <span>${escapeHtml(room.name)}</span>
                        ${room.isPrimary ? '<i class="fas fa-star" style="color: #f59e0b; font-size: 10px;"></i>' : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    container.style.display = 'flex';

    // Event listeners
    const btn = document.getElementById('roomSelectorBtn');
    const dropdown = document.getElementById('roomSelectorDropdown');

    btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown?.classList.toggle('hidden');
    });

    dropdown?.querySelectorAll('.room-selector-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const roomId = parseInt(item.dataset.roomId, 10);
            if (roomId && roomId !== activeRoomId) {
                switchProductionRoom(roomId);
            }
            dropdown.classList.add('hidden');
        });
    });

    // Zamknij dropdown po kliknięciu poza
    document.addEventListener('click', () => {
        dropdown?.classList.add('hidden');
    });
}

/**
 * Przełącza aktywny pokój produkcyjny
 */
function switchProductionRoom(newRoomId) {
    activeRoomId = newRoomId;
    currentRoomId = newRoomId;
    localStorage.setItem('activeProductionRoomId', newRoomId);

    // Aktualizuj UI
    const selectedRoom = availableRooms.find(r => r.id === newRoomId);
    const roomNameEl = document.getElementById('roomName');
    if (roomNameEl && selectedRoom) {
        roomNameEl.textContent = selectedRoom.name;
    }

    // Aktualizuj aktywną klasę w dropdown
    document.querySelectorAll('.room-selector-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.roomId, 10) === newRoomId);
    });

    // Przeładuj maszyny dla nowego pokoju
    loadRoomMachines();

    // Opcjonalnie: przeładuj zlecenia (jeśli są filtrowane po pokoju)
    loadOrders(true);

    console.log(`[PRODUCTION] Przełączono na pokój: ${selectedRoom?.name} (ID: ${newRoomId})`);
}

// ============================================
// MASZYNY W POKOJU OPERATORA
// ============================================

async function loadRoomMachines() {
    const bar = document.getElementById('machineBar');
    if (!bar || !currentRoomId) return;

    try {
        const response = await fetch(`/api/production/rooms/${currentRoomId}/machine-assignments`, {
            credentials: 'include'
        });
        const result = await response.json();

        if (result.status === 'success' && result.data && Array.isArray(result.data.machines)) {
            roomMachines = result.data.machines;
            renderMachineBar();
        } else {
            console.warn('Błąd ładowania maszyn pokoju:', result.message);
        }
    } catch (error) {
        console.error('Błąd ładowania maszyn pokoju:', error);
    }
}

function renderMachineBar() {
    const bar = document.getElementById('machineBar');
    if (!bar) return;

    if (!roomMachines || roomMachines.length === 0) {
        bar.style.display = 'none';
        bar.innerHTML = '';
        return;
    }

    bar.style.display = 'flex';

    let html = '';

    // Kafelek "Wszystkie maszyny"
    const isAllActive = !selectedMachineId;
    html += `
        <button type="button" class="prod-machine-chip ${isAllActive ? 'active' : ''}" onclick="setSelectedMachine(null)">
            <div class="prod-machine-chip-title">
                <i class="fas fa-layer-group"></i>
                <span>Wszystkie maszyny</span>
            </div>
            <div class="prod-machine-chip-status">
                ${orders.length} zleceń
            </div>
        </button>
    `;

    roomMachines.forEach(machine => {
        const isActive = selectedMachineId === machine.id;
        const status = machine.status || 'available';
        let statusLabel = 'Dostępna';
        let statusIcon = 'fa-circle';

        if (status === 'in_use') {
            statusLabel = 'W użyciu';
            statusIcon = 'fa-bolt';
        } else if (status === 'maintenance') {
            statusLabel = 'Przegląd';
            statusIcon = 'fa-tools';
        } else if (status === 'breakdown') {
            statusLabel = 'Awaria';
            statusIcon = 'fa-exclamation-triangle';
        }

        html += `
            <button type="button" class="prod-machine-chip ${isActive ? 'active' : ''}" onclick="setSelectedMachine(${machine.id})">
                <div class="prod-machine-chip-title">
                    <i class="fas ${statusIcon}"></i>
                    <span>${machine.name}</span>
                </div>
                <div class="prod-machine-chip-code">${machine.code}</div>
                <div class="prod-machine-chip-status">${statusLabel}</div>
            </button>
        `;
    });

    bar.innerHTML = html;
}

function setSelectedMachine(machineId) {
    if (machineId === null || machineId === undefined) {
        selectedMachineId = null;
    } else {
        const parsed = parseInt(machineId, 10);
        selectedMachineId = Number.isNaN(parsed) ? null : parsed;
    }

    applyFiltersAndSort();
    renderOrders();
    renderMachineBar();
}

function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        .then(() => {
            window.location.href = '/login.html';
        })
        .catch(() => {
            window.location.href = '/login.html';
        });
}

// ============================================
// POBIERANIE DANYCH
// ============================================
async function loadStats() {
    try {
        const response = await fetch('/api/production/operator/stats', { credentials: 'include' });
        const data = await response.json();
        
        if (data.status === 'success') {
            document.getElementById('statActive').textContent = data.data.active || 0;
            document.getElementById('statQueue').textContent = data.data.queue || 0;
            document.getElementById('statCompleted').textContent = data.data.completedToday || 0;
        }
    } catch (error) {
        console.error('Błąd ładowania statystyk:', error);
    }
}

async function loadOrders(silent = false) {
    const container = document.getElementById('ordersList');
    
    if (!silent) {
        container.innerHTML = '<div class="prod-loading"><div class="prod-spinner"></div></div>';
    }
    
    try {
        // Przekaż parametr workOrdersView do API
        const url = `/api/production/orders/active?workOrdersView=${workOrdersView}`;
        const response = await fetch(url, { credentials: 'include' });
        const data = await response.json();
        
        if (data.status === 'success') {
            orders = data.data || [];
            workOrders = data.workOrders || [];
            summary = data.summary || {};
            if (!silent) {
                lastOrdersHash = computeOrdersHash(data);
            }
            applyFiltersAndSort();
            renderOrders();
            updateSummaryDisplay();
        } else {
            throw new Error(data.message || 'Błąd pobierania zleceń');
        }
    } catch (error) {
        console.error('Błąd ładowania zleceń:', error);
        if (!silent) {
            container.innerHTML = `
                <div class="prod-empty">
                    <i class="fas fa-exclamation-circle"></i>
                    <div class="prod-empty-text">Błąd ładowania zleceń</div>
                    <button class="prod-btn prod-btn-secondary" onclick="loadOrders()" style="margin-top: 16px;">
                        <i class="fas fa-sync-alt"></i> Spróbuj ponownie
                    </button>
                </div>
            `;
        }
    }
}

// Aktualizuj wyświetlanie podsumowania kolejki
function updateSummaryDisplay() {
    const summaryEl = document.getElementById('queueSummary');
    if (summaryEl && summary.queueQuantity !== undefined) {
        summaryEl.textContent = `Łącznie: ${summary.queueQuantity} szt.`;
        summaryEl.style.display = 'inline';
    }
}

function refreshOrders() {
    loadOrders();
    loadStats();
}

// ============================================
// RENDEROWANIE
// ============================================
function renderOrders() {
    const container = document.getElementById('ordersList');
    
    // Tryb Zbiorcze ZP
    if (displayMode === 'workorders') {
        renderWorkOrders(container);
        return;
    }
    
    // Tryb pojedynczych pozycji (domyślny)
    // Użyj przefiltrowanych zleceń
    const displayOrders = filteredOrders.length > 0 || (activeFilters.urgent || activeFilters.small) 
        ? filteredOrders 
        : orders;
    
    if (displayOrders.length === 0) {
        const hasFilters = activeFilters.urgent || activeFilters.small;
        container.innerHTML = `
            <div class="prod-empty">
                <i class="fas ${hasFilters ? 'fa-filter' : 'fa-clipboard-check'}"></i>
                <div class="prod-empty-text">${hasFilters ? 'Brak zleceń spełniających filtry' : 'Brak aktywnych zleceń'}</div>
                <div style="color: var(--prod-text-muted); margin-top: 8px; font-size: 14px;">
                    ${hasFilters ? 'Spróbuj wyłączyć filtry' : 'Wszystkie zlecenia zostały wykonane'}
                </div>
            </div>
        `;
        return;
    }
    
    // Podziel na aktywne i w kolejce
    const activeOrders = displayOrders.filter(o => o.status === 'in_progress');
    const queueOrders = displayOrders.filter(o => o.status !== 'in_progress');
    
    let html = '';
    
    // Pokaż licznik jeśli są aktywne filtry
    if (activeFilters.urgent || activeFilters.small) {
        html += `<div class="prod-filter-info">Pokazuję ${displayOrders.length} z ${orders.length} zleceń</div>`;
    }
    
    if (activeOrders.length > 0) {
        html += '<div class="prod-section-title"><i class="fas fa-play-circle"></i> W TRAKCIE</div>';
        activeOrders.forEach(order => {
            html += renderOrderCard(order);
        });
    }
    
    if (queueOrders.length > 0) {
        const queueQty = queueOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
        html += `<div class="prod-section-title"><i class="fas fa-list"></i> KOLEJKA (${queueOrders.length}) <span class="prod-queue-summary">• ${queueQty} szt.</span></div>`;
        queueOrders.forEach(order => {
            html += renderOrderCard(order);
        });
    }
    
    container.innerHTML = html;
    
    // Uruchom timery dla aktywnych zleceń
    activeOrders.forEach(order => {
        if (order.currentOperation?.starttime) {
            startTimer(order.id, order.currentOperation.starttime);
        }
    });

    // Zaktualizuj pasek maszyn (może używać liczby zleceń)
    renderMachineBar();
}

// Renderowanie widoku Zbiorczych ZP (ProductionWorkOrder)
function renderWorkOrders(container) {
    if (workOrders.length === 0) {
        container.innerHTML = `
            <div class="prod-empty">
                <i class="fas fa-clipboard-check"></i>
                <div class="prod-empty-text">Brak zbiorczych zleceń produkcyjnych</div>
                <div style="color: var(--prod-text-muted); margin-top: 8px; font-size: 14px;">
                    Nowe zamówienia pojawią się tutaj po zatwierdzeniu
                </div>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    // Nagłówek z podsumowaniem
    const totalQty = workOrders.reduce((sum, wo) => sum + wo.totalQuantity, 0);
    html += `<div class="prod-section-title"><i class="fas fa-layer-group"></i> ZBIORCZE ZP (${workOrders.length}) <span class="prod-queue-summary">• ${totalQty} szt.</span></div>`;
    
    workOrders.forEach(wo => {
        html += renderWorkOrderCard(wo);
    });
    
    container.innerHTML = html;
}

// Renderowanie karty Zbiorczego ZP - PRZEPROJEKTOWANY (kompaktowy kafelek)
function renderWorkOrderCard(wo) {
    // Oblicz status ZP na podstawie statusów poszczególnych zamówień
    const woStatus = computeWorkOrderStatus(wo);
    
    const statusLabels = {
        'planned': 'Zaplanowane',
        'approved': 'Do realizacji',
        'in_progress': 'W trakcie',
        'completed': 'Zakończone'
    };
    
    const statusClass = woStatus.replace('_', '-');
    const computedPriority = getWorkOrderPriority(wo);
    const priorityClass = `p${computedPriority}`;
    const priorityHighClass = (computedPriority === 1) ? 'priority-high' : '';
    const isOpen = openWorkOrderDetails.has(String(wo.id));
    
    // Oblicz postęp
    const completedOrders = wo.orders.filter(o => o.status === 'completed').length;
    const inProgressOrders = wo.orders.filter(o => o.status === 'in_progress').length;
    const pendingOrders = wo.orders.length - completedOrders;
    const progressPercent = wo.orders.length > 0 ? Math.round((completedOrders / wo.orders.length) * 100) : 0;
    const isAllCompleted = completedOrders === wo.orders.length && wo.orders.length > 0;
    
    // Numer zamówienia źródłowego
    const sourceOrder = wo.orders[0]?.sourceOrder;
    const orderNumber = sourceOrder?.orderNumber || '---';
    const customer = sourceOrder?.customer?.name || 'Klient';
    
    // Badge SLA/termin - pobierz z pierwszego zlecenia
    const deliveryDate = sourceOrder?.deliveryDate || wo.orders[0]?.deliveryDate;
    const slaBadge = getSlaBadge(deliveryDate);
    
    // Polska odmiana "produkt"
    function getProduktWord(count) {
        if (count === 1) return 'produkt';
        const tens = Math.floor(count / 10) * 10;
        const ones = count % 10;
        if ((tens === 10 || tens === 20 || tens === 30 || tens === 40 || tens === 50 || tens === 60 || tens === 70 || tens === 80 || tens === 90 || tens === 100) && (ones >= 2 && ones <= 4)) {
            return 'produkty';
        }
        if (ones >= 2 && ones <= 4 && tens !== 10 && tens !== 20 && tens !== 30 && tens !== 40 && tens !== 50 && tens !== 60 && tens !== 70 && tens !== 80 && tens !== 90) {
            return 'produkty';
        }
        return 'produktów';
    }
    
    return `
        <div class="prod-workorder-card status-${statusClass} ${priorityHighClass} ${isAllCompleted ? 'all-completed' : ''}" data-workorder-id="${wo.id}">
            <div class="wo-header">
                <div class="wo-number-row">
                    <span class="wo-number">${wo.workOrderNumber}</span>
                    <span class="wo-room-badge"><i class="fas fa-door-open"></i> ${escapeHtml(wo.roomName)}</span>
                </div>
                <div class="wo-status-row">
                    <span class="prod-status-badge ${statusClass}">${statusLabels[woStatus] || woStatus}</span>
                    <span class="prod-priority-badge ${priorityClass}">${computedPriority}</span>
                    ${slaBadge}
                </div>
            </div>
            
            <div class="wo-body-compact">
                <div class="wo-order-info">
                    <a href="/orders.html?search=${encodeURIComponent(orderNumber)}" class="wo-order-link" title="Otwórz zamówienie">
                        <i class="fas fa-receipt"></i> ${orderNumber}
                    </a>
                    <span class="wo-customer"><i class="fas fa-user"></i> ${escapeHtml(customer)}</span>
                </div>
                
                <div class="wo-metrics">
                    <span class="wo-metric"><strong>${wo.productsCount}</strong> ${getProduktWord(wo.productsCount)}</span>
                    <span class="wo-metric-sep">•</span>
                    <span class="wo-metric"><strong>${wo.totalQuantity}</strong> szt.</span>
                    ${inProgressOrders > 0 ? `<span class="wo-metric-sep">•</span><span class="wo-metric active"><strong>${inProgressOrders}</strong> w trakcie</span>` : ''}
                </div>
                
                <div class="wo-progress-compact">
                    <div class="wo-progress-bar">
                        <div class="wo-progress-fill ${isAllCompleted ? 'completed' : ''}" style="width: ${progressPercent}%"></div>
                    </div>
                    <span class="wo-progress-label">${completedOrders}/${wo.orders.length} ${isAllCompleted ? '✓' : ''}</span>
                </div>
            </div>
            
            <div class="wo-actions">
                <button class="prod-btn prod-btn-secondary" onclick="toggleWorkOrderDetails(${wo.id})" title="Pokaż/ukryj pozycje">
                    <i class="fas ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'}"></i> Szczegóły
                </button>
                <button class="prod-btn prod-btn-print" onclick="printWorkOrder(${wo.id})" title="Drukuj zlecenie produkcyjne">
                    <i class="fas fa-print"></i> Drukuj
                </button>
            </div>
            
            <div class="wo-details ${isOpen ? 'open' : ''}" id="wo-details-${wo.id}">
                ${wo.orders.map(order => renderOrderCardCompact(order)).join('')}
            </div>
        </div>
    `;
}

// Kompaktowa karta pozycji wewnątrz ZP - z oznaczeniem completed i numerem matrycy
function renderOrderCardCompact(order) {
    const product = order.product || {};
    const orderItem = order.sourceOrderItem || {};
    const statusLabels = {
        'planned': 'Zaplanowane',
        'approved': 'Do realizacji',
        'in_progress': 'W trakcie',
        'completed': 'Zakończone'
    };
    
    const isCompleted = order.status === 'completed';
    const ops = Array.isArray(order.operations) ? order.operations : [];
    const derivedCurrentOp = ops.find(op => op.status === 'active') || ops.find(op => op.status === 'paused') || null;
    const derivedNextOp = ops.find(op => op.status === 'pending') || null;
    const currentOp = order.currentOperation || derivedCurrentOp;
    const nextOp = order.nextOperation || derivedNextOp;
    const canStart = !isCompleted && !currentOp && nextOp && (
        order.status === 'approved' ||
        order.status === 'planned' ||
        order.status === 'in_progress' ||
        order.status === 'paused'
    );
    const canComplete = !isCompleted && currentOp && (currentOp.status === 'active' || currentOp.status === 'paused');
    const operationId = currentOp?.id || nextOp?.id;
    
    // Dane z pozycji zamówienia
    const source = orderItem.source || '';
    const location = orderItem.locationName || orderItem.projectName || '';
    const projects = formatProjectsDisplay(orderItem.selectedProjects, orderItem.projectQuantities);
    const notes = order.productionnotes || orderItem.productionNotes || '';
    
    // Wyciągnij numer matrycy z notatek (format: "MATRYCA: 12345" lub "Matryca: 12345")
    const matrixMatch = notes.match(/MATRYCA:\s*(\S+)/i);
    const matrixNumber = matrixMatch ? matrixMatch[1] : null;
    
    // Źródło ilości (czy wg projektów czy suma całkowita)
    const quantitySource = orderItem.source === 'PROJEKTY' ? 'PROJEKTY' : 'SUMA';
    
    // URL podglądu produktu
    const previewUrl = orderItem.projectViewUrl || orderItem.projectviewurl || product.imageUrl || '';
    const productName = product.name || product.code || 'Produkt';
    const productIdentifier = product.identifier || product.code || '';
    
    // Timer dla operacji w trakcie
    const startTime = currentOp?.startedat || currentOp?.startedAt;
    const timerHtml = (order.status === 'in_progress' && startTime) ? 
        `<span class="wo-timer" data-start="${startTime}"><i class="fas fa-clock"></i> <span class="timer-value">00:00</span></span>` : '';
    
    return `
        <div class="wo-order-item status-${order.status.replace('_', '-')} ${isCompleted ? 'item-completed' : ''}" data-order-id="${order.id}">
            <div class="wo-order-item-header">
                ${isCompleted ? '<span class="wo-completed-check"><i class="fas fa-check-circle"></i></span>' : ''}
                <span class="wo-order-item-product">${escapeHtml(product.name || product.code || 'Produkt')}</span>
                <span class="wo-order-item-qty">${order.quantity || 0} szt.</span>
                ${timerHtml}
                <span class="wo-order-item-status ${order.status}">${statusLabels[order.status]}</span>
            </div>
            
            <div class="wo-order-item-details">
                ${(source || location) ? `
                <div class="wo-order-item-meta">
                    ${source ? `<span class="wo-source-badge ${source.toLowerCase()}">${source}</span>` : ''}
                    ${location ? `<span class="wo-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(location)}</span>` : ''}
                </div>` : ''}
                
                ${projects ? `
                <div class="wo-order-item-projects">
                    <span class="wo-projects-label"><i class="fas fa-list-ol"></i> Projekty:</span>
                    ${projects}
                    <span class="wo-qty-source ${quantitySource.toLowerCase()}">${quantitySource === 'PROJEKTY' ? 'Wg projektów' : 'Suma całkowita'}</span>
                </div>` : ''}
                
                ${matrixNumber ? `
                <div class="wo-order-item-matrix">
                    <i class="fas fa-hashtag"></i> Matryca: <strong>${escapeHtml(matrixNumber)}</strong>
                </div>` : ''}
                
                ${notes && !matrixMatch ? `
                <div class="wo-order-item-notes">
                    <i class="fas fa-sticky-note"></i> ${escapeHtml(notes)}
                </div>` : ''}
            </div>
            
            ${!isCompleted ? `
            <div class="wo-order-item-actions">
                ${previewUrl ? `
                    <button class="prod-btn-sm prod-btn-view" onclick="showProductImage('${previewUrl}', '${encodeURIComponent(productName)}', '${encodeURIComponent(productIdentifier)}', '${encodeURIComponent(location)}')" title="Podgląd produktu">
                        <i class="fas fa-eye"></i>
                    </button>
                ` : ''}
                ${canStart ? `
                    <button class="prod-btn-sm prod-btn-start" onclick="startOperation(${operationId}, ${order.id})">
                        <i class="fas fa-play"></i> Start
                    </button>
                ` : ''}
                ${canComplete ? `
                    <button class="prod-btn-sm prod-btn-complete" onclick="showCompleteModal(${currentOp.id}, ${order.quantity})">
                        <i class="fas fa-check"></i> Zakończ
                    </button>
                ` : ''}
                ${operationId ? `
                <button class="prod-btn-sm prod-btn-problem" onclick="showProblemModal(${operationId})">
                    <i class="fas fa-exclamation-triangle"></i>
                </button>
                ` : ''}
            </div>
            ` : `
            <div class="wo-order-item-completed-info">
                <i class="fas fa-check-double"></i> Wykonane
            </div>
            `}
        </div>
    `;
}

// Przełącz widoczność szczegółów ZP
function toggleWorkOrderDetails(woId) {
    const detailsEl = document.getElementById(`wo-details-${woId}`);
    if (detailsEl) {
        const isVisible = detailsEl.classList.contains('open');
        const nextVisible = !isVisible;
        
        // Toggle klasy CSS zamiast inline style
        detailsEl.classList.toggle('open', nextVisible);

        // Zapisz stan w localStorage aby nie tracić po renderowaniu
        const idStr = String(woId);
        if (nextVisible) {
            openWorkOrderDetails.add(idStr);
        } else {
            openWorkOrderDetails.delete(idStr);
        }
        localStorage.setItem('prodOpenWorkOrders', JSON.stringify([...openWorkOrderDetails]));
        
        // Zmień ikonę przycisku
        const btn = detailsEl.parentElement.querySelector('.wo-actions button:first-child i');
        if (btn) {
            btn.className = nextVisible ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
        }
    }
}

// Przełącz tryb wyświetlania (pozycje / zbiorcze ZP)
function toggleDisplayMode() {
    displayMode = displayMode === 'orders' ? 'workorders' : 'orders';
    localStorage.setItem('prodDisplayMode', displayMode);
    updateDisplayModeButton();
    renderOrders();
}

// ============================================
// OPTYMISTYCZNE AKTUALIZACJE UI (bez pełnego reloadu)
// ============================================

/**
 * Aktualizuje pojedyncze zlecenie w miejscu (zmiana statusu)
 */
async function updateOrderInPlace(orderId, newStatus, operationId) {
    // Znajdź zlecenie w lokalnych danych
    const orderIndex = orders.findIndex(o => o.id === orderId || String(o.id) === String(orderId));
    if (orderIndex === -1) {
        // Fallback: pełne odświeżenie jeśli nie znaleziono
        await loadOrders(true);
        return;
    }
    
    // Zaktualizuj lokalny stan
    orders[orderIndex].status = newStatus;
    if (operationId) {
        const nowIso = new Date().toISOString();
        orders[orderIndex].currentOperation = {
            ...(orders[orderIndex].currentOperation || {}),
            id: operationId,
            status: 'active',
            startedAt: nowIso,
            startedat: nowIso,
            starttime: nowIso
        };
        if (orders[orderIndex].nextOperation && orders[orderIndex].nextOperation.id === operationId) {
            orders[orderIndex].nextOperation = null;
        }
    }
    
    // Znajdź workOrder zawierający to zlecenie
    const woId = orders[orderIndex].workOrderId || orders[orderIndex].workorderid;
    if (woId) {
        const woIndex = workOrders.findIndex(wo => wo.id === woId || String(wo.id) === String(woId));
        if (woIndex !== -1) {
            // Zaktualizuj zlecenie w workOrder
            const woOrderIndex = workOrders[woIndex].orders.findIndex(o => o.id === orderId || String(o.id) === String(orderId));
            if (woOrderIndex !== -1) {
                workOrders[woIndex].orders[woOrderIndex].status = newStatus;
                if (operationId) {
                    const nowIso = new Date().toISOString();
                    workOrders[woIndex].orders[woOrderIndex].currentOperation = {
                        ...(workOrders[woIndex].orders[woOrderIndex].currentOperation || {}),
                        id: operationId,
                        status: 'active',
                        startedAt: nowIso,
                        startedat: nowIso,
                        starttime: nowIso
                    };
                    if (workOrders[woIndex].orders[woOrderIndex].nextOperation &&
                        workOrders[woIndex].orders[woOrderIndex].nextOperation.id === operationId) {
                        workOrders[woIndex].orders[woOrderIndex].nextOperation = null;
                    }
                }
            }
            
            // Przerenderuj tylko ten kafelek
            rerenderWorkOrderCard(woId);
            return;
        }
    }
    
    // Fallback: pełne renderowanie
    applyFiltersAndSort();
    renderOrders();
}

/**
 * Odświeża pojedynczy WorkOrder z serwera (po zakończeniu operacji)
 */
async function refreshSingleWorkOrder(operationId) {
    try {
        // Pobierz świeże dane tylko dla tego ZP
        const url = `/api/production/orders/active?workOrdersView=${workOrdersView}`;
        const response = await fetch(url, { credentials: 'include' });
        const data = await response.json();
        
        if (data.status === 'success') {
            // Zaktualizuj lokalne dane
            orders = data.data || [];
            workOrders = data.workOrders || [];
            summary = data.summary || {};
            
            // Zachowaj stan otwarcia kafelków i przerenderuj
            applyFiltersAndSort();
            renderOrders();
        }
    } catch (error) {
        console.error('Błąd odświeżania ZP:', error);
    }
}

/**
 * Przerenderowuje pojedynczy kafelek WorkOrder bez przeładowania całej listy
 */
function rerenderWorkOrderCard(woId) {
    const wo = workOrders.find(w => w.id === woId || String(w.id) === String(woId));
    if (!wo) return;
    
    const cardEl = document.querySelector(`[data-workorder-id="${woId}"]`);
    if (!cardEl) return;
    
    // Wygeneruj nowy HTML
    const newHtml = renderWorkOrderCard(wo);
    
    // Zamień element
    const temp = document.createElement('div');
    temp.innerHTML = newHtml;
    const newCard = temp.firstElementChild;
    
    cardEl.replaceWith(newCard);
}

// ============================================
// PRZEŁĄCZNIK WIDOKU ZP: Do zrobienia / Wykonane
// ============================================
function setWorkOrdersView(view) {
    if (!WORKORDER_VIEWS.includes(view)) return;
    workOrdersView = view;
    localStorage.setItem('prodWorkOrdersView', view);
    updateWorkOrdersViewButtons();
    loadOrders(); // Przeładuj dane z nowym filtrem
}

function updateWorkOrdersViewButtons() {
    const buttons = document.querySelectorAll('.wo-view-btn');
    buttons.forEach(btn => {
        const btnView = btn.dataset.view;
        btn.classList.toggle('active', btnView === workOrdersView);
    });
}

// ============================================
// ZAKOŃCZ ZP (A1-lite: potwierdzenie + przełączenie na Wykonane)
// ============================================
function confirmFinishWorkOrder(woId) {
    const wo = workOrders.find(w => w.id === woId);
    if (!wo) {
        showToast('Nie znaleziono zlecenia produkcyjnego', 'error');
        return;
    }
    
    const completedCount = wo.orders.filter(o => o.status === 'completed').length;
    const totalCount = wo.orders.length;
    
    if (completedCount < totalCount) {
        showToast(`Nie wszystkie pozycje są ukończone (${completedCount}/${totalCount})`, 'warning');
        return;
    }
    
    // Pokaż modal potwierdzenia
    if (confirm(`Zlecenie ${wo.workOrderNumber} jest w 100% ukończone.\n\nCzy chcesz przenieść je do widoku "Wykonane"?`)) {
        showToast(`Zlecenie ${wo.workOrderNumber} zakończone!`, 'success');
        // Przełącz na widok "Wykonane"
        setWorkOrdersView('completed');
    }
}

// Utwórz zamówienie testowe z wieloma produktami
async function createTestMultiProductOrder() {
    try {
        const response = await fetch('/api/test/create-multi-product-order', {
            method: 'POST',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            alert(`Utworzono zamówienie testowe: ${data.data.orderNumber}\n\nProdukty:\n${data.data.products.map(p => `- ${p.name}: ${p.quantity} szt.`).join('\n')}\n\nPrzejdź do widoku ZP aby zobaczyć zgrupowane pozycje.`);
            // Odśwież listę zleceń
            loadOrders();
        } else {
            alert('Błąd tworzenia zamówienia testowego: ' + data.message);
        }
    } catch (error) {
        console.error('Błąd tworzenia zamówienia testowego:', error);
        alert('Błąd tworzenia zamówienia testowego');
    }
}

// Uruchom diagnostykę systemu
async function runDiagnostics() {
    try {
        const response = await fetch('/api/test/diagnostics', {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            const diag = data.data;
            
            let report = `=== DIAGNOSTYKA SYSTEMU ===\n`;
            report += `Timestamp: ${diag.timestamp}\n\n`;
            
            // Tablice
            report += `=== TABELE ===\n`;
            for (const [table, info] of Object.entries(diag.tables)) {
                const status = info.exists ? '✅' : '❌';
                report += `${status} ${table}: ${info.count} rekordów\n`;
                if (info.error) report += `   Błąd: ${info.error}\n`;
            }
            
            // Dane
            report += `\n=== DANE ===\n`;
            report += `Zlecenia pogrupowane w ZP: ${diag.data.groupedByWorkOrder?.length || 0}\n`;
            if (diag.data.groupedByWorkOrder?.length > 0) {
                diag.data.groupedByWorkOrder.forEach(wo => {
                    report += `  ZP ${wo.workOrderId}: ${wo.itemCount} pozycji, ${wo.totalQuantity} szt.\n`;
                });
            }
            
            report += `Produkty testowe: ${diag.data.testProducts?.length || 0}/3\n`;
            if (diag.data.testProducts) {
                diag.data.testProducts.forEach(p => {
                    report += `  ${p.code}: ${p.name}\n`;
                });
            }
            
            // Problemy
            if (diag.issues.length > 0) {
                report += `\n=== PROBLEMY ===\n`;
                diag.issues.forEach(issue => {
                    report += `❌ ${issue}\n`;
                });
            }
            
            // Podsumowanie
            report += `\n=== PODSUMOWANIE ===\n`;
            report += `Problemów: ${diag.summary.totalIssues}\n`;
            report += `Zgrupowane zlecenia: ${diag.summary.hasGroupedOrders ? '✅' : '❌'}\n`;
            report += `Produkty testowe: ${diag.summary.hasTestProducts ? '✅' : '❌'}\n`;
            report += `Tabele gotowe: ${diag.summary.tablesReady ? '✅' : '❌'}\n`;
            
            // Wyświetl raport
            console.log(report);
            
            // Pokaż alert z podsumowaniem
            const summary = diag.issues.length > 0 
                ? `Znaleziono ${diag.issues.length} problemów. Sprawdź konsolę (F12) po szczegóły.`
                : `System OK. Wszystkie tabele i dane są poprawne.`;
            
            alert(summary + '\n\nSzczegółowy raport w konsoli (F12).');
            
        } else {
            alert('Błąd diagnostyki: ' + data.message);
        }
    } catch (error) {
        console.error('Błąd diagnostyki:', error);
        alert('Błąd diagnostyki');
    }
}

function updateDisplayModeButton() {
    const btn = document.getElementById('displayModeBtn');
    if (btn) {
        if (displayMode === 'workorders') {
            btn.innerHTML = '<i class="fas fa-layer-group"></i> ZP';
            btn.title = 'Widok: Zbiorcze ZP (grupuje produkty z jednego zamówienia)';
            btn.classList.add('active');
        } else {
            btn.innerHTML = '<i class="fas fa-list-ul"></i> ZP';
            btn.title = 'Widok: Pojedyncze pozycje';
            btn.classList.remove('active');
        }
    }
}

// Ikony dla typów operacji
const OPERATION_TYPE_ICONS = {
    'laser_co2': 'fa-crosshairs',
    'laser_fiber': 'fa-crosshairs',
    'uv_print': 'fa-print',
    'cnc': 'fa-cogs',
    'cutting': 'fa-cut',
    'assembly': 'fa-tools',
    'packing': 'fa-box',
    'default': 'fa-wrench'
};

function getOperationIcon(type) {
    return OPERATION_TYPE_ICONS[type] || OPERATION_TYPE_ICONS['default'];
}

function renderOrderCard(order) {
    const product = order.product || {};
    const sourceOrder = order.sourceOrder || {};
    const customer = sourceOrder.customer || {};
    const orderItem = order.sourceOrderItem || {};
    const progress = order.progress || { completed: 0, total: 0, percent: 0 };
    const currentOp = order.currentOperation;
    const nextOp = order.nextOperation;
    
    // Pobierz informacje o aktualnej/następnej operacji
    const activeOp = currentOp || nextOp;
    const workCenter = activeOp?.workCenter;
    const workStation = activeOp?.workStation;
    const operationType = workCenter?.type || activeOp?.operationtype || '';
    const operationName = activeOp?.operationname || workCenter?.name || '';
    const stationName = workStation?.name || workCenter?.name || '';
    
    // Dane o projektach i ilościach
    const selectedProjects = orderItem.selectedProjects || '';
    const projectQuantities = orderItem.projectQuantities || '';
    const productionNotes = orderItem.productionNotes || order.productionnotes || '';
    const quantitySource = orderItem.source || 'MIEJSCOWOSCI';
    
    // Dane czasowe z auto-priorytetu (z backendu)
    const deliveryDate = order.deliveryDate || sourceOrder.deliveryDate || null;
    const timeStatus = order.timeStatus || 'UNKNOWN';
    const timeToDeadlineMinutes = order.timeToDeadlineMinutes;
    const computedPriority = order.computedPriority || order.priority || 3;
    
    // Szacowany czas (prosty algorytm: ~30 sek na sztukę dla lasera)
    const estimatedMinutes = Math.ceil((order.quantity || 0) * 0.5); // 30 sek/szt
    const estimatedTime = estimatedMinutes < 60 
        ? `~${estimatedMinutes} min` 
        : `~${Math.floor(estimatedMinutes/60)}h ${estimatedMinutes%60}min`;
    
    const statusClass = order.status.replace('_', '-');
    const priorityClass = `p${computedPriority}`;
    const timeStatusClass = getTimeStatusClass(timeStatus);
    
    const statusLabels = {
        'planned': 'Zaplanowane',
        'approved': 'Do realizacji',
        'in_progress': 'W trakcie',
        'paused': 'Wstrzymane',
        'completed': 'Zakończone'
    };
    
    // Określ jaką operację można wykonać
    const canStart = !currentOp && nextOp && (order.status === 'approved' || order.status === 'planned');
    const canPause = currentOp && currentOp.status === 'active';
    const canResume = currentOp && currentOp.status === 'paused';
    const canComplete = currentOp && (currentOp.status === 'active' || currentOp.status === 'paused');
    
    const operationId = currentOp?.id || nextOp?.id;
    
    const pinned = isPinned(order.id);
    
    return `
        <div class="prod-order-card status-${statusClass} ${pinned ? 'pinned' : ''}" data-order-id="${order.id}">
            <div class="prod-order-header">
                <div class="prod-order-number-row">
                    <button class="prod-pin-btn ${pinned ? 'active' : ''}" onclick="event.stopPropagation(); togglePin('${order.id}')" title="${pinned ? 'Odepnij' : 'Przypnij'}">
                        <i class="fas fa-thumbtack"></i>
                    </button>
                    <span class="prod-order-number">${order.ordernumber || order.orderNumber || '---'}</span>
                </div>
                <div class="prod-order-status">
                    <span class="prod-status-badge ${order.status}">${statusLabels[order.status] || order.status}</span>
                    <span class="prod-priority-badge ${priorityClass}" title="Priorytet: ${computedPriority} (${timeStatus})">${computedPriority}</span>
                </div>
            </div>
            
            <div class="prod-order-body">
                ${stationName ? `
                    <div class="prod-operation-info">
                        <i class="fas ${getOperationIcon(operationType)}"></i>
                        <span class="prod-operation-name">${operationName || stationName}</span>
                        ${workStation?.name ? `<span class="prod-station-name">• ${workStation.name}</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="prod-order-product">
                    <span>${product.name || product.code || 'Produkt'}</span>
                    ${(() => {
                        const previewUrl = orderItem.projectViewUrl || orderItem.projectviewurl || product.imageUrl || '';
                        const locationDisplay = orderItem.locationName || (orderItem.source === 'MIEJSCOWOSCI' ? 'Miejscowości' : 'Klienci indywidualni');
                        return previewUrl && previewUrl !== 'http://localhost:3001/' ? `
                        <button onclick="showProductImage('${previewUrl}', '${encodeURIComponent(product.name || '')}', '${encodeURIComponent(product.identifier || '')}', '${encodeURIComponent(locationDisplay)}')" class="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 ml-2" title="Pokaż podgląd produktu">
                            <i class="fas fa-image text-xs"></i>
                        </button>
                    ` : '';
                    })()}
                </div>
                <div class="prod-order-customer">
                    <i class="fas fa-user"></i> ${customer.name || 'Klient'}
                    ${sourceOrder.orderNumber ? ` • <a href="/orders.html?search=${encodeURIComponent(sourceOrder.orderNumber)}" class="prod-order-link" title="Otwórz zamówienie">${sourceOrder.orderNumber}</a>` : ''}
                </div>
                
                <div class="prod-order-quantity-section">
                    <div class="prod-order-quantity">
                        <span class="prod-quantity-value">${order.quantity || 0}</span>
                        <span class="prod-quantity-unit">szt.</span>
                        <span class="prod-estimated-time" title="Szacowany czas"><i class="fas fa-clock"></i> ${estimatedTime}</span>
                        ${order.completedquantity > 0 ? `<span class="prod-quantity-done">✓ ${order.completedquantity}</span>` : ''}
                    </div>
                    ${(selectedProjects || projectQuantities) ? `
                        <div class="prod-projects-info">
                            <div class="prod-projects-grid">
                                ${formatProjectsDisplay(selectedProjects, projectQuantities) || ''}
                            </div>
                            <div class="prod-source-badge ${quantitySource === 'PROJEKTY' ? 'source-projects' : 'source-total'}">
                                ${quantitySource === 'PROJEKTY' ? '<i class="fas fa-list-ol"></i> Wg projektów' : '<i class="fas fa-calculator"></i> Łączna ilość'}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                ${deliveryDate ? `
                    <div class="prod-due-date ${getTimeStatusClass(timeStatus)}">
                        <i class="fas fa-calendar-alt"></i>
                        <span>Termin: ${formatDate(deliveryDate)}</span>
                        <span class="prod-time-remaining">${formatTimeToDeadline(timeToDeadlineMinutes)}</span>
                    </div>
                ` : ''}
                
                ${productionNotes ? `
                    <div class="prod-notes">
                        <i class="fas fa-sticky-note"></i>
                        <span>${escapeHtml(productionNotes)}</span>
                    </div>
                ` : ''}
                
                ${progress.total > 0 ? `
                    <div class="prod-progress-bar">
                        <div class="prod-progress-fill" style="width: ${progress.percent}%"></div>
                    </div>
                    <div class="prod-progress-text">Operacje: ${progress.completed}/${progress.total} (${progress.percent}%)</div>
                ` : ''}
                
                ${order.status === 'in_progress' ? `
                    <div class="prod-timer" id="timer-${order.id}">
                        <i class="fas fa-clock"></i>
                        <span>00:00:00</span>
                    </div>
                ` : ''}
            </div>
            
            <div class="prod-order-actions">
                ${canStart ? `
                    <button class="prod-btn prod-btn-start" onclick="startOperation(${operationId}, ${order.id})">
                        <i class="fas fa-play"></i> ROZPOCZNIJ
                    </button>
                    <button class="prod-btn prod-btn-problem" onclick="showProblemModal(${operationId})">
                        <i class="fas fa-exclamation-triangle"></i> Problem
                    </button>
                ` : ''}
                
                ${canPause ? `
                    <button class="prod-btn prod-btn-pause" onclick="pauseOperation(${currentOp.id})">
                        <i class="fas fa-coffee"></i> PAUZA
                    </button>
                    <button class="prod-btn prod-btn-complete" onclick="showCompleteModal(${currentOp.id}, ${order.quantity})">
                        <i class="fas fa-check"></i> ZAKOŃCZ
                    </button>
                ` : ''}
                
                ${canResume ? `
                    <button class="prod-btn prod-btn-start" onclick="startOperation(${currentOp.id}, ${order.id})">
                        <i class="fas fa-play"></i> WZNÓW
                    </button>
                    <button class="prod-btn prod-btn-complete" onclick="showCompleteModal(${currentOp.id}, ${order.quantity})">
                        <i class="fas fa-check"></i> ZAKOŃCZ
                    </button>
                ` : ''}
                
                ${(canPause || canResume) ? `
                    <button class="prod-btn prod-btn-problem" onclick="showProblemModal(${currentOp.id})">
                        <i class="fas fa-exclamation-triangle"></i> Problem
                    </button>
                ` : ''}
                
                ${(order.workOrderId || order['workOrderId']) ? `
                    <button class="prod-btn prod-btn-print" onclick="printWorkOrder(${order.workOrderId || order['workOrderId']})" title="Drukuj zlecenie produkcyjne">
                        <i class="fas fa-print"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// ============================================
// TIMERY
// ============================================
function startTimer(orderId, startTime) {
    if (orderTimers[orderId]) {
        clearInterval(orderTimers[orderId]);
    }
    
    const timerEl = document.getElementById(`timer-${orderId}`);
    if (!timerEl) return;
    
    const start = new Date(startTime).getTime();
    
    function updateTimer() {
        const now = Date.now();
        const diff = Math.floor((now - start) / 1000);
        
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        
        const timeStr = [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            seconds.toString().padStart(2, '0')
        ].join(':');
        
        const span = timerEl.querySelector('span');
        if (span) span.textContent = timeStr;
    }
    
    updateTimer();
    orderTimers[orderId] = setInterval(updateTimer, 1000);
}

function stopTimer(orderId) {
    if (orderTimers[orderId]) {
        clearInterval(orderTimers[orderId]);
        delete orderTimers[orderId];
    }
}

// ============================================
// AKCJE NA OPERACJACH
// ============================================
async function startOperation(operationId, orderId) {
    // Optymistyczna aktualizacja UI - natychmiast zmień stan
    const orderEl = document.querySelector(`[data-order-id="${orderId}"]`);
    const btn = orderEl?.querySelector('.prod-btn-start, .prod-btn-sm.prod-btn-start');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    try {
        const response = await fetch(`/api/production/operations/${operationId}/start`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showToast('Operacja rozpoczęta', 'success');
            // Lokalna aktualizacja stanu zamiast pełnego reloadu
            await updateOrderInPlace(orderId, 'in_progress', operationId);
            loadStats(); // tylko statystyki
        } else {
            showToast(data.message || 'Błąd startu operacji', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-play"></i> Start';
            }
        }
    } catch (error) {
        console.error('Błąd startu operacji:', error);
        showToast('Błąd połączenia', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-play"></i> Start';
        }
    }
}

async function pauseOperation(operationId) {
    // Znajdź przycisk i pokaż spinner
    const btn = document.querySelector(`[onclick*="pauseOperation(${operationId})"]`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    try {
        const response = await fetch(`/api/production/operations/${operationId}/pause`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showToast('Operacja wstrzymana', 'info');
            // Lokalna aktualizacja - odśwież tylko ten element
            await refreshSingleWorkOrder(operationId);
            loadStats();
        } else {
            showToast(data.message || 'Błąd pauzy', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-coffee"></i> PAUZA';
            }
        }
    } catch (error) {
        console.error('Błąd pauzy:', error);
        showToast('Błąd połączenia', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-coffee"></i> PAUZA';
        }
    }
}

// ============================================
// MODAL ZAKOŃCZENIA
// ============================================
function showCompleteModal(operationId, quantity) {
    currentOperationId = operationId;
    document.getElementById('outputQuantity').value = quantity || 0;
    document.getElementById('wasteQuantity').value = 0;
    document.getElementById('qualityNotes').value = '';
    // Pole numeru matrycy (jeśli istnieje)
    const matrixInput = document.getElementById('matrixNumber');
    if (matrixInput) {
        matrixInput.value = '';
    }
    
    const confirmBtn = document.querySelector('#completeModal .prod-btn-primary, #completeModal .prod-btn-complete');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-check"></i> ZAPISZ';
    }

    document.getElementById('completeModal').classList.add('active');
}

function adjustQuantity(inputId, delta) {
    const input = document.getElementById(inputId);
    let value = parseInt(input.value) || 0;
    value = Math.max(0, value + delta);
    input.value = value;
}

async function confirmComplete() {
    if (!currentOperationId) return;
    
    const outputQuantity = parseInt(document.getElementById('outputQuantity').value) || 0;
    const wasteQuantity = parseInt(document.getElementById('wasteQuantity').value) || 0;
    let qualityNotes = document.getElementById('qualityNotes').value.trim();
    
    // Dodaj numer matrycy do notatek (jeśli podany)
    const matrixInput = document.getElementById('matrixNumber');
    const matrixNumber = matrixInput ? matrixInput.value.trim() : '';
    if (matrixNumber) {
        qualityNotes = `MATRYCA: ${matrixNumber}${qualityNotes ? '\n' + qualityNotes : ''}`;
    }
    
    // Pokaż spinner na przycisku
    const confirmBtn = document.querySelector('#completeModal .prod-btn-primary, #completeModal .prod-btn-complete');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Zapisuję...';
    }
    
    const operationIdToComplete = currentOperationId;
    console.log('[confirmComplete] Rozpoczynam zakończenie operacji:', operationIdToComplete);
    
    try {
        // Timeout 15 sekund
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(`/api/production/operations/${operationIdToComplete}/complete`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outputQuantity, wasteQuantity, qualityNotes }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('[confirmComplete] Response status:', response.status);
        const data = await response.json();
        console.log('[confirmComplete] Response data:', data);
        
        if (data.status === 'success') {
            closeModal('completeModal');
            
            if (data.orderCompleted) {
                showToast('Zlecenie kompletne! 🎉', 'success');
            } else {
                showToast('Operacja zakończona', 'success');
            }
            
            // Pełne odświeżenie danych - zapewnia poprawne usunięcie zakończonych pozycji
            await loadOrders(true);
            loadStats();
        } else {
            console.error('[confirmComplete] Błąd z API:', data.message);
            showToast(data.message || 'Błąd zakończenia', 'error');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-check"></i> Potwierdź';
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[confirmComplete] Timeout - brak odpowiedzi w 15s');
            showToast('Przekroczono czas oczekiwania (15s)', 'error');
        } else {
            console.error('[confirmComplete] Błąd:', error);
            showToast('Błąd połączenia: ' + error.message, 'error');
        }
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-check"></i> Potwierdź';
        }
    }
}

// ============================================
// MODAL PROBLEMU
// ============================================
function showProblemModal(operationId) {
    currentOperationId = operationId;
    selectedProblemType = null;
    
    // Reset selection
    document.querySelectorAll('.prod-problem-type').forEach(el => {
        el.classList.remove('selected');
    });
    document.getElementById('problemDescription').value = '';
    document.getElementById('stopOperation').checked = true;
    
    document.getElementById('problemModal').classList.add('active');
}

function selectProblemType(element) {
    document.querySelectorAll('.prod-problem-type').forEach(el => {
        el.classList.remove('selected');
    });
    element.classList.add('selected');
    selectedProblemType = element.dataset.type;
}

async function confirmProblem() {
    if (!currentOperationId || !selectedProblemType) {
        showToast('Wybierz typ problemu', 'warning');
        return;
    }
    
    const description = document.getElementById('problemDescription').value.trim();
    const stopOperation = document.getElementById('stopOperation').checked;
    
    try {
        const response = await fetch(`/api/production/operations/${currentOperationId}/problem`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                problemType: selectedProblemType,
                description,
                stopOperation
            })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            closeModal('problemModal');
            showToast('Problem zgłoszony', 'warning');
            loadOrders();
        } else {
            showToast(data.message || 'Błąd zgłoszenia', 'error');
        }
    } catch (error) {
        console.error('Błąd zgłoszenia problemu:', error);
        showToast('Błąd połączenia', 'error');
    }
}

function reportGeneralProblem() {
    // Znajdź pierwszą aktywną operację
    const activeOrder = orders.find(o => o.currentOperation);
    if (activeOrder && activeOrder.currentOperation) {
        showProblemModal(activeOrder.currentOperation.id);
    } else {
        showToast('Brak aktywnej operacji do zgłoszenia', 'info');
    }
}

// ============================================
// MODAL HELPERS
// ============================================
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    currentOperationId = null;
}

// Zamknij modal klikając poza nim
document.querySelectorAll('.prod-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
            currentOperationId = null;
        }
    });
});

// ============================================
// TRYB KOMPAKTOWY
// ============================================
function toggleCompactMode() {
    document.body.classList.toggle('compact-mode');
    const isCompact = document.body.classList.contains('compact-mode');
    localStorage.setItem('productionCompactMode', isCompact ? '1' : '0');
    showToast(isCompact ? 'Tryb kompaktowy włączony' : 'Tryb normalny', 'info');
}

// Przywróć tryb kompaktowy z localStorage
if (localStorage.getItem('productionCompactMode') === '1') {
    document.body.classList.add('compact-mode');
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
    // Usuń istniejące toasty
    document.querySelectorAll('.prod-toast').forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = `prod-toast prod-toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Style toasta
    Object.assign(toast.style, {
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: type === 'success' ? 'var(--status-completed)' : 
                   type === 'error' ? 'var(--status-problem)' : 
                   type === 'warning' ? 'var(--status-in-progress)' : 'var(--status-approved)',
        color: type === 'success' || type === 'warning' ? '#000' : '#fff',
        padding: '12px 20px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        fontWeight: '600',
        zIndex: '2000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        animation: 'toastIn 0.3s ease'
    });
    
    document.body.appendChild(toast);
    
    // Dodaj animację
    const style = document.createElement('style');
    style.textContent = `
        @keyframes toastIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `;
    document.head.appendChild(style);
    
    // Usuń po 3 sekundach
    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// PRODUCT IMAGE MODAL FUNCTIONS
// ============================================

function normalizeProjectViewUrlForImage(value) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;

    const raw = value.trim();
    if (!raw) return raw;

    if (raw === '/') {
        return null;
    }

    try {
        const parsed = new URL(raw);
        const pathname = parsed.pathname || '';
        const search = parsed.search || '';

        if ((pathname === '' || pathname === '/') && !search) {
            return null;
        }

        if (pathname.startsWith('/api/gallery/')) {
            return `${pathname}${search}`;
        }

        return raw;
    } catch (e) {
        // Nie jest absolutnym URL-em (np. już jest względny)
    }

    if (raw.startsWith('/api/gallery/')) {
        return raw;
    }

    if (raw.startsWith('api/gallery/')) {
        return `/${raw}`;
    }

    return raw;
}

// Pokaż obrazek produktu w modalu
function showProductImage(imageUrl, productName = '', productIdentifier = '', locationName = '') {
    const normalizedUrl = normalizeProjectViewUrlForImage(imageUrl);
    console.log('[showProductImage] URL received:', imageUrl);
    console.log('[showProductImage] URL normalized:', normalizedUrl);
    
    if (!normalizedUrl) {
        console.log('[showProductImage] No URL provided');
        showToast('Brak podglądu produktu', 'info');
        return;
    }
    
    // Set product info in header - decode URL encoded parameters
    const title = decodeURIComponent(productName) || 'Podgląd produktu';
    const details = [];
    if (productIdentifier) details.push(`ID: ${decodeURIComponent(productIdentifier)}`);
    if (locationName) details.push(`Lokalizacja: ${decodeURIComponent(locationName)}`);
    
    productImageTitle.textContent = title;
    productImageDetails.textContent = details.join(' | ') || '';
    
    console.log('[showProductImage] Setting image src to:', normalizedUrl);
    
    // Reset zoom state BEFORE loading image
    isZoomed = false;
    productImageContent.style.transform = 'scale(1)';
    productImageContent.classList.remove('cursor-zoom-out');
    productImageContent.classList.add('cursor-zoom-in');
    if (productImageZoom) productImageZoom.innerHTML = '<i class="fas fa-search-plus"></i>';
    
    // Clear previous handlers and set new ones with addEventListener
    const newImage = new Image();
    
    newImage.addEventListener('load', function() {
        console.log('[showProductImage] Image loaded successfully');
        productImageContent.src = normalizedUrl;
        productImageModal.classList.remove('hidden');
    }, { once: true });
    
    newImage.addEventListener('error', function() {
        console.error('[showProductImage] Failed to load image:', normalizedUrl);
        showToast('Błąd ładowania obrazka produktu', 'error');
    }, { once: true });
    
    // Start loading the image
    newImage.src = normalizedUrl;
}

// Zoom functionality
let isZoomed = false;
function toggleImageZoom() {
    if (isZoomed) {
        productImageContent.style.transform = 'scale(1)';
        productImageContent.classList.remove('cursor-zoom-out');
        productImageContent.classList.add('cursor-zoom-in');
        productImageZoom.innerHTML = '<i class="fas fa-search-plus"></i>';
    } else {
        productImageContent.style.transform = 'scale(1.5)';
        productImageContent.classList.remove('cursor-zoom-in');
        productImageContent.classList.add('cursor-zoom-out');
        productImageZoom.innerHTML = '<i class="fas fa-search-minus"></i>';
    }
    isZoomed = !isZoomed;
}

// Download functionality
function downloadImage() {
    const imageUrl = productImageContent.src;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `produkt-${Date.now()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Zamknij modal obrazka produktu
function closeProductImage() {
    productImageModal.classList.add('hidden');
    productImageContent.src = '';
}

// Export functions for HTML access
window.sortOrders = sortOrders;
window.toggleViewMode = toggleViewMode;
window.toggleFilter = toggleFilter;
window.togglePin = togglePin;
window.setSelectedMachine = setSelectedMachine;
window.refreshOrders = refreshOrders;
window.logout = logout;
window.toggleDisplayMode = toggleDisplayMode;
window.setWorkOrdersView = setWorkOrdersView;
window.toggleFullscreen = toggleFullscreen;
window.closeAllModals = closeAllModals;
window.createTestMultiProductOrder = createTestMultiProductOrder;
window.runDiagnostics = runDiagnostics;
window.adjustQuantity = adjustQuantity;
window.closeModal = closeModal;
window.selectProblemType = selectProblemType;
window.confirmComplete = confirmComplete;
window.confirmProblem = confirmProblem;

// Export modal functions
window.showProductImage = showProductImage;

// ============================================
// DRUK ZLECENIA PRODUKCYJNEGO
// ============================================
function printWorkOrder(workOrderId) {
    if (!workOrderId) {
        showToast('Brak ID zlecenia produkcyjnego', 'error');
        return;
    }
    
    showToast('Generowanie zlecenia produkcyjnego...', 'info');
    
    // Otwórz PDF w nowym oknie
    const printUrl = `/api/production/work-orders/${workOrderId}/print`;
    window.open(printUrl, '_blank');
}

// Export print function
window.printWorkOrder = printWorkOrder;

// ============================================
// DASHBOARD KPI
// ============================================

// Stan dashboardu KPI
let kpiVisible = localStorage.getItem('kpiDashboardVisible') !== 'false';
let kpiData = null;

/**
 * Inicjalizacja dashboardu KPI
 * Wywoływana przy starcie aplikacji
 */
async function initKpiDashboard() {
    const kpiDashboard = document.getElementById('kpiDashboard');
    if (!kpiDashboard) return;

    let userRole = null;

    try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });

        if (!response.ok) {
            kpiDashboard.style.display = 'none';
            return;
        }

        const data = await response.json();

        if (!data || data.status !== 'success') {
            kpiDashboard.style.display = 'none';
            return;
        }

        userRole = data.role;
    } catch (error) {
        console.error('[KPI] Błąd pobierania danych użytkownika:', error);
        kpiDashboard.style.display = 'none';
        return;
    }

    const allowedRoles = ['ADMIN', 'PRODUCTION_MANAGER', 'PRODUCTION'];
    
    // Pokaż dashboard tylko dla uprawnionych ról
    if (!allowedRoles.includes(userRole)) {
        kpiDashboard.style.display = 'none';
        return;
    }

    // Ustaw domyślne daty (dzisiaj)
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('kpiDateFrom').value = today;
    document.getElementById('kpiDateTo').value = today;
    
    // Pokaż/ukryj dashboard na podstawie zapisanego stanu
    if (kpiVisible) {
        kpiDashboard.classList.add('visible');
        loadKpiData();
    }
    
    updateKpiToggleButton();
}

/**
 * Przełącz widoczność dashboardu KPI
 */
function toggleKpiDashboard() {
    const kpiDashboard = document.getElementById('kpiDashboard');
    if (!kpiDashboard) return;
    
    kpiVisible = !kpiVisible;
    localStorage.setItem('kpiDashboardVisible', kpiVisible);
    
    if (kpiVisible) {
        kpiDashboard.classList.add('visible');
        loadKpiData();
    } else {
        kpiDashboard.classList.remove('visible');
    }
    
    updateKpiToggleButton();
}

/**
 * Aktualizuj przycisk toggle
 */
function updateKpiToggleButton() {
    const btn = document.getElementById('kpiToggleBtn');
    if (!btn) return;
    
    if (kpiVisible) {
        btn.innerHTML = '<i class="fas fa-chevron-up"></i> Zwiń';
        btn.classList.add('active');
    } else {
        btn.innerHTML = '<i class="fas fa-chart-line"></i> KPI';
        btn.classList.remove('active');
    }
}

/**
 * Pobierz dane KPI z API
 */
async function loadKpiData() {
    const dateFrom = document.getElementById('kpiDateFrom')?.value;
    const dateTo = document.getElementById('kpiDateTo')?.value;
    
    if (!dateFrom || !dateTo) return;
    
    try {
        // Buduj URL z parametrami
        const params = new URLSearchParams();
        params.append('dateFrom', new Date(dateFrom).toISOString());
        params.append('dateTo', new Date(dateTo + 'T23:59:59').toISOString());
        
        const response = await fetch(`/api/production/kpi/overview?${params}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 403) {
                console.log('[KPI] Brak uprawnień do dashboardu KPI');
                return;
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            kpiData = result.data;
            renderKpiData(kpiData);
        } else {
            console.error('[KPI] Błąd:', result.message);
        }
    } catch (error) {
        console.error('[KPI] Błąd pobierania danych:', error);
    }
}

/**
 * Renderuj dane KPI w UI
 */
function renderKpiData(data) {
    if (!data) return;
    
    // Summary cards
    document.getElementById('kpiCompletedOps').textContent = data.summary?.completedOperations || 0;
    document.getElementById('kpiProduced').textContent = data.summary?.producedQuantity || 0;
    document.getElementById('kpiWaste').textContent = data.summary?.wasteQuantity || 0;
    document.getElementById('kpiProblems').textContent = data.summary?.problemsReported || 0;
    document.getElementById('kpiAvgTime').textContent = data.summary?.avgOperationTimeMinutes || 0;
    
    // Rooms table
    const roomsTable = document.getElementById('kpiRoomsTable');
    if (roomsTable && data.byRoom) {
        if (data.byRoom.length === 0) {
            roomsTable.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--prod-text-muted);">Brak danych</td></tr>';
        } else {
            roomsTable.innerHTML = data.byRoom.map(room => `
                <tr>
                    <td>${escapeHtml(room.roomName)}</td>
                    <td class="num">${room.totalWorkOrders}</td>
                    <td class="num">${room.inProgressWorkOrders}</td>
                    <td class="num">${room.completedWorkOrders}</td>
                </tr>
            `).join('');
        }
    }
    
    // Products table
    const productsTable = document.getElementById('kpiProductsTable');
    if (productsTable && data.topProducts) {
        if (data.topProducts.length === 0) {
            productsTable.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--prod-text-muted);">Brak danych</td></tr>';
        } else {
            productsTable.innerHTML = data.topProducts.map(product => `
                <tr>
                    <td title="${escapeHtml(product.identifier || '')}">${escapeHtml(product.name)}</td>
                    <td class="num">${product.producedQuantity}</td>
                    <td class="num">${product.wasteQuantity}</td>
                </tr>
            `).join('');
        }
    }
}

// Export KPI functions
window.loadKpiData = loadKpiData;
window.toggleKpiDashboard = toggleKpiDashboard;
window.initKpiDashboard = initKpiDashboard;

// ============================================
// CLEANUP
// ============================================
window.addEventListener('beforeunload', () => {
    if (refreshInterval) clearInterval(refreshInterval);
    Object.keys(orderTimers).forEach(stopTimer);
});

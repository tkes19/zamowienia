/**
 * Panel Produkcji - Logika frontendu
 * Kompaktowy widok dla operatorów
 */

// ============================================
// STAN APLIKACJI
// ============================================
let orders = [];
let filteredOrders = [];
let currentOperationId = null;
let currentOrderId = null;
let selectedProblemType = null;
let refreshInterval = null;
let orderTimers = {};

// Ustawienia widoku
let viewMode = localStorage.getItem('prodViewMode') || 'grid'; // grid, list
let sortMode = localStorage.getItem('prodSortMode') || 'priority';
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
    initViewSettings();
    setupProductImageModal();
    loadOrders();
    initViewSettings();
    
    // Auto-odświeżanie co 30 sekund
    refreshInterval = setInterval(() => {
        loadOrders(true); // silent refresh
        loadStats();
    }, 30000);
});

function initViewSettings() {
    // Przywróć tryb widoku
    applyViewMode();
    
    // Przywróć sortowanie
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = sortMode;
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
    applyFiltersAndSort();
    renderOrders();
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

// ============================================
// AUTORYZACJA
// ============================================
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
            const allowedRoles = ['ADMIN', 'PRODUCTION', 'OPERATOR'];

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

            // Wyświetl nazwę pokoju produkcyjnego
            const roomName = data.productionRoomName;
            const roomBadge = document.getElementById('roomBadge');
            const roomNameEl = document.getElementById('roomName');
            if (roomName && roomBadge && roomNameEl) {
                roomNameEl.textContent = roomName;
                roomBadge.style.display = 'flex';
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
        const response = await fetch('/api/production/orders/active', { credentials: 'include' });
        const data = await response.json();
        
        if (data.status === 'success') {
            orders = data.data || [];
            applyFiltersAndSort();
            renderOrders();
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

function refreshOrders() {
    loadOrders();
    loadStats();
}

// ============================================
// RENDEROWANIE
// ============================================
function renderOrders() {
    const container = document.getElementById('ordersList');
    
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
        html += `<div class="prod-section-title"><i class="fas fa-list"></i> KOLEJKA (${queueOrders.length})</div>`;
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
    // dueDate - na razie nie używamy, bo kolumna nie istnieje w Order
    const dueDate = null;
    
    // Szacowany czas (prosty algorytm: ~30 sek na sztukę dla lasera)
    const estimatedMinutes = Math.ceil((order.quantity || 0) * 0.5); // 30 sek/szt
    const estimatedTime = estimatedMinutes < 60 
        ? `~${estimatedMinutes} min` 
        : `~${Math.floor(estimatedMinutes/60)}h ${estimatedMinutes%60}min`;
    
    const statusClass = order.status.replace('_', '-');
    const priorityClass = `p${order.priority || 3}`;
    
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
                    <span class="prod-priority-badge ${priorityClass}">${order.priority || 3}</span>
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
                    ${orderItem.projectviewurl && orderItem.projectviewurl !== 'http://localhost:3001/' ? `
                        <button onclick="showProductImage('${orderItem.projectviewurl}', '${product.name || ''}', '${product.identifier || ''}', '${orderItem.source === 'MIEJSCOWOSCI' ? 'Miejscowości' : 'Klienci indywidualni'}')" class="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 ml-2" title="Pokaż podgląd produktu">
                            <i class="fas fa-image text-xs"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="prod-order-customer">
                    <i class="fas fa-user"></i> ${customer.name || 'Klient'}
                    ${sourceOrder.orderNumber ? ` • ${sourceOrder.orderNumber}` : ''}
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
                
                ${dueDate ? `
                    <div class="prod-due-date ${isOverdue(dueDate) ? 'overdue' : ''}">
                        <i class="fas fa-calendar-alt"></i>
                        <span>Termin: ${formatDate(dueDate)}</span>
                        ${isOverdue(dueDate) ? '<span class="overdue-badge">PRZETERMINOWANE</span>' : ''}
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
    try {
        const response = await fetch(`/api/production/operations/${operationId}/start`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showToast('Operacja rozpoczęta', 'success');
            loadOrders();
            loadStats();
        } else {
            showToast(data.message || 'Błąd startu operacji', 'error');
        }
    } catch (error) {
        console.error('Błąd startu operacji:', error);
        showToast('Błąd połączenia', 'error');
    }
}

async function pauseOperation(operationId) {
    try {
        const response = await fetch(`/api/production/operations/${operationId}/pause`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showToast('Operacja wstrzymana', 'info');
            loadOrders();
            loadStats();
        } else {
            showToast(data.message || 'Błąd pauzy', 'error');
        }
    } catch (error) {
        console.error('Błąd pauzy:', error);
        showToast('Błąd połączenia', 'error');
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
    const qualityNotes = document.getElementById('qualityNotes').value.trim();
    
    try {
        const response = await fetch(`/api/production/operations/${currentOperationId}/complete`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outputQuantity, wasteQuantity, qualityNotes })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            closeModal('completeModal');
            
            if (data.orderCompleted) {
                showToast('Zlecenie kompletne! 🎉', 'success');
            } else {
                showToast('Operacja zakończona', 'success');
            }
            
            loadOrders();
            loadStats();
        } else {
            showToast(data.message || 'Błąd zakończenia', 'error');
        }
    } catch (error) {
        console.error('Błąd zakończenia:', error);
        showToast('Błąd połączenia', 'error');
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

// Pokaż obrazek produktu w modalu
function showProductImage(imageUrl, productName = '', productIdentifier = '', locationName = '') {
    console.log('[showProductImage] URL received:', imageUrl);
    
    if (!imageUrl) {
        console.log('[showProductImage] No URL provided');
        return;
    }
    
    // Set product info in header
    const title = productName || 'Podgląd produktu';
    const details = [];
    if (productIdentifier) details.push(`ID: ${productIdentifier}`);
    if (locationName) details.push(`Lokalizacja: ${locationName}`);
    
    productImageTitle.textContent = title;
    productImageDetails.textContent = details.join(' | ') || '';
    
    console.log('[showProductImage] Setting image src to:', imageUrl);
    
    // Clear previous handlers and set new ones with addEventListener
    const newImage = new Image();
    
    newImage.addEventListener('load', function() {
        console.log('[showProductImage] Image loaded successfully');
        productImageContent.src = imageUrl;
        productImageModal.classList.remove('hidden');
    }, { once: true });
    
    newImage.addEventListener('error', function() {
        console.error('[showProductImage] Failed to load image:', imageUrl);
        showToast('Błąd ładowania obrazka produktu', 'error');
    }, { once: true });
    
    // Start loading the image
    newImage.src = imageUrl;
    
    // Reset zoom state
    productImageContent.style.transform = 'scale(1)';
    productImageContent.classList.remove('cursor-zoom-out');
    productImageContent.classList.add('cursor-zoom-in');
    productImageZoom.innerHTML = '<i class="fas fa-search-plus"></i>';
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

// Export modal functions
window.showProductImage = showProductImage;

// ============================================
// CLEANUP
// ============================================
window.addEventListener('beforeunload', () => {
    if (refreshInterval) clearInterval(refreshInterval);
    Object.keys(orderTimers).forEach(stopTimer);
});

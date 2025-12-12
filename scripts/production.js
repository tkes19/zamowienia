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

// Maszyny w pokoju operatora
let currentRoomId = null;
let roomMachines = [];
let selectedMachineId = null;

// Ustawienia widoku
let viewMode = localStorage.getItem('prodViewMode') || 'grid'; // grid, list
let sortMode = localStorage.getItem('prodSortMode') || 'priority';
let displayMode = localStorage.getItem('prodDisplayMode') || 'orders'; // orders, workorders (Zbiorcze ZP)
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
    setupProductImageModal();
    initKpiDashboard(); // Inicjalizacja dashboardu KPI
    loadOrders();
    loadStats();
    initViewSettings();
    
    // Auto-odświeżanie co 30 sekund
    refreshInterval = setInterval(() => {
        loadOrders(true); // silent refresh
        loadStats();
    }, 30000);
    
    // Aktualizacja timerów co sekundę
    setInterval(updateTimers, 1000);
    
    // Skróty klawiszowe
    document.addEventListener('keydown', handleKeyboardShortcuts);
});

function initViewSettings() {
    // Przywróć tryb widoku
    applyViewMode();
    
    // Przywróć sortowanie
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = sortMode;
    
    // Przywróć tryb wyświetlania (pozycje / zbiorcze ZP)
    updateDisplayModeButton();
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

            // Wyświetl nazwę pokoju produkcyjnego
            const roomName = data.productionRoomName;
            const roomBadge = document.getElementById('roomBadge');
            const roomNameEl = document.getElementById('roomName');
            if (roomName && roomBadge && roomNameEl) {
                roomNameEl.textContent = roomName;
                roomBadge.style.display = 'flex';
            }

            // Zapamiętaj pokój produkcyjny operatora i wczytaj maszyny w pokoju
            if (data.productionroomid !== undefined && data.productionroomid !== null) {
                const parsedRoomId = parseInt(data.productionroomid, 10);
                if (!Number.isNaN(parsedRoomId)) {
                    currentRoomId = parsedRoomId;
                    loadRoomMachines();
                }
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
        const response = await fetch('/api/production/orders/active', { credentials: 'include' });
        const data = await response.json();
        
        if (data.status === 'success') {
            orders = data.data || [];
            workOrders = data.workOrders || [];
            summary = data.summary || {};
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

// Renderowanie karty Zbiorczego ZP
function renderWorkOrderCard(wo) {
    const statusLabels = {
        'planned': 'Zaplanowane',
        'approved': 'Do realizacji',
        'in_progress': 'W trakcie',
        'completed': 'Zakończone'
    };
    
    const statusClass = wo.status.replace('_', '-');
    const priorityClass = `p${wo.priority || 3}`;
    const priorityHighClass = (wo.priority === 1) ? 'priority-high' : '';
    
    // Oblicz postęp
    const completedOrders = wo.orders.filter(o => o.status === 'completed').length;
    const inProgressOrders = wo.orders.filter(o => o.status === 'in_progress').length;
    const progressPercent = wo.orders.length > 0 ? Math.round((completedOrders / wo.orders.length) * 100) : 0;
    
    // Lista produktów (skrócona) z dodatkowymi informacjami
    const productsList = wo.orders.slice(0, 5).map(o => {
        const product = o.product || {};
        const orderItem = o.sourceOrderItem || {};
        const source = orderItem.source || '';
        const location = orderItem.locationName || orderItem.projectName || '';
        const projects = formatProjectsDisplay(orderItem.selectedProjects, orderItem.projectQuantities);
        
        // URL podglądu produktu - priorytet: orderItem.projectViewUrl > product.imageUrl
        const previewUrl = orderItem.projectViewUrl || orderItem.projectviewurl || product.imageUrl || '';
        const productName = product.name || product.code || 'Produkt';
        const productIdentifier = product.identifier || product.code || '';
        
        return `<div class="wo-product-item">
            <div class="wo-product-main">
                <span class="wo-product-name">${escapeHtml(productName)}</span>
                ${previewUrl ? `<button class="wo-preview-btn" onclick="event.stopPropagation(); showProductImage('${previewUrl}', '${encodeURIComponent(productName)}', '${encodeURIComponent(productIdentifier)}', '${encodeURIComponent(location)}')" title="Podgląd produktu"><i class="fas fa-eye"></i></button>` : ''}
                <span class="wo-product-qty">${o.quantity || 0} szt.</span>
            </div>
            ${(source || location) ? `
            <div class="wo-product-meta">
                ${source ? `<span class="wo-source-badge ${source.toLowerCase()}">${source}</span>` : ''}
                ${location ? `<span class="wo-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(location)}</span>` : ''}
            </div>` : ''}
            ${projects ? `<div class="wo-product-projects">${projects}</div>` : ''}
        </div>`;
    }).join('');
    
    const moreProducts = wo.orders.length > 5 ? `<div class="wo-more-products">+ ${wo.orders.length - 5} więcej...</div>` : '';
    
    // Numer zamówienia źródłowego
    const sourceOrder = wo.orders[0]?.sourceOrder;
    const orderNumber = sourceOrder?.orderNumber || '---';
    const customer = sourceOrder?.customer?.name || 'Klient';
    
    return `
        <div class="prod-workorder-card status-${statusClass} ${priorityHighClass}" data-workorder-id="${wo.id}">
            <div class="wo-header">
                <div class="wo-number-row">
                    <span class="wo-number">${wo.workOrderNumber}</span>
                    <span class="wo-room-badge"><i class="fas fa-door-open"></i> ${escapeHtml(wo.roomName)}</span>
                </div>
                <div class="wo-status-row">
                    <span class="prod-status-badge ${wo.status}">${statusLabels[wo.status] || wo.status}</span>
                    <span class="prod-priority-badge ${priorityClass}">${wo.priority || 3}</span>
                </div>
            </div>
            
            <div class="wo-body">
                <div class="wo-order-info">
                    <a href="/orders.html?search=${encodeURIComponent(orderNumber)}" class="wo-order-link" title="Otwórz zamówienie">
                        <i class="fas fa-receipt"></i> ${orderNumber}
                    </a>
                    <span class="wo-customer"><i class="fas fa-user"></i> ${escapeHtml(customer)}</span>
                </div>
                
                <div class="wo-summary">
                    <div class="wo-summary-item">
                        <span class="wo-summary-value">${wo.productsCount}</span>
                        <span class="wo-summary-label">produktów</span>
                    </div>
                    <div class="wo-summary-item">
                        <span class="wo-summary-value">${wo.totalQuantity}</span>
                        <span class="wo-summary-label">szt. łącznie</span>
                    </div>
                    ${inProgressOrders > 0 ? `
                    <div class="wo-summary-item active">
                        <span class="wo-summary-value">${inProgressOrders}</span>
                        <span class="wo-summary-label">w trakcie</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="wo-products-list">
                    ${productsList}
                    ${moreProducts}
                </div>
                
                ${wo.orders.length > 0 ? `
                <div class="wo-progress">
                    <div class="wo-progress-bar">
                        <div class="wo-progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="wo-progress-text">${completedOrders}/${wo.orders.length} pozycji (${progressPercent}%)</div>
                </div>
                ` : ''}
            </div>
            
            <div class="wo-actions">
                <button class="prod-btn prod-btn-secondary" onclick="toggleWorkOrderDetails(${wo.id})" title="Pokaż/ukryj pozycje">
                    <i class="fas fa-chevron-down"></i> Pozycje
                </button>
                <button class="prod-btn prod-btn-print" onclick="printWorkOrder(${wo.id})" title="Drukuj zlecenie produkcyjne">
                    <i class="fas fa-print"></i> Drukuj ZP
                </button>
            </div>
            
            <div class="wo-details" id="wo-details-${wo.id}" style="display: none;">
                ${wo.orders.map(order => renderOrderCardCompact(order)).join('')}
            </div>
        </div>
    `;
}

// Kompaktowa karta pozycji wewnątrz ZP
function renderOrderCardCompact(order) {
    const product = order.product || {};
    const orderItem = order.sourceOrderItem || {};
    const statusLabels = {
        'planned': 'Zaplanowane',
        'approved': 'Do realizacji',
        'in_progress': 'W trakcie',
        'completed': 'Zakończone'
    };
    
    const currentOp = order.currentOperation;
    const nextOp = order.nextOperation;
    const canStart = !currentOp && nextOp && (order.status === 'approved' || order.status === 'planned');
    const canComplete = currentOp && (currentOp.status === 'active' || currentOp.status === 'paused');
    const operationId = currentOp?.id || nextOp?.id;
    
    // Dane z pozycji zamówienia
    const source = orderItem.source || '';
    const location = orderItem.locationName || orderItem.projectName || '';
    const projects = formatProjectsDisplay(orderItem.selectedProjects, orderItem.projectQuantities);
    const notes = order.productionnotes || orderItem.productionNotes || '';
    
    // URL podglądu produktu
    const previewUrl = product.imageUrl || orderItem.projectViewUrl || orderItem.projectviewurl || '';
    const productName = product.name || product.code || 'Produkt';
    const productIdentifier = product.identifier || product.code || '';
    
    // Timer dla operacji w trakcie
    const startTime = currentOp?.startedat || currentOp?.startedAt;
    const timerHtml = (order.status === 'in_progress' && startTime) ? 
        `<span class="wo-timer" data-start="${startTime}"><i class="fas fa-clock"></i> <span class="timer-value">00:00</span></span>` : '';
    
    return `
        <div class="wo-order-item status-${order.status.replace('_', '-')}" data-order-id="${order.id}">
            <div class="wo-order-item-header">
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
                </div>` : ''}
                
                ${notes ? `
                <div class="wo-order-item-notes">
                    <i class="fas fa-sticky-note"></i> ${escapeHtml(notes)}
                </div>` : ''}
            </div>
            
            <div class="wo-order-item-actions">
                ${previewUrl ? `
                    <button class="prod-btn-sm prod-btn-view" onclick="showProductImage('${previewUrl}', '${encodeURIComponent(productName)}', '${encodeURIComponent(productIdentifier)}', '${encodeURIComponent(location)}')" title="Podgląd produktu">
                        <i class="fas fa-eye"></i>
                    </button>
                ` : ''}
                ${canStart ? `
                    <button class="prod-btn-sm prod-btn-start" onclick="startOperation(${operationId}, ${order.id})">
                        <i class="fas fa-play"></i>
                    </button>
                ` : ''}
                ${canComplete ? `
                    <button class="prod-btn-sm prod-btn-complete" onclick="showCompleteModal(${currentOp.id}, ${order.quantity})">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
                <button class="prod-btn-sm prod-btn-problem" onclick="showProblemModal(${operationId})">
                    <i class="fas fa-exclamation-triangle"></i>
                </button>
            </div>
        </div>
    `;
}

// Przełącz widoczność szczegółów ZP
function toggleWorkOrderDetails(woId) {
    const detailsEl = document.getElementById(`wo-details-${woId}`);
    if (detailsEl) {
        const isVisible = detailsEl.style.display !== 'none';
        detailsEl.style.display = isVisible ? 'none' : 'block';
        
        // Zmień ikonę przycisku
        const btn = detailsEl.parentElement.querySelector('.wo-actions button:first-child i');
        if (btn) {
            btn.className = isVisible ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
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
    
    // Set product info in header - decode URL encoded parameters
    const title = decodeURIComponent(productName) || 'Podgląd produktu';
    const details = [];
    if (productIdentifier) details.push(`ID: ${decodeURIComponent(productIdentifier)}`);
    if (locationName) details.push(`Lokalizacja: ${decodeURIComponent(locationName)}`);
    
    productImageTitle.textContent = title;
    productImageDetails.textContent = details.join(' | ') || '';
    
    console.log('[showProductImage] Setting image src to:', imageUrl);
    
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
        productImageContent.src = imageUrl;
        productImageModal.classList.remove('hidden');
    }, { once: true });
    
    newImage.addEventListener('error', function() {
        console.error('[showProductImage] Failed to load image:', imageUrl);
        showToast('Błąd ładowania obrazka produktu', 'error');
    }, { once: true });
    
    // Start loading the image
    newImage.src = imageUrl;
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

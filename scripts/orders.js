document.addEventListener('DOMContentLoaded', () => {
    // Elementy DOM
    const ordersTableBody = document.getElementById('orders-table-body');
    const ordersTableInfo = document.getElementById('orders-table-info');
    const ordersStatusFilter = document.getElementById('orders-status-filter');
    const ordersUserFilter = document.getElementById('orders-user-filter');
    const ordersUserFilterContainer = document.getElementById('orders-user-filter-container');
    const ordersTableHeaderUser = document.getElementById('orders-table-header-user');
    const ordersDateFrom = document.getElementById('orders-date-from');
    const ordersDateTo = document.getElementById('orders-date-to');
    const ordersBelowStockOnly = document.getElementById('orders-below-stock-only');
    const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const adminLink = document.getElementById('admin-link');
    const clientsLink = document.getElementById('clients-link');
    const orderDetailsModal = document.getElementById('order-details-modal');
    const orderDetailsClose = document.getElementById('order-details-close');
    const orderDetailsTitle = document.getElementById('order-details-title');
    const orderDetailsContent = document.getElementById('order-details-content');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    // Product Image Modal elements
    const productImageModal = document.getElementById('product-image-modal');
    const productImageClose = document.getElementById('product-image-close');
    const productImageContent = document.getElementById('product-image-content');
    const productImageTitle = document.getElementById('product-image-title');
    const productImageDetails = document.getElementById('product-image-details');
    const productImageDownload = document.getElementById('product-image-download');
    const productImageZoom = document.getElementById('product-image-zoom');
    const printPreviewModal = document.getElementById('print-preview-modal');
    const printPreviewContent = document.getElementById('print-preview-content');
    const printPreviewPrintBtn = document.getElementById('print-preview-print');
    const printPreviewCloseBtn = document.getElementById('print-preview-close');

    let allOrders = [];
    let currentUserRole = null;
    let currentUserId = null;
    let allSalesReps = [];
    const loadingOrders = new Set(); // Blokada podczas ładowania
    const ordersInEditMode = new Set(); // Zamówienia w trybie edycji

    // Pokazywanie linków nawigacji na podstawie roli
    function setupOrdersNavigation(role) {
        const formLink = document.getElementById('nav-form-link');
        const productionLink = document.getElementById('production-link');
        const graphicsLink = document.getElementById('graphics-link');
        
        // Formularz - ukryj dla produkcji (nie mają tam co robić)
        if (formLink) {
            if (['OPERATOR', 'PRODUCTION', 'PRODUCTION_MANAGER'].includes(role)) {
                formLink.style.display = 'none';
            }
        }
        
        // Klienci - tylko sprzedaż i admin
        if (clientsLink && ['SALES_REP', 'SALES_DEPT', 'ADMIN'].includes(role)) {
            clientsLink.style.display = 'flex';
        }
        
        // Produkcja - dla ról produkcyjnych + SALES_DEPT + ADMIN
        if (productionLink && ['ADMIN', 'SALES_DEPT', 'PRODUCTION', 'OPERATOR', 'PRODUCTION_MANAGER', 'WAREHOUSE'].includes(role)) {
            productionLink.style.display = 'flex';
        }
        
        // Grafika - dla kierownika produkcji, SALES_DEPT, ADMIN
        if (graphicsLink && ['ADMIN', 'SALES_DEPT', 'PRODUCTION_MANAGER'].includes(role)) {
            graphicsLink.style.display = 'flex';
        }
        
        // Admin
        if (adminLink && ['ADMIN', 'SALES_DEPT'].includes(role)) {
            adminLink.style.display = 'flex';
        }
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

    function sanitizeProjectsValue(value) {
        if (!value) return '';
        return value
            .split(',')
            .map(segment => segment.trim())
            .filter(Boolean)
            .map(segment => {
                if (segment.includes('-')) {
                    const parts = segment.split('-').map(num => num.trim());
                    if (!parts[0] || !parts[1]) {
                        return '';
                    }
                    return `${parts[0]}-${parts[1]}`;
                }
                return segment;
            })
            .filter(Boolean)
            .join(', ');
    }

    function sanitizePerProjectValue(value) {
        if (!value) return '';
        return String(value)
            .split(',')
            .map(part => part.trim())
            .filter(Boolean)
            .join(',');
    }

    function updatePerProjectFromTotalRow(row) {
        const logic = window.ProjectQuantityLogic || {};
        const computePerProjectQuantities = logic.computePerProjectQuantities;
        if (!computePerProjectQuantities) return;

        const qtyInput = row.querySelector('input[name="quantity"]');
        const projectsInput = row.querySelector('input[name="projects"]');
        const perProjectInput = row.querySelector('input[name="projectQuantities"]');
        const preview = row.querySelector('.per-project-preview');

        if (!qtyInput || !projectsInput || !perProjectInput) return;

        const qty = parseInt(qtyInput.value, 10) || 0;
        const projectsValue = sanitizeProjectsValue(projectsInput.value);

        if (!projectsValue || !Number.isFinite(qty) || qty <= 0) return;

        const result = computePerProjectQuantities(projectsValue, qty, '');
        if (!result || !result.success || !Array.isArray(result.perProjectQuantities)) return;

        const quantitiesStr = result.perProjectQuantities.map(p => p.qty).join(',');
        perProjectInput.value = quantitiesStr;

        if (preview) {
            preview.textContent = result.perProjectQuantities
                .map(p => `Proj. ${p.projectNo}: ${p.qty}`)
                .join(' | ');
        }
    }

    function updateTotalFromPerProjectRow(row) {
        const logic = window.ProjectQuantityLogic || {};
        const computePerProjectQuantities = logic.computePerProjectQuantities;
        if (!computePerProjectQuantities) return;

        const qtyInput = row.querySelector('input[name="quantity"]');
        const projectsInput = row.querySelector('input[name="projects"]');
        const perProjectInput = row.querySelector('input[name="projectQuantities"]');
        const preview = row.querySelector('.per-project-preview');
        if (!qtyInput || !projectsInput || !perProjectInput) return;

        const projectsValue = sanitizeProjectsValue(projectsInput.value);
        const perValue = sanitizePerProjectValue(perProjectInput.value);
        if (!projectsValue || !perValue) return;

        const result = computePerProjectQuantities(projectsValue, '', perValue);
        if (!result || !result.success || !Array.isArray(result.perProjectQuantities)) return;

        const totalQty = result.totalQuantity;
        qtyInput.value = totalQty;

        const unitPrice = parseFloat(row.dataset.unitPrice) || 0;
        const lineTotal = row.querySelector('.line-total');
        if (lineTotal) {
            lineTotal.textContent = (totalQty * unitPrice).toFixed(2) + ' zł';
        }

        const stock = row.dataset.stock !== '' ? parseInt(row.dataset.stock, 10) : null;
        const badgeContainer = row.querySelector('.below-stock-badge');
        if (badgeContainer) {
            if (stock !== null && totalQty > stock) {
                badgeContainer.innerHTML = `<span class="ml-1 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Poniżej stanu (stan: ${stock})</span>`;
            } else {
                badgeContainer.innerHTML = '';
            }
        }

        if (preview) {
            preview.textContent = result.perProjectQuantities
                .map(p => `Proj. ${p.projectNo}: ${p.qty}`)
                .join(' | ');
        }
    }

    // Tryb widoku statusów: 'pills' (domyślny) lub 'dropdown' (lista rozwijana)
    let ordersStatusViewMode = localStorage.getItem('ordersStatusViewMode') || 'pills';
    const ordersStatusViewSwitchBtn = document.getElementById('orders-status-view-switch');
    const ordersStatusViewDropdownBtn = document.getElementById('orders-status-view-dropdown');

    function updateOrdersStatusViewButtons() {
        if (ordersStatusViewSwitchBtn) {
            ordersStatusViewSwitchBtn.classList.toggle('active', ordersStatusViewMode === 'pills');
        }
        if (ordersStatusViewDropdownBtn) {
            ordersStatusViewDropdownBtn.classList.toggle('active', ordersStatusViewMode === 'dropdown');
        }
    }

    function initOrdersStatusViewToggle() {
        updateOrdersStatusViewButtons();

        if (ordersStatusViewSwitchBtn) {
            ordersStatusViewSwitchBtn.addEventListener('click', () => {
                ordersStatusViewMode = 'pills';
                localStorage.setItem('ordersStatusViewMode', 'pills');
                updateOrdersStatusViewButtons();
                renderOrdersTable();
            });
        }

        if (ordersStatusViewDropdownBtn) {
            ordersStatusViewDropdownBtn.addEventListener('click', () => {
                ordersStatusViewMode = 'dropdown';
                localStorage.setItem('ordersStatusViewMode', 'dropdown');
                updateOrdersStatusViewButtons();
                renderOrdersTable();
            });
        }
    }

    const STATUS_LABELS = {
        PENDING: 'Oczekujące',
        APPROVED: 'Zatwierdzone',
        IN_PRODUCTION: 'W produkcji',
        READY: 'Gotowe',
        SHIPPED: 'Wysłane',
        DELIVERED: 'Dostarczone',
        CANCELLED: 'Anulowane'
    };

    const STATUS_CLASSES = {
        PENDING: 'bg-yellow-100 text-yellow-800',
        APPROVED: 'bg-blue-100 text-blue-800',
        IN_PRODUCTION: 'bg-orange-100 text-orange-800',
        READY: 'bg-green-100 text-green-800',
        SHIPPED: 'bg-purple-100 text-purple-800',
        DELIVERED: 'bg-gray-100 text-gray-800',
        CANCELLED: 'bg-red-100 text-red-800'
    };

    const STATUS_SELECT_BASE = 'order-status-select';

    // Mapowanie źródeł na skróty i kolory
    const SOURCE_LABELS = {
        MIEJSCOWOSCI: 'PM',
        KATALOG_INDYWIDUALNY: 'KI',
        KLIENCI_INDYWIDUALNI: 'KI',
        IMIENNE: 'Im',
        HASLA: 'H',
        OKOLICZNOSCIOWE: 'Ok'
    };

    const SOURCE_COLORS = {
        MIEJSCOWOSCI: 'bg-blue-100 text-blue-700',
        KATALOG_INDYWIDUALNY: 'bg-green-100 text-green-700',
        KLIENCI_INDYWIDUALNI: 'bg-green-100 text-green-700',
        IMIENNE: 'bg-purple-100 text-purple-700',
        HASLA: 'bg-orange-100 text-orange-700',
        OKOLICZNOSCIOWE: 'bg-red-100 text-red-700'
    };

    // Sprawdza czy pozycje mają mieszane źródła
    function hasMixedSources(items) {
        if (!items || items.length <= 1) return false;
        const sources = new Set(items.map(item => item.source).filter(Boolean));
        return sources.size > 1;
    }

    // Generuje badge źródła (PM/KI) jeśli potrzebny
    function getSourceBadge(source, showBadge) {
        if (!showBadge || !source) return '';
        const label = SOURCE_LABELS[source] || source;
        const colorClass = SOURCE_COLORS[source] || 'bg-gray-100 text-gray-700';
        return `<span class="inline-block px-1.5 py-0.5 rounded text-xs font-medium ${colorClass} mr-1">${label}</span>`;
    }

    // Sortowanie
    let currentSort = { column: 'createdAt', direction: 'desc' };

    // Debounce helper
    function debounce(fn, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Toast notifications
    function showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease-out forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function applyStatusStyles(element, status) {
        Object.values(STATUS_CLASSES).forEach(cls => {
            cls.split(' ').forEach(singleClass => element.classList.remove(singleClass));
        });
        const newClasses = (STATUS_CLASSES[status] || 'bg-gray-100 text-gray-800').split(' ');
        newClasses.forEach(cls => element.classList.add(cls));
    }

    // Sprawdza czy użytkownik może edytować zamówienie
    function canEditOrder(order) {
        if (!order || !currentUserRole) return false;
        
        const editableStatuses = {
            SALES_REP: ['PENDING'],
            SALES_DEPT: ['PENDING', 'APPROVED'],
            ADMIN: ['PENDING', 'APPROVED']
        };
        
        const allowedStatuses = editableStatuses[currentUserRole] || [];
        
        // SALES_REP może edytować tylko własne zamówienia
        if (currentUserRole === 'SALES_REP' && order.userId !== currentUserId) {
            return false;
        }
        
        return allowedStatuses.includes(order.status);
    }

    // Wejście w tryb edycji pozycji zamówienia
    window.enterEditMode = function(orderId) {
        ordersInEditMode.add(orderId);
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
            const tableRow = document.querySelector(`tr[data-order-id="${orderId}"]`);
            if (tableRow) {
                // Zamknij i otwórz ponownie, żeby przeładować z trybem edycji
                const detailsRow = document.getElementById(`details-${orderId}`);
                if (detailsRow) detailsRow.remove();
                loadingOrders.add(orderId);
                showOrderDetailsInline(order, tableRow).finally(() => {
                    loadingOrders.delete(orderId);
                });
            }
        }
    };

    // Wyjście z trybu edycji
    window.exitEditMode = function(orderId) {
        ordersInEditMode.delete(orderId);
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
            const tableRow = document.querySelector(`tr[data-order-id="${orderId}"]`);
            if (tableRow) {
                const detailsRow = document.getElementById(`details-${orderId}`);
                if (detailsRow) detailsRow.remove();
                loadingOrders.add(orderId);
                showOrderDetailsInline(order, tableRow).finally(() => {
                    loadingOrders.delete(orderId);
                });
            }
        }
    };

    // Zapisz zmiany pozycji zamówienia
    window.saveOrderItems = async function(orderId) {
        const itemRows = document.querySelectorAll(`#details-${orderId} tr[data-item-id]`);
        if (!itemRows.length) {
            showToast('Brak pozycji do zapisania', 'warning');
            return;
        }

        const items = [];
        let hasError = false;
        const logic = window.ProjectQuantityLogic || {};
        const computePerProjectQuantities = logic.computePerProjectQuantities;

        itemRows.forEach(row => {
            const itemId = row.dataset.itemId;
            const qtyInput = row.querySelector('input[name="quantity"]');
            const projectsInput = row.querySelector('input[name="projects"]');
            const perProjectInput = row.querySelector('input[name="projectQuantities"]');
            const locationInput = row.querySelector('input[name="location"]');
            const notesInput = row.querySelector('input[name="notes"]');

            let quantity = qtyInput ? parseInt(qtyInput.value, 10) || 0 : 0;
            let selectedProjects = projectsInput ? sanitizeProjectsValue(projectsInput.value) : '';
            let perProjectStr = perProjectInput ? sanitizePerProjectValue(perProjectInput.value) : '';

            let projectQuantities = undefined;
            let quantitySource = undefined;

            if (selectedProjects && computePerProjectQuantities) {
                // Jeśli użytkownik podał ilości na projekty - traktujemy je jako źródło prawdy
                if (perProjectStr) {
                    const result = computePerProjectQuantities(selectedProjects, '', perProjectStr);
                    if (!result.success) {
                        hasError = true;
                        showToast(`Pozycja ${itemId}: ${result.error}`, 'error');
                        return;
                    }
                    quantity = result.totalQuantity;
                    projectQuantities = JSON.stringify(result.perProjectQuantities);
                    quantitySource = 'perProject';
                } else if (Number.isFinite(quantity) && quantity > 0) {
                    // Tylko łączna ilość i projekty -> rozłóż równomiernie
                    const result = computePerProjectQuantities(selectedProjects, quantity, '');
                    if (result.success) {
                        projectQuantities = JSON.stringify(result.perProjectQuantities);
                        quantitySource = 'total';
                    }
                }
            }

            items.push({
                id: itemId,
                quantity,
                selectedProjects: selectedProjects || undefined,
                projectQuantities,
                quantitySource,
                locationName: locationInput ? locationInput.value : undefined,
                productionNotes: notesInput ? notesInput.value : undefined
            });
        });

        if (hasError) {
            return;
        }

        try {
            const response = await fetch(`/api/orders/${orderId}/items`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ items })
            });

            const result = await response.json();

            if (result.status === 'success') {
                showToast('Pozycje zostały zapisane', 'success');
                // Aktualizuj total w lokalnych danych
                const order = allOrders.find(o => o.id === orderId);
                if (order && result.data?.total !== undefined) {
                    order.total = result.data.total;
                }

                // Jeśli w panelu edycji jest pole notatek do zamówienia, zapisz je w tym samym kroku
                const notesTextarea = document.getElementById(`order-notes-${orderId}`);
                if (notesTextarea) {
                    try {
                        await saveOrderNotes(orderId, { silent: true });
                    } catch (notesError) {
                        console.error('Błąd zapisu notatek podczas zapisu pozycji:', notesError);
                    }
                }
                // Wyjdź z trybu edycji i odśwież widok
                exitEditMode(orderId);
                // Odśwież tabelę główną (dla nowego total)
                renderOrdersTable();
            } else {
                showToast(result.message || 'Nie udało się zapisać zmian', 'error');
            }
        } catch (error) {
            console.error('Błąd zapisu pozycji:', error);
            showToast('Błąd połączenia z serwerem', 'error');
        }
    };

    // Usuń pozycję zamówienia
    window.deleteOrderItem = async function(orderId, itemId) {
        if (!confirm('Czy na pewno chcesz usunąć tę pozycję z zamówienia? Tej operacji nie można cofnąć.')) {
            return;
        }

        try {
            const response = await fetch(`/api/orders/${orderId}/items/${itemId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            let result = null;
            try {
                result = await response.json();
            } catch (parseError) {
                // Jeśli odpowiedź nie jest JSON (np. HTML 404 z proxy), obsłuż niżej na podstawie statusu
            }

            if (response.ok && result && result.status === 'success') {
                showToast('Pozycja została usunięta', 'success');

                const order = allOrders.find(o => o.id === orderId);
                if (order && result.data?.total !== undefined) {
                    order.total = result.data.total;
                }

                // Odśwież szczegóły w trybie edycji
                ordersInEditMode.add(orderId);
                const tableRow = document.querySelector(`tr[data-order-id="${orderId}"]`);
                if (tableRow) {
                    const detailsRow = document.getElementById(`details-${orderId}`);
                    if (detailsRow) detailsRow.remove();
                    loadingOrders.add(orderId);
                    showOrderDetailsInline(order, tableRow).finally(() => {
                        loadingOrders.delete(orderId);
                    });
                }
                renderOrdersTable();
            } else {
                const message = (result && result.message)
                    ? result.message
                    : `Nie udało się usunąć pozycji (HTTP ${response.status})`;
                showToast(message, 'error');
            }
        } catch (error) {
            console.error('Błąd usuwania pozycji:', error);
            showToast('Błąd połączenia z serwerem', 'error');
        }
    };

    // Sprawdzenie autoryzacji i roli użytkownika
    async function checkAuth() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });

            if (!response.ok) {
                window.location.href = '/login';
                return false;
            }

            const userData = await response.json();
            currentUserRole = userData.role;
            currentUserId = userData.id;

            // Pokaż linki w zależności od roli
            setupOrdersNavigation(currentUserRole);

            // Pokaż filtr handlowca dla ADMIN i SALES_DEPT
            if (['ADMIN', 'SALES_DEPT'].includes(currentUserRole)) {
                ordersUserFilterContainer.classList.remove('hidden');
                loadSalesReps();
            } else {
                // Ukryj kolumnę handlowca dla innych ról
                ordersTableHeaderUser.style.display = 'none';
            }

            return true;
        } catch (error) {
            console.error('Błąd sprawdzania autoryzacji:', error);
            window.location.href = '/login';
            return false;
        }
    }

    // Załadowanie listy handlowców (dla ADMIN i SALES_DEPT)
    async function loadSalesReps() {
        try {
            const response = await fetch('/api/admin/users?role=SALES_REP', {
                credentials: 'include',
            });

            if (response.ok) {
                const result = await response.json();
                allSalesReps = Array.isArray(result.data) ? result.data : [];
                populateSalesRepsFilter();
            }
        } catch (error) {
            console.error('Błąd pobierania handlowców:', error);
        }
    }

    // Wypełnienie filtra handlowców
    function populateSalesRepsFilter() {
        if (!ordersUserFilter) return;

        const options = ['<option value="">Wszyscy handlowcy</option>'];
        allSalesReps.forEach(rep => {
            const name = escapeHtml(rep.name || '');
            const email = escapeHtml(rep.email || '');
            const label = email ? `${name} (${email})` : name;
            options.push(`<option value="${rep.id}">${label}</option>`);
        });

        ordersUserFilter.innerHTML = options.join('');
    }

    // Inicjalizacja
    async function init() {
        const isAuthorized = await checkAuth();
        if (!isAuthorized) return;

        fetchOrders();
    }

    // Event listenery z debounce dla filtrów
    const debouncedFetchOrders = debounce(fetchOrders, 300);

    refreshOrdersBtn.addEventListener('click', fetchOrders);
    ordersStatusFilter.addEventListener('change', debouncedFetchOrders);
    ordersDateFrom.addEventListener('change', debouncedFetchOrders);
    ordersDateTo.addEventListener('change', debouncedFetchOrders);

    if (ordersBelowStockOnly) {
        ordersBelowStockOnly.addEventListener('change', debouncedFetchOrders);
    }

    if (ordersUserFilter) {
        ordersUserFilter.addEventListener('change', debouncedFetchOrders);
    }

    ordersTableBody.addEventListener('click', handleTableClick);

    // Sortowanie - event listener na nagłówki
    document.querySelector('thead').addEventListener('click', handleSortClick);

    // Eksport CSV
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }

    // Print Preview
    if (printPreviewCloseBtn) {
        printPreviewCloseBtn.addEventListener('click', () => {
            printPreviewModal.classList.add('hidden');
        });
    }

    if (printPreviewPrintBtn) {
        printPreviewPrintBtn.addEventListener('click', () => {
            // Drukuj tylko zawartość print preview
            const printContent = printPreviewContent.innerHTML;
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Wydruk zamówienia</title>
                    <style>
                        @page { size: A4 landscape; margin: 10mm; }
                        * { margin: 0; padding: 0; }
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 12px; line-height: 1.3; font-size: 11px; color: #111827; }
                        .print-document { background: white; padding: 12px; max-width: 100%; margin: 0 auto; }
                        .print-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; border-bottom: 2px solid #111827; padding-bottom: 8px; }
                        .print-company { font-size: 16px; font-weight: 700; color: #111827; }
                        .print-title { font-size: 14px; font-weight: 700; color: #111827; margin-top: 4px; }
                        .print-meta { font-size: 10px; color: #374151; text-align: right; }
                        .print-section { margin-bottom: 10px; }
                        .print-section-title { font-size: 11px; font-weight: 700; color: #111827; margin-bottom: 6px; border-bottom: 1px solid #9ca3af; padding-bottom: 3px; }
                        .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
                        .print-field { font-size: 10px; }
                        .print-field-label { color: #4b5563; font-weight: 600; margin-bottom: 2px; }
                        .print-field-value { color: #111827; font-weight: 600; }
                        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
                        .print-table thead { background: #e5e7eb; border-bottom: 2px solid #9ca3af; }
                        .print-table th { padding: 4px 6px; text-align: left; font-weight: 700; color: #111827; font-size: 10px; }
                        .print-table td { padding: 4px 6px; border-bottom: 1px solid #9ca3af; color: #111827; font-size: 10px; }
                        .print-table tbody tr:last-child td { border-bottom: none; }
                        .print-total { text-align: right; font-size: 11px; font-weight: 700; color: #111827; margin-top: 8px; padding-top: 6px; border-top: 2px solid #4b5563; }
                        .print-footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #9ca3af; font-size: 9px; color: #4b5563; text-align: center; }
                    </style>
                </head>
                <body>
                    ${printContent}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        });
    }

    if (orderDetailsClose) {
        orderDetailsClose.addEventListener('click', closeOrderDetails);
    }

    // Product Image Modal event listeners
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

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/';
        } catch (error) {
            console.error('Błąd wylogowania:', error);
            window.location.href = '/';
        }
    });

    // Pobieranie zamówień
    async function fetchOrders() {
        try {
            ordersTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-gray-500">
                        <div class="flex flex-col items-center gap-2">
                            <i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
                            <span>Ładowanie zamówień...</span>
                        </div>
                    </td>
                </tr>
            `;

            const params = new URLSearchParams();
            
            if (ordersStatusFilter.value) params.append('status', ordersStatusFilter.value);
            if (ordersUserFilter && ordersUserFilter.value) params.append('userId', ordersUserFilter.value);
            if (ordersDateFrom.value) params.append('dateFrom', ordersDateFrom.value);
            if (ordersDateTo.value) params.append('dateTo', ordersDateTo.value);
            if (ordersBelowStockOnly && ordersBelowStockOnly.checked) params.append('belowStockOnly', 'true');

            const url = `/api/orders?${params.toString()}`;
            const response = await fetch(url, {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                allOrders = result.data || [];
                renderOrdersTable();
            } else {
                throw new Error(result.message || 'Nie udało się pobrać zamówień');
            }
        } catch (error) {
            console.error('Błąd pobierania zamówień:', error);
            ordersTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-red-600">
                        <div class="flex flex-col items-center gap-2">
                            <i class="fas fa-exclamation-circle text-2xl"></i>
                            <span>Błąd: ${error.message}</span>
                            <button onclick="location.reload()" class="mt-2 text-blue-600 underline text-sm">Spróbuj ponownie</button>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    // Sortowanie zamówień
    function sortOrders() {
        const { column, direction } = currentSort;
        const multiplier = direction === 'asc' ? 1 : -1;

        allOrders.sort((a, b) => {
            let valA, valB;

            switch (column) {
                case 'orderNumber':
                    // Sortowanie numeryczne dla numeru zamówienia (np. 2025/1/JRO, 2025/2/JRO)
                    const extractNumber = (str) => {
                        const match = str.match(/\/(\d+)\//);
                        return match ? parseInt(match[1], 10) : 0;
                    };
                    valA = extractNumber(a.orderNumber || '');
                    valB = extractNumber(b.orderNumber || '');
                    return multiplier * (valA - valB);
                case 'createdAt':
                    valA = new Date(a.createdAt).getTime();
                    valB = new Date(b.createdAt).getTime();
                    return multiplier * (valA - valB);
                case 'customer':
                    valA = a.Customer?.name || '';
                    valB = b.Customer?.name || '';
                    return multiplier * valA.localeCompare(valB, 'pl');
                case 'status':
                    valA = a.status || '';
                    valB = b.status || '';
                    return multiplier * valA.localeCompare(valB, 'pl');
                case 'total':
                    valA = a.total || 0;
                    valB = b.total || 0;
                    return multiplier * (valA - valB);
                default:
                    return 0;
            }
        });
    }

    // Obsługa kliknięcia w nagłówek sortowania
    function handleSortClick(e) {
        const header = e.target.closest('.sortable-header');
        if (!header) return;

        const column = header.dataset.sort;
        if (!column) return;

        // Zmień kierunek lub kolumnę
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }

        // Aktualizuj ikony
        updateSortIcons();

        // Sortuj i renderuj
        sortOrders();
        renderOrdersTable();
    }

    // Aktualizacja ikon sortowania
    function updateSortIcons() {
        document.querySelectorAll('.sortable-header').forEach(header => {
            const icon = header.querySelector('.sort-icon');
            if (!icon) return;

            const column = header.dataset.sort;
            if (column === currentSort.column) {
                icon.classList.add('active');
                icon.className = `fas fa-sort-${currentSort.direction === 'asc' ? 'up' : 'down'} sort-icon active`;
            } else {
                icon.classList.remove('active');
                icon.className = 'fas fa-sort sort-icon';
            }
        });
    }

    // Renderowanie tabeli zamówień
    function renderOrdersTable() {
        if (allOrders.length === 0) {
            ordersTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-gray-500">
                        Brak zamówień spełniających kryteria wyszukiwania
                    </td>
                </tr>
            `;
            ordersTableInfo.textContent = 'Pokazuje 0 z 0 zamówień';
            return;
        }

        // Sortuj przed renderowaniem
        sortOrders();

        const showUserColumn = ['ADMIN', 'SALES_DEPT'].includes(currentUserRole);
        const canCurrentRoleChangeStatus = ['ADMIN', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION', 'SALES_REP'].includes(currentUserRole);

        ordersTableBody.innerHTML = allOrders.map(order => {
            const date = new Date(order.createdAt).toLocaleDateString('pl-PL', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            const customerName = order.Customer?.name || '-';
            const customerNameSafe = escapeHtml(customerName);
            const userDisplayRaw = order.User?.shortCode || order.User?.name || '-';
            const userDisplaySafe = escapeHtml(userDisplayRaw);
            const orderNumberSafe = escapeHtml(order.orderNumber || '');
            const hasBelowStock = order.hasBelowStock === true;
            const belowStockBadge = hasBelowStock
                ? '<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Poniżej stanu</span>'
                : '';

            const allowedTransitions = canCurrentRoleChangeStatus
                ? getAllowedStatusTransitions(order.status, currentUserRole)
                : [];
            const canChangeStatus = allowedTransitions.length > 0;
            const statusClass = STATUS_CLASSES[order.status] || 'bg-gray-100 text-gray-800';
            const statusLabel = STATUS_LABELS[order.status] || order.status;
            const statusLabelSafe = escapeHtml(statusLabel);

            const availableStatuses = [order.status, ...allowedTransitions]
                .filter((status, index, arr) => arr.indexOf(status) === index);

            let statusContent;
            if (!canChangeStatus) {
                // Brak możliwości zmiany - statyczna pigułka o identycznym wyglądzie jak select
                statusContent = `<span class="status-pill-static" data-status="${order.status}">${statusLabelSafe}</span>`;
            } else if (ordersStatusViewMode === 'dropdown') {
                // Widok listy rozwijanej - styl jak przycisk z wypełnionym tłem
                statusContent = `
                    <select class="${STATUS_SELECT_BASE}"
                        data-status="${order.status}"
                        data-order-id="${order.id}"
                        data-original-status="${order.status}"
                        onclick="event.stopPropagation()">
                        ${availableStatuses.map(status => {
                            const optionLabel = escapeHtml(STATUS_LABELS[status] || status);
                            return `<option value="${status}" ${status === order.status ? 'selected' : ''}>${optionLabel}</option>`;
                        }).join('')}
                    </select>
                `;
            } else {
                // Widok pigułek (domyślny)
                statusContent = `
                    <div class="project-filter__switch order-status-switch" role="radiogroup" aria-label="Status zamówienia" onclick="event.stopPropagation()">
                        ${availableStatuses.map(status => `
                            <button type="button"
                                class="project-filter__option ${status === order.status ? 'project-filter__option--active' : ''}"
                                data-order-id="${order.id}"
                                data-status="${status}"
                                onclick="handleOrderStatusClick('${order.id}', '${order.status}', '${status}', event)">
                                ${STATUS_LABELS[status] || status}
                            </button>
                        `).join('')}
                    </div>
                `;
            }

            const userCell = showUserColumn 
                ? `<td class="p-4">${userDisplaySafe}</td>`
                : '';

            return `
                <tr class="hover:bg-gray-50 transition-colors cursor-pointer order-row" data-order-id="${order.id}">
                    <td class="p-4">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-chevron-right text-gray-400 transition-transform order-chevron"></i>
                            <div class="font-semibold text-blue-600 flex items-center">${orderNumberSafe}${belowStockBadge}</div>
                        </div>
                    </td>
                    <td class="p-4 text-gray-600">${date}</td>
                    <td class="p-4">
                        <div class="font-medium text-gray-900">${customerNameSafe}</div>
                    </td>
                    ${userCell}
                    <td class="p-4">
                        ${statusContent}
                    </td>
                    <td class="p-4 text-right font-semibold text-gray-900">${(order.total || 0).toFixed(2)} zł</td>
                    <td class="p-4 text-right">
                        <i class="fas fa-eye text-gray-400"></i>
                    </td>
                </tr>
            `;
        }).join('');

        // Podłącz event listenery do wierszy
        document.querySelectorAll('.order-row').forEach(row => {
            row.addEventListener('click', handleOrderRowClick);
        });

        document.querySelectorAll('select.order-status-select').forEach(select => {
            select.addEventListener('change', handleInlineStatusSelectChange);
        });

        ordersTableInfo.textContent = `Pokazuje ${allOrders.length} z ${allOrders.length} zamówień`;
    }

    // Obsługa kliknięcia na wiersz zamówienia
    function handleOrderRowClick(e) {
        const row = e.currentTarget;
        const orderId = row.dataset.orderId;

        // Blokada podczas ładowania
        if (loadingOrders.has(orderId)) {
            return;
        }

        // Sprawdź czy szczegóły są już otwarte
        const existingDetails = document.getElementById(`details-${orderId}`);
        if (existingDetails) {
            // Zamknij
            existingDetails.remove();
            rotateChevron(orderId, false);
            return;
        }

        // Otwórz nowe
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
            loadingOrders.add(orderId);
            showOrderDetailsInline(order, row).finally(() => {
                loadingOrders.delete(orderId);
            });
        }
    }

    // Obsługa kliknięć w tabeli (stary kod – zachowuję dla kompatybilności)
    function handleTableClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const orderId = target.dataset.orderId;
        const order = allOrders.find(o => o.id === orderId);

        if (!order) return;

        switch (action) {
            case 'view-details':
                showOrderDetails(order);
                break;
        }
    }

    // Historia zmian statusu
    const loadingHistory = new Set(); // Blokada przed wielokrotnym ładowaniem
    
    window.toggleOrderHistory = async function(orderId) {
        // Sprawdź, czy już nie ładujemy historii dla tego zamówienia
        if (loadingHistory.has(orderId)) {
            return;
        }
        
        const container = document.getElementById(`history-container-${orderId}`);
        const btnIcon = document.getElementById(`history-icon-${orderId}`);
        
        if (!container) return;

        if (!container.classList.contains('hidden')) {
            container.classList.add('hidden');
            if (btnIcon) btnIcon.className = 'fas fa-history';
            loadingHistory.delete(orderId);
            return;
        }

        // Dodaj do blokady
        loadingHistory.add(orderId);
        
        // Pokaż kontener i załaduj dane
        container.classList.remove('hidden');
        if (btnIcon) btnIcon.className = 'fas fa-spinner fa-spin';
        
        container.innerHTML = `
            <div class="flex justify-center p-4 text-gray-500 text-xs">
                <i class="fas fa-spinner fa-spin mr-2"></i> Ładowanie historii...
            </div>
        `;

        try {
            const response = await fetch(`/api/orders/${orderId}/history`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Błąd pobierania historii');

            const result = await response.json();
            const history = result.data || [];

            if (history.length === 0) {
                container.innerHTML = `<div class="p-3 text-center text-gray-500 text-xs italic">Brak historii zmian statusu</div>`;
            } else {
                const historyHtml = history.map(entry => {
                    const date = new Date(entry.changedAt).toLocaleString('pl-PL');
                    const oldStatusLabel = STATUS_LABELS[entry.oldStatus] || entry.oldStatus || '-';
                    const newStatusLabel = STATUS_LABELS[entry.newStatus] || entry.newStatus;
                    
                    // Kolory badge'y
                    const oldClass = entry.oldStatus ? (STATUS_CLASSES[entry.oldStatus] || 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-400';
                    const newClass = STATUS_CLASSES[entry.newStatus] || 'bg-gray-100 text-gray-800';

                    const userNameSafe = escapeHtml(entry.User?.name || 'System');
                    const notesPart = entry.notes
                        ? `<span class="text-gray-400 mx-1">•</span> <span class="italic">${escapeHtml(entry.notes)}</span>`
                        : '';

                    return `
                        <div class="flex items-start gap-3 p-2 hover:bg-gray-50 rounded transition-colors border-b border-gray-100 last:border-0">
                            <div class="text-gray-400 text-xs w-28 flex-shrink-0 pt-1">${date}</div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1 flex-wrap">
                                    <span class="px-2 py-0.5 rounded text-[10px] ${oldClass}">${oldStatusLabel}</span>
                                    <i class="fas fa-arrow-right text-gray-300 text-[10px]"></i>
                                    <span class="px-2 py-0.5 rounded text-[10px] ${newClass}">${newStatusLabel}</span>
                                </div>
                                <div class="text-xs text-gray-600">
                                    <span class="font-medium">${userNameSafe}</span>
                                    ${notesPart}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                container.innerHTML = `<div class="border border-gray-200 rounded bg-white mt-2">${historyHtml}</div>`;
            }
        } catch (error) {
            console.error('Błąd historii:', error);
            container.innerHTML = `<div class="p-3 text-center text-red-500 text-xs">Nie udało się pobrać historii</div>`;
        } finally {
            if (btnIcon) btnIcon.className = 'fas fa-history';
            loadingHistory.delete(orderId); // Usuń z blokady
        }
    };

    // Pokaż szczegóły jako rozwinięty wiersz w tabeli
    async function showOrderDetailsInline(order, tableRow) {
        try {
            const response = await fetch(`/api/orders/${order.id}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Nie udało się pobrać szczegółów');
            }

            const result = await response.json();
            const fullOrder = result.data;

            // Utwórz wiersz szczegółów
            const detailsRow = document.createElement('tr');
            detailsRow.id = `details-${order.id}`;
            detailsRow.className = 'bg-indigo-50 border-t-2 border-indigo-200 details-row';

            const orderItems = fullOrder.items || fullOrder.OrderItem || [];
            const showSourceBadge = true; // zawsze pokazuj źródło (PM/KI)
            const isEditMode = ordersInEditMode.has(order.id);
            const canEdit = canEditOrder(fullOrder);
            const canDeleteItems = ['SALES_DEPT', 'ADMIN'].includes(currentUserRole) && ['PENDING', 'APPROVED'].includes(fullOrder.status);
            
            const itemsHtml = orderItems.map(item => {
                const identifier = item.Product?.identifier || '-';
                const index = item.Product?.index || '-';
                const productLabel = (index && index !== '-' && index !== identifier) ? `${identifier} (${index})` : identifier;
                const sourceBadge = getSourceBadge(item.source, showSourceBadge);
                const locationDisplay = item.locationName || '';
                const notesDisplay = item.productionNotes || '';
                
                // Formatuj projekty z ilościami
                let projectsDisplay = item.selectedProjects || '';
                let perProjectInput = '';
                if (item.projectQuantities) {
                    try {
                        const pq = typeof item.projectQuantities === 'string' 
                            ? JSON.parse(item.projectQuantities) 
                            : item.projectQuantities;
                        if (Array.isArray(pq) && pq.length > 0) {
                            projectsDisplay = pq.map(p => `${p.projectNo}: ${p.qty}`).join(', ');
                            perProjectInput = pq.map(p => p.qty).join(',');
                        }
                    } catch (e) { /* ignore parse errors */ }
                }

                const productLabelSafe = escapeHtml(productLabel);
                const projectsDisplaySafe = escapeHtml(projectsDisplay);
                const projectsInputSafe = escapeHtml(item.selectedProjects || '');
                const perProjectInputSafe = escapeHtml(perProjectInput);
                const locationDisplaySafe = escapeHtml(locationDisplay);
                const notesDisplaySafe = escapeHtml(notesDisplay);

                // Flaga pozycji poniżej stanu
                const rawStockAtOrder = (item.stockAtOrder !== undefined && item.stockAtOrder !== null)
                    ? Number(item.stockAtOrder)
                    : null;
                const stockAtOrder = Number.isFinite(rawStockAtOrder) ? rawStockAtOrder : null;
                const isBelowStock = (item.belowStock === true) || (stockAtOrder !== null && item.quantity > stockAtOrder);
                const belowStockBadge = isBelowStock
                    ? `<span class="ml-1 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Poniżej stanu${stockAtOrder !== null ? ` (stan: ${stockAtOrder})` : ''}</span>`
                    : '';
                
                // Oznaczenie źródła prawdy
                const isPerProjectSource = item.quantitySource === 'perProject';
                const qtyClass = isPerProjectSource ? '' : 'font-bold text-blue-700 underline';
                const projectsClass = isPerProjectSource ? 'font-bold text-blue-700 underline' : '';

                // Tryb edycji - inputy zamiast tekstu
                if (isEditMode) {
                    const unitPrice = item.unitPrice || 0;
                    return `
                    <tr class="border-b border-indigo-100 hover:bg-indigo-100 transition-colors edit-item-row" 
                        data-item-id="${item.id}" 
                        data-stock="${stockAtOrder !== null ? stockAtOrder : ''}" 
                        data-unit-price="${unitPrice}">
                        <td class="p-2 text-xs font-medium text-gray-800">
                            <span class="product-label">${productLabelSafe}</span>
                            <span class="below-stock-badge">${belowStockBadge}</span>
                        </td>
                        <td class="p-1">
                            <input type="text" name="projects" value="${projectsInputSafe}" 
                                class="w-full mb-0.5 px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                                placeholder="Nr projektów (np. 1-5,10)">
                            <input type="text" name="projectQuantities" value="${perProjectInputSafe}" 
                                class="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                                placeholder="Ilości na proj. (np. po 20 lub 20,30,40)">
                            <div class="per-project-preview text-[10px] text-gray-500 mt-0.5">${projectsDisplaySafe}</div>
                        </td>
                        <td class="p-1 text-center">
                            <input type="number" name="quantity" value="${item.quantity}" min="1" 
                                class="qty-input w-16 px-1 py-0.5 text-xs text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        </td>
                        <td class="p-2 text-xs text-right text-gray-700">${unitPrice.toFixed(2)} zł</td>
                        <td class="p-2 text-xs text-right font-semibold text-gray-900 line-total">${(item.quantity * unitPrice).toFixed(2)} zł</td>
                        <td class="p-2 text-xs text-gray-700 text-right pr-4" style="padding-left: 3rem !important;">${sourceBadge}${locationDisplaySafe || '-'}</td>
                        <td class="p-1" style="padding-left: 3rem !important;">
                            <div class="flex items-center gap-1">
                                <input type="text" name="notes" value="${notesDisplaySafe}" 
                                    class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                                    placeholder="Uwagi produkcyjne">
                                ${canDeleteItems ? `
                                    <button type="button" onclick="deleteOrderItem('${fullOrder.id}', '${item.id}')" 
                                        class="text-red-600 hover:text-red-700 text-xs" title="Usuń pozycję">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                    `;
                }
                
                // Tryb podglądu - zwykły tekst
                const projectViewUrlDisplay = item.projectviewurl 
                    ? `<button onclick="showProductImage('${item.projectviewurl}', '${item.Product?.name || ''}', '${item.Product?.identifier || ''}', '${item.locationName || ''}')" class="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105" title="Pokaż podgląd produktu"><i class="fas fa-image text-sm"></i></button>`
                    : '-';
                
                return `
                <tr class="border-b border-indigo-100 hover:bg-indigo-100 transition-colors">
                    <td class="p-2 text-xs font-medium text-gray-800">${productLabelSafe}${belowStockBadge}</td>
                    <td class="p-2 text-xs text-gray-700 ${projectsClass}">${projectsDisplaySafe || '-'}</td>
                    <td class="p-2 text-xs text-center text-gray-700 ${qtyClass}">${item.quantity}</td>
                    <td class="p-2 text-xs text-right text-gray-700">${(item.unitPrice || 0).toFixed(2)} zł</td>
                    <td class="p-2 text-xs text-right font-semibold text-gray-900">${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)} zł</td>
                    <td class="p-2 text-xs text-gray-700 text-right pr-4" style="padding-left: 3rem !important;">${sourceBadge}${locationDisplaySafe || '-'}</td>
                    <td class="p-2 text-xs text-gray-600 italic" style="padding-left: 3rem !important;">${notesDisplaySafe || '-'}</td>
                    <td class="p-2 text-xs text-center">${projectViewUrlDisplay}</td>
                </tr>
                `;
            }).join('');

            const canEditNotes = ['ADMIN', 'SALES_DEPT'].includes(currentUserRole);

            // Formatowanie dat dla timeline
            const createdDate = new Date(fullOrder.createdAt).toLocaleString('pl-PL', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
            const updatedDate = fullOrder.updatedAt 
                ? new Date(fullOrder.updatedAt).toLocaleString('pl-PL', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                })
                : null;

            const timelineUserLabel = fullOrder.User ? (fullOrder.User.name || fullOrder.User.shortCode || '') : '';
            const timelineUserLabelSafe = escapeHtml(timelineUserLabel);

            // Timeline HTML
            const timelineHtml = `
                <div class="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                    <div class="flex items-center gap-1">
                        <i class="fas fa-plus-circle text-green-500"></i>
                        <span>Utworzono: <strong class="text-gray-700">${createdDate}</strong></span>
                        ${fullOrder.User ? `<span class="text-gray-400">przez ${timelineUserLabelSafe}</span>` : ''}
                    </div>
                    ${updatedDate && updatedDate !== createdDate ? `
                        <div class="flex items-center gap-1">
                            <i class="fas fa-edit text-blue-500"></i>
                            <span>Aktualizacja: <strong class="text-gray-700">${updatedDate}</strong></span>
                        </div>
                    ` : ''}
                    <div class="flex items-center gap-1">
                        <i class="fas fa-tag text-${(STATUS_CLASSES[fullOrder.status] || '').includes('yellow') ? 'yellow' : (STATUS_CLASSES[fullOrder.status] || '').includes('blue') ? 'blue' : (STATUS_CLASSES[fullOrder.status] || '').includes('green') ? 'green' : (STATUS_CLASSES[fullOrder.status] || '').includes('orange') ? 'orange' : (STATUS_CLASSES[fullOrder.status] || '').includes('purple') ? 'purple' : (STATUS_CLASSES[fullOrder.status] || '').includes('red') ? 'red' : 'gray'}-500"></i>
                        <span>Status: <strong class="text-gray-700">${STATUS_LABELS[fullOrder.status] || fullOrder.status}</strong></span>
                    </div>
                </div>
            `;

            detailsRow.innerHTML = `
                <td colspan="7" class="p-0">
                    <div class="p-4 space-y-3">
                        <!-- Timeline -->
                        ${timelineHtml}

                        <!-- Tabela pozycji -->
                        <div class="border border-indigo-200 rounded-lg overflow-hidden bg-white">
                            <table class="w-full text-xs">
                                <thead class="bg-indigo-100 border-b border-indigo-200">
                                    <tr>
                                        <th class="p-2 text-left font-semibold text-gray-800 text-xs">Produkt</th>
                                        <th class="p-2 text-left font-semibold text-gray-800 text-xs">Projekty</th>
                                        <th class="p-2 text-center font-semibold text-gray-800 text-xs" style="width:8%">Ilość</th>
                                        <th class="p-2 text-right font-semibold text-gray-800 text-xs" style="width:10%">Cena j.</th>
                                        <th class="p-2 text-right font-semibold text-gray-800 text-xs" style="width:12%">Wartość</th>
                                        <th class="p-2 text-left font-semibold text-gray-800 text-xs" style="width:12%; padding-left: 3rem !important;">Lokalizacja</th>
                                        <th class="p-2 text-left font-semibold text-gray-800 text-xs" style="width:20%; padding-left: 3rem !important;">Uwagi</th>
                                        <th class="p-2 text-center font-semibold text-gray-800 text-xs" style="width:10%">Widok projektów</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml || '<tr><td colspan="8" class="p-3 text-center text-gray-500">Brak pozycji</td></tr>'}
                                </tbody>
                            </table>
                        </div>

                        <!-- Notatki i Akcje -->
                        <div class="flex gap-3 items-end">
                            <!-- Notatki -->
                            <div class="flex-1">
                                ${canEditNotes ? `
                                    <textarea id="order-notes-${order.id}" class="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" rows="2" placeholder="Notatki...">${fullOrder.notes ? escapeHtml(fullOrder.notes) : ''}</textarea>
                                ` : `
                                    <div class="p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 max-h-16 overflow-y-auto">${fullOrder.notes ? escapeHtml(fullOrder.notes) : 'Brak notatek'}</div>
                                `}
                            </div>

                            <!-- Przyciski akcji -->
                            <div class="flex gap-2">
                                ${isEditMode ? `
                                    ${canEditNotes ? `
                                        <button onclick="saveOrderNotes('${fullOrder.id}')" class="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition-colors font-medium whitespace-nowrap flex items-center gap-1">
                                            <i class="fas fa-sticky-note"></i> Zapisz notatki
                                        </button>
                                    ` : ''}
                                    <button onclick="saveOrderItems('${fullOrder.id}')" class="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors font-medium whitespace-nowrap flex items-center gap-1">
                                        <i class="fas fa-save"></i> Zapisz zmiany
                                    </button>
                                    <button onclick="exitEditMode('${fullOrder.id}')" class="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors font-medium whitespace-nowrap flex items-center gap-1">
                                        <i class="fas fa-times"></i> Anuluj
                                    </button>
                                ` : `
                                    ${canEditNotes ? `
                                        <button onclick="saveOrderNotes('${fullOrder.id}')" class="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors font-medium whitespace-nowrap">
                                            <i class="fas fa-save"></i> Zapisz
                                        </button>
                                    ` : ''}
                                    ${canEdit ? `
                                        <button onclick="enterEditMode('${fullOrder.id}')" class="px-3 py-1 bg-amber-500 text-white text-xs rounded hover:bg-amber-600 transition-colors font-medium whitespace-nowrap flex items-center gap-1">
                                            <i class="fas fa-edit"></i> Edytuj pozycje
                                        </button>
                                    ` : ''}
                                    <button onclick="toggleOrderHistory('${fullOrder.id}')" class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors font-medium whitespace-nowrap flex items-center gap-1">
                                        <i id="history-icon-${fullOrder.id}" class="fas fa-history"></i> Historia
                                    </button>
                                `}
                                <div class="relative inline-block">
                                    <button onclick="togglePrintMenu('${fullOrder.id}')" class="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors font-medium whitespace-nowrap">
                                        <i class="fas fa-print"></i> Drukuj <i class="fas fa-chevron-down text-xs ml-1"></i>
                                    </button>
                                    <div id="print-menu-${fullOrder.id}" class="hidden absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                        <button onclick="printOrder('${fullOrder.id}', 'full')" class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center">
                                            <i class="fas fa-file-invoice text-blue-600 mr-2"></i>
                                            Zamówienie (z cenami)
                                        </button>
                                        <button onclick="printProductionWorkOrders('${fullOrder.id}')" class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center">
                                            <i class="fas fa-industry text-orange-600 mr-2"></i>
                                            Zlecenia produkcyjne (PDF)
                                        </button>
                                        <button onclick="printPackingList('${fullOrder.id}')" class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center">
                                            <i class="fas fa-box-open text-green-600 mr-2"></i>
                                            Lista kompletacyjna (PDF)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Kontener historii (domyślnie ukryty) -->
                        <div id="history-container-${order.id}" class="hidden transition-all duration-300 ease-in-out"></div>
                    </div>
                </td>
            `;

            // Wstaw wiersz szczegółów zaraz po wierszu zamówienia
            tableRow.insertAdjacentElement('afterend', detailsRow);

            // Obróć chevron
            rotateChevron(order.id, true);

            // Dodaj animację
            detailsRow.style.animation = 'slideDown 0.3s ease-out';

            // W trybie edycji - dodaj listenery do przeliczania wartości i stanu
            if (isEditMode) {
                const qtyInputs = detailsRow.querySelectorAll('.qty-input');
                qtyInputs.forEach(input => {
                    input.addEventListener('input', function() {
                        const row = this.closest('.edit-item-row');
                        if (!row) return;

                        const qty = parseInt(this.value, 10) || 0;
                        const unitPrice = parseFloat(row.dataset.unitPrice) || 0;
                        const stock = row.dataset.stock !== '' ? parseInt(row.dataset.stock, 10) : null;

                        // Przelicz wartość linii
                        const lineTotal = row.querySelector('.line-total');
                        if (lineTotal) {
                            lineTotal.textContent = (qty * unitPrice).toFixed(2) + ' zł';
                        }

                        // Aktualizuj badge "poniżej stanu"
                        const badgeContainer = row.querySelector('.below-stock-badge');
                        if (badgeContainer) {
                            if (stock !== null && qty > stock) {
                                badgeContainer.innerHTML = `<span class="ml-1 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Poniżej stanu (stan: ${stock})</span>`;
                            } else {
                                badgeContainer.innerHTML = '';
                            }
                        }

                        updatePerProjectFromTotalRow(row);
                    });
                });

                const perProjectInputs = detailsRow.querySelectorAll('input[name="projectQuantities"]');
                perProjectInputs.forEach(input => {
                    input.addEventListener('blur', function() {
                        const row = this.closest('.edit-item-row');
                        if (!row) return;
                        updateTotalFromPerProjectRow(row);
                    });
                });
            }
        } catch (error) {
            console.error('Błąd pobierania szczegółów:', error);
            showToast('Nie udało się pobrać szczegółów zamówienia', 'error');
        }
    }

    // Zamknij szczegóły zamówienia
    function closeOrderDetails(orderId) {
        const detailsRow = document.getElementById(`details-${orderId}`);
        if (detailsRow) {
            detailsRow.remove();
        }
        rotateChevron(orderId, false);
    }

    // Obróć chevron
    function rotateChevron(orderId, isExpanded) {
        const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
        if (row) {
            const chevron = row.querySelector('.order-chevron');
            if (chevron) {
                chevron.style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
            }
        }
    }

    // Zapisz notatki
    // options.silent = true -> brak zielonego bannera przy sukcesie (używane z saveOrderItems)
    async function saveOrderNotes(orderId, options = {}) {
        const { silent = false } = options;
        const textarea = document.getElementById(`order-notes-${orderId}`);
        const notes = textarea?.value || '';

        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ notes })
            });

            const result = await response.json();

            if (result.status === 'success') {
                // Zaktualizuj notatki w lokalnej liście zamówień, żeby od razu było widać zmianę
                const order = allOrders.find(o => o.id === orderId);
                if (order) {
                    order.notes = notes;
                }
                if (!silent) {
                    showToast('Notatki zostały zapisane', 'success');
                }
            } else {
                showToast(result.message || 'Nie udało się zapisać notatek', 'error');
            }
        } catch (error) {
            console.error('Błąd zapisu notatek:', error);
            showToast('Błąd połączenia z serwerem', 'error');
        }
    }

    async function changeOrderStatus(orderId, originalStatus, newStatus) {
        if (newStatus === originalStatus) return;

        try {
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
            });

            const result = await response.json();

            if (result.status === 'success') {
                const order = allOrders.find(o => o.id === orderId);
                if (order) {
                    order.status = newStatus;
                }
            } else {
                showToast(result.message || 'Nie udało się zmienić statusu', 'error');
            }
        } catch (error) {
            console.error('Błąd zmiany statusu:', error);
            showToast('Błąd połączenia z serwerem', 'error');
        } finally {
            // Zawsze odśwież tabelę, żeby mieć spójny widok
            renderOrdersTable();
        }
    }

    // Obsługa zmiany statusu inline (select w tabeli)
    async function handleInlineStatusSelectChange(e) {
        const select = e.target;
        const orderId = select.dataset.orderId;
        const originalStatus = select.dataset.originalStatus;
        const newStatus = select.value;

        // Natychmiast aktualizuj kolor przycisku
        select.dataset.status = newStatus;
        
        select.disabled = true;
        await changeOrderStatus(orderId, originalStatus, newStatus);
        select.disabled = false;
    }

    // Obsługa kliknięcia w przycisk statusu (przełącznik w stylu project-filter__switch)
    window.handleOrderStatusClick = async function(orderId, originalStatus, newStatus, event) {
        if (event) {
            event.stopPropagation();
        }
        await changeOrderStatus(orderId, originalStatus, newStatus);
    };

    // Edytuj status (placeholder - stara funkcja)
    function editOrderStatus(orderId) {
        showToast('Użyj listy w kolumnie Status', 'info');
    }

    // Print Preview
    function togglePrintMenu(orderId) {
        const menu = document.getElementById(`print-menu-${orderId}`);
        // Zamknij wszystkie inne menu
        document.querySelectorAll('[id^="print-menu-"]').forEach(m => {
            if (m.id !== `print-menu-${orderId}`) {
                m.classList.add('hidden');
            }
        });
        // Przełącz aktualne menu
        menu.classList.toggle('hidden');
    }

    // Zamknij menu po kliknięciu poza nim
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.relative.inline-block')) {
            document.querySelectorAll('[id^="print-menu-"]').forEach(menu => {
                menu.classList.add('hidden');
            });
        }
    });

    // Drukuj zlecenia produkcyjne dla pokoi produkcyjnych (ProductionWorkOrder) powiązane z zamówieniem
    async function printProductionWorkOrders(orderId) {
        try {
            // Zamknij menu druku
            document.querySelectorAll('[id^="print-menu-"]').forEach(menu => {
                menu.classList.add('hidden');
            });

            showToast('Wyszukiwanie zleceń produkcyjnych...', 'info');

            const response = await fetch(`/api/orders/${orderId}/production-work-orders`, {
                credentials: 'include'
            });

            if (!response.ok) {
                console.error('Błąd pobierania zleceń produkcyjnych:', response.status, response.statusText);
                showToast('Nie udało się pobrać zleceń produkcyjnych dla tego zamówienia', 'error');
                return;
            }

            const result = await response.json();
            const workOrders = Array.isArray(result.data) ? result.data : [];

            if (workOrders.length === 0) {
                showToast('Brak zleceń produkcyjnych dla tego zamówienia', 'warning');
                return;
            }

            if (workOrders.length === 1) {
                const w = workOrders[0];
                const url = `/api/production/work-orders/${w.id}/print`;
                window.open(url, '_blank');
                return;
            }

            // Więcej niż jedno zlecenie - otwórz wszystkie w osobnych kartach
            workOrders.forEach(w => {
                const url = `/api/production/work-orders/${w.id}/print`;
                window.open(url, '_blank');
            });

            showToast(`Otworzono ${workOrders.length} zleceń produkcyjnych do druku`, 'success');
        } catch (error) {
            console.error('Błąd druku zleceń produkcyjnych:', error);
            showToast('Błąd druku zleceń produkcyjnych', 'error');
        }
    }

    // Drukuj listę kompletacyjną (PDF z backendu)
    async function printPackingList(orderId) {
        try {
            // Zamknij menu druku
            document.querySelectorAll('[id^="print-menu-"]').forEach(menu => {
                menu.classList.add('hidden');
            });

            showToast('Generowanie listy kompletacyjnej...', 'info');

            // Otwórz PDF w nowym oknie
            const printUrl = `/api/orders/${orderId}/packing-list/print`;
            window.open(printUrl, '_blank');

        } catch (error) {
            console.error('Błąd druku listy kompletacyjnej:', error);
            showToast('Błąd generowania listy kompletacyjnej', 'error');
        }
    }

    async function printOrder(orderId, mode = 'full') {
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Nie udało się pobrać szczegółów zamówienia');
            }

            const result = await response.json();
            const order = result.data;

            // Ustawienia trybu druku
            const isProductionOrder = mode === 'production';
            const includePrices = !isProductionOrder;
            const documentTitle = isProductionOrder ? 'ZLECENIE PRODUKCYJNE' : 'ZAMÓWIENIE';

            // Generuj HTML do wydruku
            const printOrderItems = order.items || order.OrderItem || [];
            const printShowSourceBadge = true; // zawsze pokazuj źródło (PM/KI) na wydruku
            
            // Grupowanie według ścieżek produkcyjnych dla zlecenia produkcyjnego
            let groupedItems;
            if (isProductionOrder) {
                groupedItems = {};

                printOrderItems.forEach(item => {
                    const path = item.Product?.productionPath || 'Standardowa';
                    if (!groupedItems[path]) groupedItems[path] = [];
                    groupedItems[path].push(item);
                });
            } else {
                groupedItems = { 'Wszystkie pozycje': printOrderItems };
            }

            // Funkcja generująca HTML dla grupy produktów
            const generateGroupHtml = (items, productionPath = null, groupIndex = 0) => {
                const itemsHtml = items.map(item => {
                    const identifier = item.Product?.identifier || '-';
                    const index = item.Product?.index || '-';
                    const productLabel = (index && index !== '-' && index !== identifier) ? `${identifier} (${index})` : identifier;
                    const sourcePrefix = printShowSourceBadge && item.source ? `[${SOURCE_LABELS[item.source] || item.source}] ` : '';
                    const locationDisplay = item.locationName || '-';
                    const notesDisplay = item.productionNotes || '';
                    
                    // Formatuj projekty z ilościami
                    let projectsDisplay = item.selectedProjects || '-';
                    if (item.projectQuantities) {
                        try {
                            const pq = typeof item.projectQuantities === 'string' 
                                ? JSON.parse(item.projectQuantities) 
                                : item.projectQuantities;
                            if (Array.isArray(pq) && pq.length > 0) {
                                projectsDisplay = pq.map(p => `${p.projectNo}: ${p.qty}`).join(', ');
                            }
                        } catch (e) { /* ignore parse errors */ }
                    }
                    
                    // Oznaczenie źródła prawdy na wydruku
                    const isPerProjectSource = item.quantitySource === 'perProject';
                    const qtyStyle = isPerProjectSource ? '' : 'font-weight: bold; text-decoration: underline; color: #1d4ed8;';
                    const projectsStyle = isPerProjectSource ? 'font-weight: bold; text-decoration: underline; color: #1d4ed8;' : '';
                    
                    const productLabelSafe = escapeHtml(productLabel);
                    const projectsDisplaySafe = escapeHtml(projectsDisplay);
                    const locationDisplaySafe = escapeHtml(locationDisplay);
                    const notesDisplaySafe = escapeHtml(notesDisplay || '');

                    const rawStockAtOrder = (item.stockAtOrder !== undefined && item.stockAtOrder !== null)
                        ? Number(item.stockAtOrder)
                        : null;
                    const stockAtOrder = Number.isFinite(rawStockAtOrder) ? rawStockAtOrder : null;
                    const isBelowStock = (item.belowStock === true) || (stockAtOrder !== null && item.quantity > stockAtOrder);
                    const belowStockHtml = isBelowStock
                        ? `<div style="color:#b91c1c;font-size:8px;margin-top:2px;">Poniżej stanu${stockAtOrder !== null ? ` (stan: ${stockAtOrder})` : ''}</div>`
                        : '';

                    const priceColumns = includePrices ? `
                        <td style="text-align: right; font-size: 9px;">${(item.unitPrice || 0).toFixed(2)} zł</td>
                        <td style="text-align: right; font-size: 9px;">${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)} zł</td>` : '';
                    
                    const notesColumn = isProductionOrder ? `
                        <td style="font-size: 8px; font-style: italic; color: #666; font-weight: bold;">${notesDisplaySafe || 'Brak'}</td>` : '';
                    
                    return `
                    <tr>
                        <td style="font-size: 9px;">${productLabelSafe}${belowStockHtml}</td>
                        <td style="font-size: 9px; ${projectsStyle}">${projectsDisplaySafe}</td>
                        <td style="text-align: center; font-size: 9px; ${qtyStyle}">${item.quantity}</td>
                        ${priceColumns}
                        <td style="font-size: 9px;">${sourcePrefix}${locationDisplaySafe}</td>
                        ${notesColumn}
                    </tr>
                    `;
                }).join('');

                const pathTitle = productionPath ? ` - ${escapeHtml(productionPath)}` : '';
                const orderNumberSuffix = productionPath ? `/${groupIndex + 1}` : '';
                const customerNameSafe = escapeHtml(order.Customer?.name || '-');
                const userDisplaySafe = escapeHtml(order.User?.name || order.User?.shortCode || '-');
                
                return `
                    <div class="print-document" style="${groupIndex > 0 ? 'page-break-before: always;' : ''}">
                        <div class="print-header">
                            <div>
                                <div class="print-company">ZAMÓWIENIA</div>
                                <div class="print-title">${documentTitle}${pathTitle} ${order.orderNumber}${orderNumberSuffix}</div>
                            </div>
                            <div class="print-meta">
                                <div>Data: ${createdDate}</div>
                                <div>Status: ${STATUS_LABELS[order.status] || order.status}</div>
                            </div>
                        </div>

                        <div class="print-section">
                            <div class="print-grid">
                                <div class="print-field">
                                    <div class="print-field-label">Klient</div>
                                    <div class="print-field-value">${customerNameSafe}</div>
                                </div>
                                <div class="print-field">
                                    <div class="print-field-label">Handlowiec</div>
                                    <div class="print-field-value">${userDisplaySafe}</div>
                                </div>
                            </div>
                        </div>

                        <div class="print-section">
                            <div class="print-section-title">Pozycje</div>
                            <table class="print-table">
                                <thead>
                                    <tr>
                                        <th style="font-size: 9px;">Produkt</th>
                                        <th style="font-size: 9px;">Projekty</th>
                                        <th style="text-align: center; font-size: 9px;">Ilość</th>
                                        ${includePrices ? '<th style="text-align: right; font-size: 9px;">Cena j.</th><th style="text-align: right; font-size: 9px;">Wartość</th>' : ''}
                                        <th style="font-size: 9px;">Lokalizacja</th>
                                        ${isProductionOrder ? '<th style="font-size: 9px;">Uwagi produkcyjne</th>' : '<th style="font-size: 9px;">Uwagi</th>'}
                                        <th style="font-size: 9px;">Widok projektów</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml || `<tr><td colspan="${includePrices ? 8 : 6}" style="text-align: center; color: #999;">Brak pozycji</td></tr>`}
                                </tbody>
                            </table>
                        </div>

                        ${includePrices ? `
                        <div class="print-total">
                            Razem: ${(items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0)).toFixed(2)} zł
                        </div>` : ''}

                        ${order.notes ? `
                            <div class="print-section" style="margin-top: 8px;">
                                <div class="print-section-title">Notatki</div>
                                <div style="font-size: 10px; color: #374151; white-space: pre-wrap; line-height: 1.2;">${escapeHtml(order.notes)}</div>
                            </div>
                        ` : ''}

                        <div class="print-footer">
                            <div>Wydruk z systemu zarządzania zamówieniami | ${new Date().toLocaleString('pl-PL')}</div>
                        </div>
                    </div>
                `;
            };

            const createdDate = new Date(order.createdAt).toLocaleString('pl-PL', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });

            // Generuj HTML dla wszystkich grup
            const printHtml = Object.entries(groupedItems)
                .map(([productionPath, items], index) => 
                    generateGroupHtml(items, isProductionOrder ? productionPath : null, index)
                )
                .join('');

            printPreviewContent.innerHTML = printHtml;
            printPreviewModal.classList.remove('hidden');
        } catch (error) {
            console.error('Błąd przygotowania wydruku:', error);
            showToast('Nie udało się przygotować wydruku', 'error');
        }
    }

    // Eksport CSV
    function exportToCSV() {
        if (allOrders.length === 0) {
            showToast('Brak zamówień do eksportu', 'warning');
            return;
        }

        const headers = ['Numer zamówienia', 'Data', 'Klient', 'Handlowiec', 'Status', 'Wartość'];
        
        const rows = allOrders.map(order => {
            const date = new Date(order.createdAt).toLocaleDateString('pl-PL', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return [
                order.orderNumber || '',
                date,
                order.Customer?.name || '',
                order.User?.name || order.User?.shortCode || '',
                STATUS_LABELS[order.status] || order.status,
                (order.total || 0).toFixed(2)
            ];
        });

        // Escape CSV values
        const escapeCSV = (val) => {
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const csvContent = [
            headers.map(escapeCSV).join(','),
            ...rows.map(row => row.map(escapeCSV).join(','))
        ].join('\n');

        // BOM for UTF-8
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `zamowienia_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast(`Wyeksportowano ${allOrders.length} zamówień`, 'success');
    }

    // Pokazanie szczegółów zamówienia (stara funkcja – zachowuję dla kompatybilności)
    async function showOrderDetails(order) {
        try {
            // Pobierz pełne szczegóły zamówienia z backendu
            const response = await fetch(`/api/orders/${order.id}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Nie udało się pobrać szczegółów zamówienia');
            }

            const result = await response.json();
            const fullOrder = result.data;

            orderDetailsTitle.textContent = `Zamówienie ${fullOrder.orderNumber}`;
            
            const statusLabels = {
                'PENDING': 'Oczekujące',
                'APPROVED': 'Zatwierdzone',
                'IN_PRODUCTION': 'W produkcji',
                'READY': 'Gotowe',
                'SHIPPED': 'Wysłane',
                'DELIVERED': 'Dostarczone',
                'CANCELLED': 'Anulowane'
            };

            const statusColors = {
                'PENDING': 'bg-yellow-100 text-yellow-800',
                'APPROVED': 'bg-blue-100 text-blue-800',
                'IN_PRODUCTION': 'bg-orange-100 text-orange-800',
                'READY': 'bg-green-100 text-green-800',
                'SHIPPED': 'bg-purple-100 text-purple-800',
                'DELIVERED': 'bg-gray-100 text-gray-800',
                'CANCELLED': 'bg-red-100 text-red-800'
            };

            // Określ dozwolone statusy dla roli
            const allowedTransitions = getAllowedStatusTransitions(fullOrder.status, currentUserRole);
            const canChangeStatus = allowedTransitions.length > 0;
            const canEditNotes = ['ADMIN', 'SALES_DEPT'].includes(currentUserRole);

            const statusDropdown = canChangeStatus ? `
                <select id="order-status-select" class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="${fullOrder.status}">${statusLabels[fullOrder.status]}</option>
                    ${allowedTransitions.map(status => `<option value="${status}">${statusLabels[status]}</option>`).join('')}
                </select>
                <button id="save-status-btn" class="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i class="fas fa-save"></i> Zapisz status
                </button>
            ` : `<span class="px-3 py-1 rounded-full text-xs font-medium ${statusColors[fullOrder.status]}">${statusLabels[fullOrder.status]}</span>`;

            const itemsHtml = (fullOrder.items || fullOrder.OrderItem || []).map(item => {
                // Formatuj projekty z ilościami
                let projectsDisplay = item.selectedProjects || '-';
                if (item.projectQuantities) {
                    try {
                        const pq = typeof item.projectQuantities === 'string' 
                            ? JSON.parse(item.projectQuantities) 
                            : item.projectQuantities;
                        if (Array.isArray(pq) && pq.length > 0) {
                            projectsDisplay = pq.map(p => `${p.projectNo}: ${p.qty}`).join(', ');
                        }
                    } catch (e) { /* ignore parse errors */ }
                }

                const productLabel = item.Product?.identifier || item.Product?.name || '-';

                const rawStockAtOrder = (item.stockAtOrder !== undefined && item.stockAtOrder !== null)
                    ? Number(item.stockAtOrder)
                    : null;
                const stockAtOrder = Number.isFinite(rawStockAtOrder) ? rawStockAtOrder : null;
                const isBelowStock = (item.belowStock === true) || (stockAtOrder !== null && item.quantity > stockAtOrder);
                const belowStockInfo = isBelowStock
                    ? `<div class="text-xs text-red-700 mt-1">Poniżej stanu${stockAtOrder !== null ? ` (stan: ${stockAtOrder})` : ''}</div>`
                    : '';
                
                const projectViewUrlDisplay = item.projectviewurl 
                    ? `<button onclick="showProductImage('${item.projectviewurl}', '${item.Product?.name || ''}', '${item.Product?.identifier || ''}', '${item.locationName || ''}')" class="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105" title="Pokaż podgląd produktu"><i class="fas fa-image text-sm"></i></button>`
                    : '-';
                
                return `
                <tr class="border-b">
                    <td class="p-3">${productLabel}${belowStockInfo}</td>
                    <td class="p-3">${projectsDisplay}</td>
                    <td class="p-3 text-center">${item.quantity}</td>
                    <td class="p-3 text-right">${(item.unitPrice || 0).toFixed(2)} zł</td>
                    <td class="p-3 text-right font-semibold">${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)} zł</td>
                    <td class="p-3">${item.locationName || '-'}</td>
                    <td class="p-3 text-center">${projectViewUrlDisplay}</td>
                </tr>
            `}).join('');

            orderDetailsContent.innerHTML = `
                <div class="space-y-6">
                    <!-- Informacje podstawowe -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <div class="text-sm text-gray-500">Numer zamówienia</div>
                            <div class="font-semibold text-lg">${fullOrder.orderNumber}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 mb-1">Status</div>
                            <div>${statusDropdown}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">Klient</div>
                            <div class="font-semibold">${fullOrder.Customer?.name || '-'}</div>
                            ${fullOrder.Customer?.city ? `<div class="text-sm text-gray-600">${fullOrder.Customer.city}</div>` : ''}
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">Handlowiec</div>
                            <div class="font-semibold">${fullOrder.User?.name || '-'} (${fullOrder.User?.shortCode || '-'})</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">Data utworzenia</div>
                            <div class="font-semibold">${new Date(fullOrder.createdAt).toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">Wartość całkowita</div>
                            <div class="font-semibold text-xl text-blue-600">${(fullOrder.total || 0).toFixed(2)} zł</div>
                        </div>
                    </div>

                    <!-- Pozycje zamówienia -->
                    <div>
                        <h4 class="font-semibold text-gray-900 mb-3">Pozycje zamówienia</h4>
                        <div class="border rounded-lg overflow-hidden">
                            <table class="w-full text-sm">
                                <thead class="bg-gray-50 text-gray-600 text-xs uppercase">
                                    <tr>
                                        <th class="p-3 text-left">Produkt</th>
                                        <th class="p-3 text-left">Projekty</th>
                                        <th class="p-3 text-center">Ilość</th>
                                        <th class="p-3 text-right">Cena j.</th>
                                        <th class="p-3 text-right">Wartość</th>
                                        <th class="p-3 text-left">Lokalizacja</th>
                                        <th class="p-3 text-center">Widok projektów</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml || '<tr><td colspan="7" class="p-4 text-center text-gray-500">Brak pozycji</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Notatki -->
                    <div>
                        <h4 class="font-semibold text-gray-900 mb-2">Notatki</h4>
                        ${canEditNotes ? `
                            <textarea id="order-notes-textarea" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows="4" placeholder="Dodaj notatki do zamówienia...">${fullOrder.notes || ''}</textarea>
                            <button id="save-notes-btn" class="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                <i class="fas fa-save"></i> Zapisz notatki
                            </button>
                        ` : `
                            <div class="p-3 bg-gray-50 rounded border border-gray-200">${fullOrder.notes || 'Brak notatek'}</div>
                        `}
                    </div>

                    <!-- Historia zmian statusu -->
                    <div>
                        <h4 class="font-semibold text-gray-900 mb-3">Historia zmian statusu</h4>
                        <div id="order-history-container" class="space-y-2">
                            <div class="flex items-center justify-center p-4 text-gray-500">
                                <i class="fas fa-spinner fa-spin mr-2"></i>
                                Ładowanie historii...
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Podłącz event listenery
            if (canChangeStatus) {
                const saveStatusBtn = document.getElementById('save-status-btn');
                if (saveStatusBtn) {
                    saveStatusBtn.addEventListener('click', () => handleStatusChange(fullOrder.id));
                }
            }

            if (canEditNotes) {
                const saveNotesBtn = document.getElementById('save-notes-btn');
                if (saveNotesBtn) {
                    saveNotesBtn.addEventListener('click', () => handleNotesChange(fullOrder.id));
                }
            }

            // Nie ładuj historii automatycznie - tylko na kliknięcie przycisku
            // loadOrderHistory(fullOrder.id);

            orderDetailsModal.classList.remove('hidden');
        } catch (error) {
            console.error('Błąd pobierania szczegółów zamówienia:', error);
            showToast('Nie udało się pobrać szczegółów zamówienia', 'error');
        }
    }

    // Dozwolone przejścia statusów dla roli
    function getAllowedStatusTransitions(currentStatus, role) {
        const transitions = {
            SALES_REP: {
                'PENDING': ['CANCELLED']
            },
            SALES_DEPT: {
                'PENDING': ['APPROVED', 'CANCELLED'],
                'APPROVED': ['CANCELLED'], // Usunięte IN_PRODUCTION - to rola produkcji
                'IN_PRODUCTION': ['CANCELLED'],
                'READY': ['CANCELLED'],
                'SHIPPED': ['DELIVERED']
            },
            PRODUCTION: {
                'APPROVED': ['IN_PRODUCTION'],
                'IN_PRODUCTION': ['READY']
            },
            WAREHOUSE: {
                'READY': ['SHIPPED']
            },
            ADMIN: {
                'PENDING': ['APPROVED', 'CANCELLED'],
                'APPROVED': ['IN_PRODUCTION', 'CANCELLED'],
                'IN_PRODUCTION': ['READY', 'CANCELLED'],
                'READY': ['SHIPPED', 'CANCELLED'],
                'SHIPPED': ['DELIVERED']
            }
        };

        return transitions[role]?.[currentStatus] || [];
    }

    // Ładowanie historii zmian statusu
    async function loadOrderHistory(orderId) {
        try {
            const response = await fetch(`/api/orders/${orderId}/history`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Nie udało się pobrać historii zmian');
            }

            const result = await response.json();
            const history = result.data || [];

            const statusLabels = {
                'PENDING': 'Oczekujące',
                'APPROVED': 'Zatwierdzone',
                'IN_PRODUCTION': 'W produkcji',
                'READY': 'Gotowe',
                'SHIPPED': 'Wysłane',
                'DELIVERED': 'Dostarczone',
                'CANCELLED': 'Anulowane'
            };

            const statusColors = {
                'PENDING': 'bg-yellow-100 text-yellow-800',
                'APPROVED': 'bg-blue-100 text-blue-800',
                'IN_PRODUCTION': 'bg-orange-100 text-orange-800',
                'READY': 'bg-green-100 text-green-800',
                'SHIPPED': 'bg-purple-100 text-purple-800',
                'DELIVERED': 'bg-gray-100 text-gray-800',
                'CANCELLED': 'bg-red-100 text-red-800'
            };

            const historyHtml = history.map(item => {
                const oldStatusBadge = item.oldStatus ? 
                    `<span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.oldStatus]}">${statusLabels[item.oldStatus]}</span>` : 
                    '<span class="text-gray-500 italic">Nowe zamówienie</span>';
                
                const newStatusBadge = 
                    `<span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.newStatus]}">${statusLabels[item.newStatus]}</span>`;

                return `
                    <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-exchange-alt text-blue-600 text-xs"></i>
                        </div>
                        <div class="flex-grow">
                            <div class="flex items-center gap-2 mb-1">
                                ${oldStatusBadge}
                                <i class="fas fa-arrow-right text-gray-400 text-xs"></i>
                                ${newStatusBadge}
                            </div>
                            <div class="text-sm text-gray-600">
                                <span class="font-medium">${item.User?.name || 'System'}</span>
                                ${item.User?.email ? `<span class="text-gray-400">(${item.User.email})</span>` : ''}
                                <span class="mx-2">•</span>
                                <span>${new Date(item.changedAt).toLocaleDateString('pl-PL', { 
                                    year: 'numeric', 
                                    month: '2-digit', 
                                    day: '2-digit', 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                })}</span>
                            </div>
                            ${item.notes ? `<div class="text-sm text-gray-500 mt-1">${item.notes}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            const container = document.getElementById('order-history-container');
            if (container) {
                if (history.length === 0) {
                    container.innerHTML = `
                        <div class="text-center p-4 text-gray-500">
                            <i class="fas fa-info-circle text-2xl mb-2"></i>
                            <div>Brak historii zmian statusu</div>
                        </div>
                    `;
                } else {
                    container.innerHTML = historyHtml;
                }
            }
        } catch (error) {
            console.error('Błąd ładowania historii zmian:', error);
            const container = document.getElementById('order-history-container');
            if (container) {
                container.innerHTML = `
                    <div class="text-center p-4 text-red-500">
                        <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                        <div>Błąd: ${error.message}</div>
                    </div>
                `;
            }
        }
    }

    // Zmiana statusu zamówienia
    async function handleStatusChange(orderId) {
        const statusSelect = document.getElementById('order-status-select');
        const newStatus = statusSelect?.value;

        if (!newStatus) {
            showToast('Wybierz nowy status', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
            });

            const result = await response.json();

            if (result.status === 'success') {
                showToast('Status zamówienia został zaktualizowany', 'success');
                // Odśwież historię zmian bez zamykania modalu
                loadOrderHistory(orderId);
                // Aktualizuj dropdown statusu w modalu
                const statusSelect = document.getElementById('order-status-select');
                if (statusSelect) {
                    statusSelect.value = newStatus;
                }
                // Odśwież listę zamówień w tle
                fetchOrders();
            } else {
                showToast(result.message || 'Nie udało się zmienić statusu', 'error');
            }
        } catch (error) {
            console.error('Błąd zmiany statusu:', error);
            showToast('Błąd połączenia z serwerem', 'error');
        }
    }

    // Zmiana notatek zamówienia
    async function handleNotesChange(orderId) {
        const notesTextarea = document.getElementById('order-notes-textarea');
        const notes = notesTextarea?.value || '';

        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ notes })
            });

            const result = await response.json();

            if (result.status === 'success') {
                showToast('Notatki zostały zapisane', 'success');
            } else {
                showToast(result.message || 'Nie udało się zapisać notatek', 'error');
            }
        } catch (error) {
            console.error('Błąd zapisu notatek:', error);
            showToast('Błąd połączenia z serwerem', 'error');
        }
    }

    // Zamknięcie szczegółów zamówienia
    function closeOrderDetails() {
        orderDetailsModal.classList.add('hidden');
    }

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

    // Eksport funkcji na window dla onclick w HTML
    window.printOrder = printOrder;
    window.printProductionWorkOrders = printProductionWorkOrders;
    window.togglePrintMenu = togglePrintMenu;
    window.saveOrderNotes = saveOrderNotes;
    window.editOrderStatus = editOrderStatus;
    window.showProductImage = showProductImage;

    // Inicjalizacja przełącznika widoku statusów
    initOrdersStatusViewToggle();

    // Uruchomienie aplikacji
    init();
});

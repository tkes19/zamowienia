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
    const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const adminLink = document.getElementById('admin-link');
    const clientsLink = document.getElementById('clients-link');
    const orderDetailsModal = document.getElementById('order-details-modal');
    const orderDetailsClose = document.getElementById('order-details-close');
    const orderDetailsTitle = document.getElementById('order-details-title');
    const orderDetailsContent = document.getElementById('order-details-content');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const printPreviewModal = document.getElementById('print-preview-modal');
    const printPreviewContent = document.getElementById('print-preview-content');
    const printPreviewPrintBtn = document.getElementById('print-preview-print');
    const printPreviewCloseBtn = document.getElementById('print-preview-close');

    let allOrders = [];
    let currentUserRole = null;
    let allSalesReps = [];
    const loadingOrders = new Set(); // Blokada podczas ładowania

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

    const STATUS_SELECT_BASE = 'order-status-select px-3 py-1 rounded-full text-xs font-semibold border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all cursor-pointer';

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
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
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

            // Pokaż linki w zależności od roli
            if (currentUserRole === 'ADMIN') {
                adminLink.style.display = 'flex';
            }

            if (['SALES_REP', 'SALES_DEPT', 'ADMIN'].includes(currentUserRole)) {
                clientsLink.style.display = 'flex';
            }

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
            options.push(`<option value="${rep.id}">${rep.name} (${rep.email})</option>`);
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
                        * { margin: 0; padding: 0; }
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 10px; line-height: 1.3; }
                        .print-document { background: white; padding: 15px; max-width: 210mm; margin: 0 auto; }
                        .print-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; border-bottom: 1px solid #1f2937; padding-bottom: 8px; }
                        .print-company { font-size: 16px; font-weight: bold; color: #1f2937; }
                        .print-title { font-size: 14px; font-weight: bold; color: #1f2937; margin-top: 2px; }
                        .print-meta { font-size: 10px; color: #6b7280; text-align: right; }
                        .print-section { margin-bottom: 10px; }
                        .print-section-title { font-size: 11px; font-weight: bold; color: #1f2937; margin-bottom: 6px; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; }
                        .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
                        .print-field { font-size: 10px; }
                        .print-field-label { color: #6b7280; font-weight: 600; margin-bottom: 2px; }
                        .print-field-value { color: #1f2937; font-weight: 500; }
                        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
                        .print-table thead { background: #f3f4f6; border-bottom: 1px solid #d1d5db; }
                        .print-table th { padding: 4px 6px; text-align: left; font-weight: 600; color: #1f2937; }
                        .print-table td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; color: #374151; }
                        .print-table tbody tr:last-child td { border-bottom: none; }
                        .print-total { text-align: right; font-size: 11px; font-weight: bold; color: #1f2937; margin-top: 8px; padding-top: 6px; border-top: 1px solid #d1d5db; }
                        .print-footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #6b7280; text-align: center; }
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

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/login';
        } catch (error) {
            console.error('Błąd wylogowania:', error);
            window.location.href = '/login';
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

            const allowedTransitions = canCurrentRoleChangeStatus
                ? getAllowedStatusTransitions(order.status, currentUserRole)
                : [];
            const canChangeStatus = allowedTransitions.length > 0;
            const statusClass = STATUS_CLASSES[order.status] || 'bg-gray-100 text-gray-800';
            const statusLabel = STATUS_LABELS[order.status] || order.status;

            const statusContent = canChangeStatus
                ? `<select class="${STATUS_SELECT_BASE} ${statusClass}" data-order-id="${order.id}" data-original-status="${order.status}" onclick="event.stopPropagation()">
                        ${[order.status, ...allowedTransitions]
                            .filter((status, index, arr) => arr.indexOf(status) === index)
                            .map(status => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${STATUS_LABELS[status] || status}</option>`)
                            .join('')}
                   </select>`
                : `<span class="px-3 py-1 rounded-full text-xs font-medium ${statusClass}">${statusLabel}</span>`;

            const userCell = showUserColumn 
                ? `<td class="p-4">${order.User?.shortCode || order.User?.name || '-'}</td>`
                : '';

            return `
                <tr class="hover:bg-gray-50 transition-colors cursor-pointer order-row" data-order-id="${order.id}">
                    <td class="p-4">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-chevron-right text-gray-400 transition-transform order-chevron"></i>
                            <div class="font-semibold text-blue-600">${order.orderNumber}</div>
                        </div>
                    </td>
                    <td class="p-4 text-gray-600">${date}</td>
                    <td class="p-4">
                        <div class="font-medium text-gray-900">${order.Customer?.name || '-'}</div>
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
            console.log(`[toggleOrderHistory] Historia dla ${orderId} już się ładuje`);
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
                                    <span class="font-medium">${entry.User?.name || 'System'}</span>
                                    ${entry.notes ? `<span class="text-gray-400 mx-1">•</span> <span class="italic">${entry.notes}</span>` : ''}
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

            const orderItems = fullOrder.OrderItem || [];
            const showSourceBadge = hasMixedSources(orderItems);
            
            const itemsHtml = orderItems.map(item => {
                const identifier = item.Product?.identifier || '-';
                const index = item.Product?.index || '-';
                const productLabel = (index && index !== '-' && index !== identifier) ? `${identifier} (${index})` : identifier;
                const sourceBadge = getSourceBadge(item.source, showSourceBadge);
                const locationDisplay = item.locationName || '-';
                return `
                <tr class="border-b border-indigo-100 hover:bg-indigo-100 transition-colors">
                    <td class="p-3 text-sm font-medium text-gray-800">${productLabel}</td>
                    <td class="p-3 text-sm text-gray-700">${item.selectedProjects || '-'}</td>
                    <td class="p-3 text-sm text-center text-gray-700">${item.quantity}</td>
                    <td class="p-3 text-sm text-right text-gray-700">${(item.unitPrice || 0).toFixed(2)} zł</td>
                    <td class="p-3 text-sm text-right font-semibold text-gray-900">${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)} zł</td>
                    <td class="p-3 text-sm text-gray-700">${sourceBadge}${locationDisplay}</td>
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

            // Timeline HTML
            const timelineHtml = `
                <div class="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                    <div class="flex items-center gap-1">
                        <i class="fas fa-plus-circle text-green-500"></i>
                        <span>Utworzono: <strong class="text-gray-700">${createdDate}</strong></span>
                        ${fullOrder.User ? `<span class="text-gray-400">przez ${fullOrder.User.name || fullOrder.User.shortCode}</span>` : ''}
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
                                        <th class="p-2 text-left font-semibold text-gray-800">Produkt</th>
                                        <th class="p-2 text-left font-semibold text-gray-800">Projekty</th>
                                        <th class="p-2 text-center font-semibold text-gray-800">Ilość</th>
                                        <th class="p-2 text-right font-semibold text-gray-800">Cena j.</th>
                                        <th class="p-2 text-right font-semibold text-gray-800">Wartość</th>
                                        <th class="p-2 text-left font-semibold text-gray-800">Lokalizacja</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml || '<tr><td colspan="6" class="p-3 text-center text-gray-500">Brak pozycji</td></tr>'}
                                </tbody>
                            </table>
                        </div>

                        <!-- Notatki i Akcje -->
                        <div class="flex gap-3 items-end">
                            <!-- Notatki -->
                            <div class="flex-1">
                                ${canEditNotes ? `
                                    <textarea id="order-notes-${order.id}" class="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" rows="2" placeholder="Notatki...">${fullOrder.notes || ''}</textarea>
                                ` : `
                                    <div class="p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 max-h-16 overflow-y-auto">${fullOrder.notes || 'Brak notatek'}</div>
                                `}
                            </div>

                            <!-- Przyciski akcji -->
                            <div class="flex gap-2">
                                <button onclick="toggleOrderHistory('${fullOrder.id}')" class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors font-medium whitespace-nowrap flex items-center gap-1">
                                    <i id="history-icon-${fullOrder.id}" class="fas fa-history"></i> Historia
                                </button>
                                
                                ${canEditNotes ? `
                                    <button onclick="saveOrderNotes('${fullOrder.id}')" class="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors font-medium whitespace-nowrap">
                                        <i class="fas fa-save"></i> Zapisz
                                    </button>
                                ` : ''}
                                <button onclick="printOrder('${fullOrder.id}')" class="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors font-medium whitespace-nowrap">
                                    <i class="fas fa-print"></i> Drukuj
                                </button>
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
    async function saveOrderNotes(orderId) {
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
                showToast('Notatki zostały zapisane', 'success');
            } else {
                showToast(result.message || 'Nie udało się zapisać notatek', 'error');
            }
        } catch (error) {
            console.error('Błąd zapisu notatek:', error);
            showToast('Błąd połączenia z serwerem', 'error');
        }
    }

    // Obsługa zmiany statusu inline (select w tabeli)
    async function handleInlineStatusSelectChange(e) {
        const select = e.target;
        const orderId = select.dataset.orderId;
        const originalStatus = select.dataset.originalStatus;
        const newStatus = select.value;

        if (newStatus === originalStatus) {
            return;
        }

        select.disabled = true;

        try {
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
            });

            const result = await response.json();

            if (result.status === 'success') {
                // Aktualizuj dane lokalne
                const order = allOrders.find(o => o.id === orderId);
                if (order) {
                    order.status = newStatus;
                }
                // Aktualizuj wygląd selecta
                select.dataset.originalStatus = newStatus;
                applyStatusStyles(select, newStatus);
            } else {
                showToast(result.message || 'Nie udało się zmienić statusu', 'error');
                select.value = originalStatus;
            }
        } catch (error) {
            console.error('Błąd zmiany statusu:', error);
            showToast('Błąd połączenia z serwerem', 'error');
            select.value = originalStatus;
        } finally {
            select.disabled = false;
        }
    }

    // Edytuj status (placeholder - stara funkcja)
    function editOrderStatus(orderId) {
        showToast('Użyj listy w kolumnie Status', 'info');
    }

    // Print Preview
    async function printOrder(orderId) {
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Nie udało się pobrać szczegółów zamówienia');
            }

            const result = await response.json();
            const order = result.data;

            // Generuj HTML do wydruku
            const printOrderItems = order.OrderItem || [];
            const printShowSourceBadge = hasMixedSources(printOrderItems);
            
            const itemsHtml = printOrderItems.map(item => {
                const identifier = item.Product?.identifier || '-';
                const index = item.Product?.index || '-';
                const productLabel = (index && index !== '-' && index !== identifier) ? `${identifier} (${index})` : identifier;
                const sourcePrefix = printShowSourceBadge && item.source ? `[${SOURCE_LABELS[item.source] || item.source}] ` : '';
                const locationDisplay = item.locationName || '-';
                return `
                <tr>
                    <td>${productLabel}</td>
                    <td>${item.selectedProjects || '-'}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">${(item.unitPrice || 0).toFixed(2)} zł</td>
                    <td style="text-align: right;">${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)} zł</td>
                    <td>${sourcePrefix}${locationDisplay}</td>
                </tr>
                `;
            }).join('');

            const createdDate = new Date(order.createdAt).toLocaleString('pl-PL', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });

            const printHtml = `
                <div class="print-document">
                    <div class="print-header">
                        <div>
                            <div class="print-company">ZAMÓWIENIA</div>
                            <div class="print-title">Zamówienie ${order.orderNumber}</div>
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
                                <div class="print-field-value">${order.Customer?.name || '-'}</div>
                            </div>
                            <div class="print-field">
                                <div class="print-field-label">Handlowiec</div>
                                <div class="print-field-value">${order.User?.name || order.User?.shortCode || '-'}</div>
                            </div>
                        </div>
                    </div>

                    <div class="print-section">
                        <div class="print-section-title">Pozycje</div>
                        <table class="print-table">
                            <thead>
                                <tr>
                                    <th>Produkt</th>
                                    <th>Projekty</th>
                                    <th style="text-align: center;">Ilość</th>
                                    <th style="text-align: right;">Cena j.</th>
                                    <th style="text-align: right;">Wartość</th>
                                    <th>Lokalizacja</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml || '<tr><td colspan="6" style="text-align: center; color: #999;">Brak pozycji</td></tr>'}
                            </tbody>
                        </table>
                    </div>

                    <div class="print-total">
                        Razem: ${(order.total || 0).toFixed(2)} zł
                    </div>

                    ${order.notes ? `
                        <div class="print-section" style="margin-top: 8px;">
                            <div class="print-section-title">Notatki</div>
                            <div style="font-size: 10px; color: #374151; white-space: pre-wrap; line-height: 1.2;">${order.notes}</div>
                        </div>
                    ` : ''}

                    <div class="print-footer">
                        <div>Wydruk z systemu zarządzania zamówieniami | ${new Date().toLocaleString('pl-PL')}</div>
                    </div>
                </div>
            `;

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

            const itemsHtml = (fullOrder.OrderItem || []).map(item => `
                <tr class="border-b">
                    <td class="p-3">${item.Product?.identifier || item.Product?.name || '-'}</td>
                    <td class="p-3">${item.selectedProjects || '-'}</td>
                    <td class="p-3 text-center">${item.quantity}</td>
                    <td class="p-3 text-right">${(item.unitPrice || 0).toFixed(2)} zł</td>
                    <td class="p-3 text-right font-semibold">${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)} zł</td>
                    <td class="p-3">${item.locationName || '-'}</td>
                </tr>
            `).join('');

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
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml || '<tr><td colspan="6" class="p-4 text-center text-gray-500">Brak pozycji</td></tr>'}
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
                'APPROVED': ['IN_PRODUCTION', 'CANCELLED'],
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

    // Eksport funkcji na window dla onclick w HTML
    window.printOrder = printOrder;
    window.saveOrderNotes = saveOrderNotes;
    window.editOrderStatus = editOrderStatus;

    // Uruchomienie aplikacji
    init();
});

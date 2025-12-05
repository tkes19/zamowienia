document.addEventListener('DOMContentLoaded', () => {
    // Elementy DOM
    const clientsTableBody = document.getElementById('clients-table-body');
    const clientsSearchInput = document.getElementById('clients-search-input');
    const salesRepFilterSelect = document.getElementById('clients-salesrep-filter');
    const salesRepFilterContainer = document.getElementById('clients-salesrep-filter-container');
    const refreshClientsBtn = document.getElementById('refresh-clients-btn');
    const newClientBtn = document.getElementById('new-client-btn');
    const clientFormContainer = document.getElementById('client-form-container');
    const clientModalTitle = document.getElementById('client-modal-title');
    const clientForm = document.getElementById('client-form');
    const clientFormCancel = document.getElementById('client-form-cancel');
    const clientFormClose = document.getElementById('client-form-close');
    const clientFormError = document.getElementById('client-form-error');
    const clientsTableInfo = document.getElementById('clients-table-info');
    const logoutBtn = document.getElementById('logout-btn');
    const adminLink = document.getElementById('admin-link');
    const ordersLink = document.getElementById('orders-link');

    let allClients = [];
    let filteredClients = [];
    let currentEditingClientId = null;
    let currentUserRole = null;
    let allSalesReps = [];
    let currentSalesRepFilter = '';

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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

            // Pokaż link do panelu admina/ustawień w zależności od roli
            if (adminLink) {
                if (currentUserRole === 'ADMIN') {
                    adminLink.style.display = 'flex';
                    adminLink.innerHTML = '<i class="fas fa-cog"></i><span>Panel admina</span>';
                    adminLink.href = '/admin';
                } else if (currentUserRole === 'SALES_DEPT') {
                    adminLink.style.display = 'flex';
                    adminLink.innerHTML = '<i class="fas fa-cog"></i><span>Ustawienia</span>';
                    adminLink.href = '/admin';
                }
            }

            if (ordersLink && ['SALES_REP', 'SALES_DEPT', 'ADMIN'].includes(currentUserRole)) {
                ordersLink.style.display = 'flex';
            }

            // Pokaż sidebar dla SALES_DEPT
            const sidebar = document.getElementById('clients-sidebar');
            if (sidebar && currentUserRole === 'SALES_DEPT') {
                sidebar.classList.remove('hidden');
            }

            // Pokaż filtr po handlowcu tylko dla ADMIN i SALES_DEPT
            if (['ADMIN', 'SALES_DEPT'].includes(currentUserRole) && salesRepFilterContainer) {
                salesRepFilterContainer.classList.remove('hidden');
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
        if (!['ADMIN', 'SALES_DEPT'].includes(currentUserRole)) return;

        try {
            const response = await fetch('/api/admin/users?role=SALES_REP', {
                credentials: 'include',
            });

            if (response.ok) {
                const result = await response.json();
                allSalesReps = Array.isArray(result.data) ? result.data : [];
                populateSalesRepSelect();
            }
        } catch (error) {
            console.error('Błąd pobierania handlowców:', error);
        }
    }

    // Wypełnienie selecta handlowcami (modal)
    function populateSalesRepSelect() {
        const select = document.getElementById('client-form-salesrep');
        if (!select) return;

        const options = ['<option value="">--- Wybierz handlowca ---</option>'];
        allSalesReps.forEach(rep => {
            options.push(`<option value="${rep.id}">${escapeHtml(rep.name || '')}</option>`);
        });

        select.innerHTML = options.join('');

        // Uzupełnij także dropdown filtra po handlowcu
        if (salesRepFilterSelect) {
            const filterOptions = ['<option value="">Wszyscy handlowcy</option>', '<option value="__none">Bez przypisanego</option>'];
            allSalesReps.forEach(rep => {
                filterOptions.push(`<option value="${rep.id}">${escapeHtml(rep.name || '')}</option>`);
            });
            salesRepFilterSelect.innerHTML = filterOptions.join('');
        }
    }

    // Inicjalizacja
    async function init() {
        const isAuthorized = await checkAuth();
        if (!isAuthorized) return;

        loadSalesReps();
        await fetchClients();

        const params = new URLSearchParams(window.location.search || '');
        if (params.get('new') === '1') {
            openClientForm();
        }
    }

    // Event listenery
    refreshClientsBtn.addEventListener('click', fetchClients);
    newClientBtn.addEventListener('click', () => openClientForm());
    clientFormCancel.addEventListener('click', closeClientForm);
    clientFormClose.addEventListener('click', closeClientForm);
    clientForm.addEventListener('submit', handleClientFormSubmit);

    clientsSearchInput.addEventListener('input', (e) => {
        filterClients(e.target.value);
    });

    if (salesRepFilterSelect) {
        salesRepFilterSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            currentSalesRepFilter = value || '';
            filterClients(clientsSearchInput.value || '');
        });
    }

    clientsTableBody.addEventListener('click', handleTableClick);

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/';
        } catch (error) {
            console.error('Błąd wylogowania:', error);
            window.location.href = '/';
        }
    });

    // Pobieranie klientów
    async function fetchClients() {
        try {
            clientsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-gray-500">
                        <div class="flex flex-col items-center gap-2">
                            <i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
                            <span>Ładowanie klientów...</span>
                        </div>
                    </td>
                </tr>
            `;

            const response = await fetch('/api/clients', {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                allClients = result.data || [];
                filterClients(clientsSearchInput.value);
            } else {
                throw new Error(result.message || 'Nie udało się pobrać klientów');
            }
        } catch (error) {
            console.error('Błąd pobierania klientów:', error);
            clientsTableBody.innerHTML = `
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

    // Filtrowanie klientów
    function filterClients(searchTerm = '') {
        const term = (searchTerm || '').toLowerCase().trim();

        filteredClients = allClients.filter(client => {
            // Filtrowanie tekstowe
            const matchesText = !term ||
                (client.name && client.name.toLowerCase().includes(term)) ||
                (client.email && client.email.toLowerCase().includes(term)) ||
                (client.phone && client.phone.toLowerCase().includes(term)) ||
                (client.city && client.city.toLowerCase().includes(term));

            // Filtrowanie po handlowcu (tylko dla ADMIN / SALES_DEPT)
            let matchesSalesRep = true;
            if (['ADMIN', 'SALES_DEPT'].includes(currentUserRole)) {
                if (currentSalesRepFilter === '__none') {
                    matchesSalesRep = !client.salesRepId;
                } else if (currentSalesRepFilter) {
                    matchesSalesRep = client.salesRepId === currentSalesRepFilter;
                }
            }

            return matchesText && matchesSalesRep;
        });

        renderClientsTable();
    }

    // Renderowanie tabeli klientów
    function renderClientsTable() {
        if (filteredClients.length === 0) {
            clientsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-gray-500">
                        ${allClients.length === 0 ? 'Brak klientów do wyświetlenia' : 'Brak klientów spełniających kryteria wyszukiwania'}
                    </td>
                </tr>
            `;
            clientsTableInfo.textContent = `Pokazuje 0 z ${allClients.length} klientów`;
            return;
        }

        clientsTableBody.innerHTML = filteredClients.map(client => {
            const createdDate = client.createdAt ? new Date(client.createdAt).toLocaleDateString('pl-PL') : '-';
            
            const contactInfo = [
                client.email ? `<div><i class="fas fa-envelope text-gray-400 mr-1"></i>${escapeHtml(client.email)}</div>` : '',
                client.phone ? `<div><i class="fas fa-phone text-gray-400 mr-1"></i>${escapeHtml(client.phone)}</div>` : ''
            ].filter(Boolean).join('');

            const addressInfo = [
                client.address,
                client.city && client.zipCode ? `${client.zipCode} ${client.city}` : client.city || client.zipCode,
                client.country && client.country !== 'Poland' ? client.country : ''
            ].filter(Boolean).map(escapeHtml).join(', ');

            // Wyświetl nazwę handlowca (dla ADMIN i SALES_DEPT)
            const salesRepDisplay = ['ADMIN', 'SALES_DEPT'].includes(currentUserRole)
                ? (client.salesRepName ? `<span class="text-gray-900 font-medium">${escapeHtml(client.salesRepName)}</span>` : '<span class="text-gray-400">Brak przypisania</span>')
                : '';

            return `
                <tr class="hover:bg-gray-50 transition-colors" data-client-id="${client.id}">
                    <td class="p-4">
                        <div class="font-medium text-gray-900">${escapeHtml(client.name || '')}</div>
                    </td>
                    <td class="p-4">
                        <div class="space-y-1 text-sm text-gray-600">
                            ${contactInfo || '<span class="text-gray-400">Brak danych kontaktowych</span>'}
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="text-sm text-gray-600">
                            ${addressInfo || '<span class="text-gray-400">Brak adresu</span>'}
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="text-sm">
                            ${salesRepDisplay}
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="text-sm text-gray-600 max-w-xs truncate">
                            ${client.notes ? escapeHtml(client.notes) : '<span class="text-gray-400">Brak uwag</span>'}
                        </div>
                    </td>
                    <td class="p-4 text-center text-sm text-gray-600">
                        ${createdDate}
                    </td>
                    <td class="p-4 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <button class="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50 transition-colors" data-action="new-order" data-client-id="${client.id}" title="Nowe zamówienie">
                                <i class="fas fa-shopping-cart"></i>
                            </button>
                            <button class="text-green-600 hover:text-green-800 p-2 rounded hover:bg-green-50 transition-colors" data-action="edit-client" data-client-id="${client.id}" title="Edytuj klienta">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition-colors" data-action="delete-client" data-client-id="${client.id}" title="Usuń klienta">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        clientsTableInfo.textContent = `Pokazuje ${filteredClients.length} z ${allClients.length} klientów`;
    }

    // Obsługa kliknięć w tabeli
    function handleTableClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const clientId = target.dataset.clientId;
        const client = allClients.find(c => c.id === clientId);

        if (!client) return;

        switch (action) {
            case 'new-order':
                // Przekierowanie do formularza zamówień z wypełnionym klientem
                const clientData = encodeURIComponent(JSON.stringify({
                    id: client.id,
                    name: client.name,
                    email: client.email,
                    phone: client.phone,
                    address: client.address,
                    city: client.city,
                    zipCode: client.zipCode,
                    country: client.country
                }));
                window.location.href = `/?client=${clientData}`;
                break;
            case 'edit-client':
                openClientForm(client);
                break;
            case 'delete-client':
                handleDeleteClient(client);
                break;
        }
    }

    // Otwieranie formularza klienta
    function openClientForm(client = null) {
        currentEditingClientId = client ? client.id : null;
        clientFormError.classList.add('hidden');
        clientFormError.textContent = '';

        const salesRepSelect = document.getElementById('client-form-salesrep');
        const isAdminOrSalesDept = ['ADMIN', 'SALES_DEPT'].includes(currentUserRole);

        if (client) {
            // Edycja
            clientModalTitle.textContent = 'Edytuj klienta';
            clientForm.querySelector('[name="name"]').value = client.name || '';
            clientForm.querySelector('[name="email"]').value = client.email || '';
            clientForm.querySelector('[name="phone"]').value = client.phone || '';
            clientForm.querySelector('[name="address"]').value = client.address || '';
            clientForm.querySelector('[name="city"]').value = client.city || '';
            clientForm.querySelector('[name="zipCode"]').value = client.zipCode || '';
            clientForm.querySelector('[name="country"]').value = client.country || 'Poland';
            clientForm.querySelector('[name="notes"]').value = client.notes || '';
            
            // Ustaw przypisanie handlowca (dla ADMIN i SALES_DEPT)
            if (salesRepSelect && isAdminOrSalesDept) {
                salesRepSelect.value = client.salesRepId || '';
            }
            
            clientForm.querySelector('button[type="submit"] span').textContent = 'Zapisz zmiany';
        } else {
            // Nowy klient
            clientModalTitle.textContent = 'Dodaj nowego klienta';
            clientForm.reset();
            clientForm.querySelector('[name="country"]').value = 'Poland';
            
            // Dla nowego klienta, domyślnie przypisz do zalogowanego użytkownika (jeśli SALES_REP)
            if (salesRepSelect && currentUserRole === 'SALES_REP') {
                // Handlowiec nie widzi tego pola, więc nie ustawiamy
            }
            
            clientForm.querySelector('button[type="submit"] span').textContent = 'Zapisz klienta';
        }

        // Ukryj/pokaż pole przypisania w zależności od roli (tylko div z selectem, nie cały grid!)
        if (salesRepSelect) {
            salesRepSelect.closest('.md\\:col-span-2').style.display = isAdminOrSalesDept ? 'block' : 'none';
        }

        // Pokaż formularz
        clientFormContainer.classList.remove('hidden');
        // Przewiń do formularza
        clientFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Zamykanie formularza klienta
    function closeClientForm() {
        clientFormContainer.classList.add('hidden');
        clientForm.reset();
        currentEditingClientId = null;
        clientFormError.classList.add('hidden');
        clientFormError.textContent = '';
        clientModalTitle.textContent = 'Dodaj nowego klienta';
        clientForm.querySelector('button[type="submit"] span').textContent = 'Zapisz klienta';
    }

    // Obsługa zapisu klienta
    async function handleClientFormSubmit(e) {
        e.preventDefault();
        clientFormError.classList.add('hidden');
        clientFormError.textContent = '';

        const formData = new FormData(clientForm);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            address: formData.get('address'),
            city: formData.get('city'),
            zipCode: formData.get('zipCode'),
            country: formData.get('country'),
            notes: formData.get('notes'),
        };

        // Dodaj salesRepId dla ADMIN i SALES_DEPT
        if (['ADMIN', 'SALES_DEPT'].includes(currentUserRole)) {
            const salesRepId = formData.get('salesRepId');
            if (salesRepId) {
                data.salesRepId = salesRepId;
            }
        }

        // Walidacja
        if (!data.name || !data.name.trim()) {
            clientFormError.textContent = 'Nazwa klienta jest wymagana';
            clientFormError.classList.remove('hidden');
            return;
        }

        const submitBtn = clientForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Zapisuję...</span>';

        try {
            const url = currentEditingClientId
                ? `/api/clients/${currentEditingClientId}`
                : '/api/clients';

            const method = currentEditingClientId ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (result.status === 'success') {
                closeClientForm();
                await fetchClients();
            } else {
                clientFormError.textContent = result.message || 'Błąd podczas zapisu klienta';
                clientFormError.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Błąd podczas zapisu klienta:', error);
            clientFormError.textContent = 'Błąd połączenia z serwerem';
            clientFormError.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }

    // Usuwanie klienta
    async function handleDeleteClient(client) {
        if (!confirm(`Czy na pewno chcesz usunąć klienta "${client.name}"?\n\nTa operacja jest nieodwracalna.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/clients/${client.id}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            const result = await response.json();

            if (result.status === 'success') {
                fetchClients();
            } else {
                alert(result.message || 'Nie udało się usunąć klienta');
            }
        } catch (error) {
            console.error('Błąd podczas usuwania klienta:', error);
            alert('Błąd połączenia z serwerem podczas usuwania klienta');
        }
    }

    // Uruchomienie aplikacji
    init();
});

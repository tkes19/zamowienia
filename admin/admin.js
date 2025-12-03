document.addEventListener('DOMContentLoaded', () => {
    // Sprawdź uprawnienia użytkownika i dostosuj UI
    checkUserPermissionsAndAdaptUI();
    
    const tableBody = document.getElementById('products-table-body');
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const refreshBtn = document.getElementById('refresh-btn');
    const syncBtn = document.getElementById('sync-btn');
    const newProductBtn = document.getElementById('new-product-btn');
    const productModal = document.getElementById('product-modal');
    const productModalTitle = document.getElementById('product-modal-title');
    const productModalClose = document.getElementById('product-modal-close');
    const productForm = document.getElementById('product-form');
    const productFormCancel = document.getElementById('product-form-cancel');
    const inventoryModal = document.getElementById('inventory-modal');
    const inventoryModalTitle = document.getElementById('inventory-modal-title');
    const inventoryModalClose = document.getElementById('inventory-modal-close');
    const inventoryForm = document.getElementById('inventory-form');
    const inventoryFormCancel = document.getElementById('inventory-form-cancel');
    const productFormError = document.getElementById('product-form-error');
    const inventoryFormError = document.getElementById('inventory-form-error');
    const statsTotal = document.getElementById('stats-total');
    const statsLow = document.getElementById('stats-low');
    const statsOut = document.getElementById('stats-out');
    const statsValue = document.getElementById('stats-value');
    const tableInfo = document.getElementById('table-info');

    // Folder Access module elements
    const folderAccessModal = document.getElementById('folder-access-modal');
    const folderAccessModalTitle = document.getElementById('folder-access-modal-title');
    const folderAccessModalClose = document.getElementById('folder-access-modal-close');
    const folderAccessForm = document.getElementById('folder-access-form');
    const folderAccessSubmitBtn = document.querySelector('button[form="folder-access-form"][type="submit"]');
    const folderAccessTableBody = document.getElementById('folder-access-table-body');
    const folderAccessSearch = document.getElementById('folder-access-search');
    const folderAccessUserFilter = document.getElementById('folder-access-user-filter');
    const folderAccessStatusFilter = document.getElementById('folder-access-status-filter');
    const folderAccessUserSelect = document.getElementById('folder-access-user-select');
    const folderAccessActiveField = document.getElementById('folder-access-active-field');
    const folderSuggestions = document.getElementById('folder-suggestions');
    const newFolderAccessBtn = document.getElementById('new-folder-access-btn');
    const refreshFolderAccessBtn = document.getElementById('refresh-folder-access-btn');
    const folderAccessCancelBtn = document.getElementById('folder-access-cancel-btn');

    let allProducts = [];
    let filteredProducts = [];
    let currentEditingProductId = null;
    let currentInventoryProductId = null;

    // Konfiguracja
    const LOW_STOCK_THRESHOLD = 5;

    // Inicjalizacja
    fetchProducts();

    // Event listenery
    refreshBtn.addEventListener('click', fetchProducts);
    syncBtn.addEventListener('click', handleSync);
    newProductBtn.addEventListener('click', () => openProductForm());
    productModalClose.addEventListener('click', closeProductForm);
    productFormCancel.addEventListener('click', closeProductForm);
    productForm.addEventListener('submit', handleProductFormSubmit);
    inventoryModalClose.addEventListener('click', closeInventoryForm);
    inventoryFormCancel.addEventListener('click', closeInventoryForm);
    inventoryForm.addEventListener('submit', handleInventoryFormSubmit);

    tableBody.addEventListener('click', handleTableClick);

    searchInput.addEventListener('input', (e) => {
        filterProducts(e.target.value, categoryFilter.value);
    });

    categoryFilter.addEventListener('change', (e) => {
        filterProducts(searchInput.value, e.target.value);
    });

    async function handleSync() {
        if (!confirm('Czy na pewno chcesz pobrać produkty z zewnętrznego API? To może potrwać chwilę.')) return;

        const originalText = syncBtn.innerHTML;
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Synchronizacja...';
        syncBtn.classList.add('opacity-75', 'cursor-not-allowed');

        try {
            const response = await fetch('/api/admin/sync-from-external-api', { method: 'POST' });
            const result = await response.json();

            if (result.status === 'success') {
                alert(`Sukces! ${result.message}`);
                fetchProducts(); // Odśwież tabelę po sukcesie
            } else {
                alert(`Błąd: ${result.message}`);
            }
        } catch (error) {
            console.error('Sync error:', error);
            alert('Wystąpił błąd połączenia podczas synchronizacji.');
        } finally {
            syncBtn.disabled = false;
            syncBtn.innerHTML = originalText;
            syncBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    }

    async function fetchProducts() {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/products-with-stock');
            const result = await response.json();

            if (result.status === 'success') {
                allProducts = result.data;
                updateCategories(allProducts);
                filterProducts(searchInput.value, categoryFilter.value);
                updateStats(allProducts);
                
                // Toast notification (mock)
                console.log('Pobrano dane:', allProducts.length);
            } else {
                showError(result.message || 'Nie udało się pobrać danych');
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            showError('Błąd połączenia z serwerem');
        } finally {
            setLoading(false);
        }
    }

    function updateCategories(products) {
        const categories = [...new Set(products.map(p => p.category))].filter(Boolean).sort();
        const currentVal = categoryFilter.value;
        
        categoryFilter.innerHTML = '<option value="">Wszystkie kategorie</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = formatCategory(cat);
            categoryFilter.appendChild(option);
        });

        categoryFilter.value = currentVal;
    }

    function formatCategory(cat) {
        // Zamienia 'MAGNETY_I_BRELO' na 'Magnety I Brelo'
        return cat.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    function filterProducts(searchTerm, category) {
        const term = searchTerm.toLowerCase();
        
        filteredProducts = allProducts.filter(product => {
            const matchesSearch = 
                (product.name && product.name.toLowerCase().includes(term)) ||
                (product.index && product.index.toLowerCase().includes(term)) ||
                (product.identifier && product.identifier.toLowerCase().includes(term));
            
            const matchesCategory = category ? product.category === category : true;

            return matchesSearch && matchesCategory;
        });

        renderTable(filteredProducts);
        updateTableInfo(filteredProducts.length, allProducts.length);
    }

    function renderTable(products) {
        // Ukrywamy techniczne rekordy-nagłówki kategorii.
        // Założenie: nagłówek ma identifier == index (np. "akcesoria podróżne" w obu liniach),
        // cenę 0 i brak jakiegokolwiek stanu magazynowego.
        const visibleProducts = products.filter(product => {
            const price = typeof product.price === 'number' ? product.price : 0;
            const hasStock = (product.stock || 0) !== 0 || (product.stockReserved || 0) !== 0;
            const hasImage = !!(product.imageUrl || (product.images && product.images.length > 0));

            const ident = (product.identifier || '').toString().trim().toLowerCase();
            const idx = (product.index || '').toString().trim().toLowerCase();
            const identAndIndexSame = ident && idx && ident === idx;

            // nagłówek: identifier == index, cena 0, brak stanu i brak obrazka
            const isHeaderLike = identAndIndexSame && price === 0 && !hasStock && !hasImage;
            return !isHeaderLike;
        });

        if (visibleProducts.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="p-8 text-center text-gray-500">
                        Brak produktów spełniających kryteria.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = visibleProducts.map(product => {
            const available = (product.stock || 0) - (product.stockReserved || 0);
            const stockStatusClass = getStockStatusClass(available);
            const hasImage = product.imageUrl || (product.images && product.images.length > 0);
            const imageUrl = product.imageUrl || (product.images ? product.images[0] : null);
            const isNew = product.new ? '<span class="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider rounded border border-purple-200">Nowość</span>' : '';

            return `
                <tr class="hover:bg-gray-50 transition-colors" data-product-id="${product.id}">
                    <td class="p-4">
                        <div class="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200">
                            ${imageUrl 
                                ? `<img src="${imageUrl}" alt="" class="w-full h-full object-cover">` 
                                : `<i class="fas fa-image text-gray-300 text-xl"></i>`
                            }
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="font-medium text-gray-900 flex items-center flex-wrap gap-1">
                            ${product.identifier || product.name || '-'}
                            ${isNew}
                        </div>
                        <div class="text-xs text-gray-500 font-mono mt-0.5">${product.index || '-'}</div>
                    </td>
                    <td class="p-4">
                        <span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                            ${formatCategory(product.category || 'Inne')}
                        </span>
                    </td>
                    <td class="p-4 text-right font-mono">
                        ${typeof product.price === 'number' ? product.price.toFixed(2) : '0.00'} zł
                    </td>
                    <td class="p-4 text-center">
                        <div class="font-bold ${stockStatusClass}">${product.stock || 0}</div>
                    </td>
                    <td class="p-4 text-center text-gray-500">
                        ${product.stockReserved || 0}
                    </td>
                    <td class="p-4 text-center">
                        <span class="font-bold text-gray-800">${available}</span>
                    </td>
                    <td class="p-4 text-center">
                        ${product.isActive 
                            ? `<span class="w-3 h-3 rounded-full bg-green-500 inline-block" title="Aktywny"></span>` 
                            : `<span class="w-3 h-3 rounded-full bg-gray-300 inline-block" title="Nieaktywny"></span>`
                        }
                    </td>
                    <td class="p-4 text-right flex items-center justify-end gap-1">
                        <button class="inventory-edit-btn text-amber-600 hover:text-amber-800 p-2 rounded hover:bg-amber-50 transition-colors" title="Edytuj magazyn">
                            <i class="fas fa-warehouse"></i>
                        </button>
                        <button class="edit-product-btn text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50 transition-colors" title="Edytuj produkt">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-product-btn text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition-colors" title="Usuń">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function openProductForm(product = null) {
        currentEditingProductId = product ? product.id : null;
        productModalTitle.textContent = product ? 'Edytuj produkt' : 'Nowy produkt';

        const form = productForm;
        form.reset();

        const categorySelect = form.elements['category'];
        // Uzupełnij listę kategorii w formularzu na podstawie aktualnych danych
        const categories = [...new Set(allProducts.map(p => p.category))].filter(Boolean).sort();
        categorySelect.innerHTML = '<option value="">Wybierz kategorię</option>';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = formatCategory(cat);
            categorySelect.appendChild(opt);
        });

        if (product) {
            form.elements['identifier'].value = product.identifier || '';
            form.elements['index'].value = product.index || '';
            form.elements['name'].value = product.name || '';
            form.elements['price'].value = typeof product.price === 'number' ? product.price : '';
            form.elements['category'].value = product.category || '';
            form.elements['description'].value = product.description || '';
            form.elements['imageUrl'].value = product.imageUrl || '';
            form.elements['code'].value = product.code || '';
            form.elements['availability'].value = product.availability || '';
            form.elements['dimensions'].value = product.dimensions || '';
            form.elements['productionPath'].value = product.productionPath || '';
            form.elements['slug'].value = product.slug || '';
            form.elements['isActive'].checked = product.isActive !== false;
            form.elements['new'].checked = !!product.new;
        } else {
            form.elements['isActive'].checked = true;
            form.elements['new'].checked = false;
        }

        productModal.classList.remove('hidden');
    }

    function closeProductForm() {
        productModal.classList.add('hidden');
        currentEditingProductId = null;
    }

    async function handleProductFormSubmit(e) {
        e.preventDefault();

        const form = productForm;
        const formData = new FormData(form);
        if (productFormError) {
            productFormError.textContent = '';
            productFormError.classList.add('hidden');
        }

        const payload = {
            identifier: formData.get('identifier')?.toString().trim(),
            index: formData.get('index')?.toString().trim() || null,
            name: formData.get('name')?.toString().trim() || undefined,
            price: formData.get('price') ? Number(formData.get('price')) : 0,
            category: formData.get('category'),
            description: formData.get('description')?.toString().trim() || '',
            imageUrl: formData.get('imageUrl')?.toString().trim() || null,
            code: formData.get('code')?.toString().trim() || null,
            availability: formData.get('availability')?.toString().trim() || undefined,
            dimensions: formData.get('dimensions')?.toString().trim() || null,
            productionPath: formData.get('productionPath')?.toString().trim() || null,
            slug: formData.get('slug')?.toString().trim() || null,
            isActive: form.elements['isActive'].checked,
            new: form.elements['new'].checked,
        };

        if (!payload.identifier) {
            if (productFormError) {
                productFormError.textContent = 'Identyfikator jest wymagany.';
                productFormError.classList.remove('hidden');
            }
            return;
        }

        if (!payload.category) {
            if (productFormError) {
                productFormError.textContent = 'Wybierz kategorię produktu.';
                productFormError.classList.remove('hidden');
            }
            return;
        }

        if (Number.isNaN(payload.price) || payload.price < 0) {
            if (productFormError) {
                productFormError.textContent = 'Cena musi być liczbą nieujemną.';
                productFormError.classList.remove('hidden');
            }
            return;
        }

        const method = currentEditingProductId ? 'PATCH' : 'POST';
        const url = currentEditingProductId 
            ? `/api/admin/products/${encodeURIComponent(currentEditingProductId)}`
            : '/api/admin/products';

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : null;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Zapisuję...</span>';
        }

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.status === 'success') {
                closeProductForm();
                fetchProducts();
            } else {
                const message = result.message || (result.details ? `Błąd: ${result.details}` : 'Nie udało się zapisać produktu');
                if (productFormError) {
                    productFormError.textContent = message;
                    productFormError.classList.remove('hidden');
                } else {
                    alert(message);
                }
            }
        } catch (error) {
            console.error('Error saving product:', error);
            const message = 'Błąd połączenia podczas zapisu produktu.';
            if (productFormError) {
                productFormError.textContent = message;
                productFormError.classList.remove('hidden');
            } else {
                alert(message);
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
                submitBtn.innerHTML = originalBtnText;
            }
        }
    }

    function handleTableClick(e) {
        const inventoryBtn = e.target.closest('.inventory-edit-btn');
        const editBtn = e.target.closest('.edit-product-btn');
        const deleteBtn = e.target.closest('.delete-product-btn');
        const row = e.target.closest('tr[data-product-id]');

        if (!row) return;
        const productId = row.getAttribute('data-product-id');
        const product = allProducts.find(p => p.id === productId);

        if (inventoryBtn && product) {
            openInventoryForm(product);
        } else if (editBtn && product) {
            openProductForm(product);
        } else if (deleteBtn && product) {
            handleDeleteProduct(product);
        }
    }

    function openInventoryForm(product) {
        currentInventoryProductId = product.id;
        inventoryModalTitle.textContent = `Magazyn: ${product.identifier || product.name || ''}`;

        const form = inventoryForm;
        form.elements['stock'].value = product.stock || 0;
        form.elements['stockOptimal'].value = product.stockOptimal || 0;
        form.elements['stockOrdered'].value = product.stockOrdered || 0;
        form.elements['stockReserved'].value = product.stockReserved || 0;

        inventoryModal.classList.remove('hidden');
    }

    function closeInventoryForm() {
        inventoryModal.classList.add('hidden');
        currentInventoryProductId = null;
    }

    async function handleInventoryFormSubmit(e) {
        e.preventDefault();
        if (!currentInventoryProductId) return;

        const form = inventoryForm;
        const formData = new FormData(form);
        if (inventoryFormError) {
            inventoryFormError.textContent = '';
            inventoryFormError.classList.add('hidden');
        }
        const payload = {
            stock: Number(formData.get('stock') || 0),
            stockOptimal: Number(formData.get('stockOptimal') || 0),
            stockOrdered: Number(formData.get('stockOrdered') || 0),
            stockReserved: Number(formData.get('stockReserved') || 0),
        };

        const anyNegative = Object.values(payload).some(v => Number.isNaN(v) || v < 0);
        if (anyNegative) {
            if (inventoryFormError) {
                inventoryFormError.textContent = 'Wszystkie pola magazynowe muszą być liczbami nieujemnymi.';
                inventoryFormError.classList.remove('hidden');
            }
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : null;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Zapisuję...</span>';
        }

        try {
            const response = await fetch(`/api/admin/products/${encodeURIComponent(currentInventoryProductId)}/inventory`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.status === 'success') {
                closeInventoryForm();
                fetchProducts();
            } else {
                const message = result.message || (result.details ? `Błąd: ${result.details}` : 'Nie udało się zapisać stanów magazynowych');
                if (inventoryFormError) {
                    inventoryFormError.textContent = message;
                    inventoryFormError.classList.remove('hidden');
                } else {
                    alert(message);
                }
            }
        } catch (error) {
            console.error('Error saving inventory:', error);
            const message = 'Błąd połączenia podczas zapisu stanów magazynowych.';
            if (inventoryFormError) {
                inventoryFormError.textContent = message;
                inventoryFormError.classList.remove('hidden');
            } else {
                alert(message);
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
                submitBtn.innerHTML = originalBtnText;
            }
        }
    }

    async function handleDeleteProduct(product) {
        if (!confirm(`Czy na pewno chcesz usunąć produkt "${product.identifier || product.name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (result.status === 'success') {
                fetchProducts();
            } else {
                alert(result.message || 'Nie udało się usunąć produktu');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Błąd połączenia podczas usuwania produktu');
        }
    }

    function getStockStatusClass(stock) {
        if (stock <= 0) return 'text-red-600';
        if (stock <= LOW_STOCK_THRESHOLD) return 'text-amber-600';
        return 'text-green-600';
    }

    function updateStats(products) {
        const total = products.length;
        const outOfStock = products.filter(p => ((p.stock || 0) - (p.stockReserved || 0)) <= 0).length;
        const lowStock = products.filter(p => {
            const available = (p.stock || 0) - (p.stockReserved || 0);
            return available > 0 && available <= LOW_STOCK_THRESHOLD;
        }).length;

        // Obliczanie wartości (przybliżone, bo ceny mogą być różne)
        const totalValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);

        animateValue(statsTotal, parseInt(statsTotal.textContent), total, 500);
        animateValue(statsOut, parseInt(statsOut.textContent), outOfStock, 500);
        animateValue(statsLow, parseInt(statsLow.textContent), lowStock, 500);
        
        statsValue.textContent = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(totalValue);
    }

    function updateTableInfo(shown, total) {
        tableInfo.textContent = `Pokazuje ${shown} z ${total} produktów`;
    }

    function setLoading(isLoading) {
        const loader = `
            <tr>
                <td colspan="9" class="p-8 text-center text-gray-500">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
                        <span>Ładowanie danych...</span>
                    </div>
                </td>
            </tr>
        `;
        
        if (isLoading) {
            tableBody.innerHTML = loader;
            refreshBtn.disabled = true;
            refreshBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    function showError(message) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="p-8 text-center text-red-500">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fas fa-exclamation-circle text-2xl"></i>
                        <span>${message}</span>
                        <button onclick="location.reload()" class="mt-2 text-blue-600 underline text-sm">Spróbuj ponownie</button>
                    </div>
                </td>
            </tr>
        `;
    }

    function animateValue(obj, start, end, duration) {
        if (start === end) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // ========================================
    // ZARZĄDZANIE UŻYTKOWNIKAMI
    // ========================================

    const viewProducts = document.getElementById('view-products');
    const viewUsers = document.getElementById('view-users');
    const navUsers = document.querySelector('[data-view="users"]');
    const navProducts = document.querySelector('[data-view="products"]');

    const usersTableBody = document.getElementById('users-table-body');
    const usersSearchInput = document.getElementById('users-search-input');
    const usersRoleFilter = document.getElementById('users-role-filter');
    const usersDepartmentFilter = document.getElementById('users-department-filter');
    const refreshUsersBtn = document.getElementById('refresh-users-btn');
    const newUserBtn = document.getElementById('new-user-btn');
    const userModal = document.getElementById('user-modal');
    const userModalTitle = document.getElementById('user-modal-title');
    const userModalClose = document.getElementById('user-modal-close');
    const userForm = document.getElementById('user-form');
    const userFormCancel = document.getElementById('user-form-cancel');
    const userFormError = document.getElementById('user-form-error');
    const usersTableInfo = document.getElementById('users-table-info');

    let allUsers = [];
    let filteredUsers = [];
    let allDepartments = [];
    let currentEditingUserId = null;

    // Przełączanie widoków
    if (navUsers) {
        navUsers.addEventListener('click', (e) => {
            e.preventDefault();
            viewProducts.classList.add('hidden');
            viewUsers.classList.remove('hidden');
            navProducts.classList.remove('bg-blue-50', 'text-blue-600');
            navUsers.classList.add('bg-blue-50', 'text-blue-600');
            fetchDepartments();
            fetchUsers();
        });
    }

    if (navProducts) {
        navProducts.addEventListener('click', (e) => {
            e.preventDefault();
            viewUsers.classList.add('hidden');
            viewProducts.classList.remove('hidden');
            navUsers.classList.remove('bg-blue-50', 'text-blue-600');
            navProducts.classList.add('bg-blue-50', 'text-blue-600');
        });
    }

    // Event listenery dla użytkowników
    if (refreshUsersBtn) refreshUsersBtn.addEventListener('click', fetchUsers);
    if (newUserBtn) newUserBtn.addEventListener('click', () => openUserForm());
    if (userModalClose) userModalClose.addEventListener('click', closeUserForm);
    if (userFormCancel) userFormCancel.addEventListener('click', closeUserForm);
    if (userForm) userForm.addEventListener('submit', handleUserFormSubmit);

    if (usersSearchInput) {
        usersSearchInput.addEventListener('input', (e) => {
            filterUsers();
        });
    }

    if (usersRoleFilter) {
        usersRoleFilter.addEventListener('change', filterUsers);
    }

    if (usersDepartmentFilter) {
        usersDepartmentFilter.addEventListener('change', filterUsers);
    }

    if (usersTableBody) {
        usersTableBody.addEventListener('click', handleUsersTableClick);
    }

    // Pobieranie działów
    async function fetchDepartments() {
        try {
            const res = await fetch('/api/admin/departments', {
                credentials: 'include',
            });
            const json = await res.json();

            if (json.status === 'success') {
                allDepartments = json.data || [];
                populateDepartmentFilters();
            } else {
                console.error('Błąd pobierania działów:', json.message);
            }
        } catch (err) {
            console.error('Błąd podczas pobierania działów:', err);
        }
    }

    function populateDepartmentFilters() {
        // Filtr w tabeli
        if (usersDepartmentFilter) {
            usersDepartmentFilter.innerHTML = '<option value="">Wszystkie działy</option>';
            allDepartments.forEach(dept => {
                const opt = document.createElement('option');
                opt.value = dept.id;
                opt.textContent = dept.name;
                usersDepartmentFilter.appendChild(opt);
            });
        }

        // Select w formularzu
        const deptSelect = userForm.querySelector('select[name="departmentId"]');
        if (deptSelect) {
            const currentVal = deptSelect.value;
            deptSelect.innerHTML = '<option value="">Brak działu</option>';
            allDepartments.forEach(dept => {
                const opt = document.createElement('option');
                opt.value = dept.id;
                opt.textContent = dept.name;
                deptSelect.appendChild(opt);
            });
            if (currentVal) deptSelect.value = currentVal;
        }
    }

    // Pobieranie użytkowników
    async function fetchUsers() {
        try {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-gray-500">
                        <div class="flex flex-col items-center gap-2">
                            <i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
                            <span>Ładowanie danych...</span>
                        </div>
                    </td>
                </tr>
            `;

            const res = await fetch('/api/admin/users', {
                credentials: 'include',
            });
            const json = await res.json();

            if (json.status === 'success') {
                allUsers = json.data || [];
                filterUsers();
            } else {
                console.error('Błąd pobierania użytkowników:', json.message);
                usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="p-8 text-center text-red-600">
                            Błąd: ${json.message || 'Nie udało się pobrać użytkowników'}
                        </td>
                    </tr>
                `;
            }
        } catch (err) {
            console.error('Błąd podczas pobierania użytkowników:', err);
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-red-600">
                        Błąd połączenia z serwerem
                    </td>
                </tr>
            `;
        }
    }

    // Filtrowanie użytkowników
    function filterUsers() {
        const searchTerm = usersSearchInput ? usersSearchInput.value.toLowerCase() : '';
        const roleFilter = usersRoleFilter ? usersRoleFilter.value : '';
        const deptFilter = usersDepartmentFilter ? usersDepartmentFilter.value : '';

        filteredUsers = allUsers.filter(user => {
            const matchesSearch = !searchTerm ||
                (user.name && user.name.toLowerCase().includes(searchTerm)) ||
                (user.email && user.email.toLowerCase().includes(searchTerm));

            const matchesRole = !roleFilter || user.role === roleFilter;
            const matchesDept = !deptFilter || user.departmentId === deptFilter;

            return matchesSearch && matchesRole && matchesDept;
        });

        renderUsersTable();
    }

    // Renderowanie tabeli użytkowników
    function renderUsersTable() {
        if (!usersTableBody) return;

        if (filteredUsers.length === 0) {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-gray-500">
                        Brak użytkowników do wyświetlenia
                    </td>
                </tr>
            `;
            if (usersTableInfo) usersTableInfo.textContent = 'Pokazuje 0 z 0 użytkowników';
            return;
        }

        usersTableBody.innerHTML = filteredUsers.map(user => {
            const statusBadge = user.isActive
                ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Aktywny</span>'
                : '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Nieaktywny</span>';

            const roleLabel = formatRole(user.role);
            const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('pl-PL') : '-';

            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="p-4 font-medium text-gray-900">${user.name || '-'}</td>
                    <td class="p-4 text-gray-600">${user.email}</td>
                    <td class="p-4">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">${roleLabel}</span>
                    </td>
                    <td class="p-4 text-gray-600">${user.departmentName || '-'}</td>
                    <td class="p-4 text-center">${statusBadge}</td>
                    <td class="p-4 text-center text-gray-600">${createdDate}</td>
                    <td class="p-4 text-right flex items-center justify-end gap-2">
                        <button class="text-blue-600 hover:text-blue-800" data-action="edit-user" data-user-id="${user.id}" title="Edytuj użytkownika">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="text-red-600 hover:text-red-800" data-action="delete-user" data-user-id="${user.id}" title="Usuń użytkownika">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (usersTableInfo) {
            usersTableInfo.textContent = `Pokazuje ${filteredUsers.length} z ${allUsers.length} użytkowników`;
        }
    }

    // Formatowanie nazwy roli
    function formatRole(role) {
        const roleMap = {
            'ADMIN': 'Administrator',
            'SALES_REP': 'Handlowiec',
            'WAREHOUSE': 'Magazyn',
            'SALES_DEPT': 'Dział Sprzedaży',
            'PRODUCTION': 'Produkcja',
            'GRAPHICS': 'Graficy',
            'NEW_USER': 'Nowy Użytkownik',
        };
        return roleMap[role] || role;
    }

    // Obsługa kliknięć w tabeli użytkowników
    function handleUsersTableClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const userId = target.dataset.userId;

        if (action === 'edit-user') {
            const user = allUsers.find(u => u.id === userId);
            if (user) openUserForm(user);
        } else if (action === 'delete-user') {
            const user = allUsers.find(u => u.id === userId);
            if (user) handleDeleteUser(user);
        }
    }

    // Usuwanie użytkownika
    async function handleDeleteUser(user) {
        if (!confirm(`Czy na pewno chcesz usunąć użytkownika "${user.name || user.email}"?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            const json = await res.json();

            if (json.status === 'success') {
                fetchUsers();
            } else {
                alert(json.message || 'Nie udało się usunąć użytkownika');
            }
        } catch (err) {
            console.error('Błąd podczas usuwania użytkownika:', err);
            alert('Błąd połączenia z serwerem podczas usuwania użytkownika');
        }
    }

    // Otwieranie formularza użytkownika
    function openUserForm(user = null) {
        currentEditingUserId = user ? user.id : null;
        userFormError.classList.add('hidden');
        userFormError.textContent = '';

        if (user) {
            // Edycja
            userModalTitle.textContent = 'Edytuj użytkownika';
            userForm.querySelector('[name="name"]').value = user.name || '';
            userForm.querySelector('[name="email"]').value = user.email || '';
            userForm.querySelector('[name="email"]').disabled = true; // Email nie edytowalny
            userForm.querySelector('[name="role"]').value = user.role || '';
            userForm.querySelector('[name="departmentId"]').value = user.departmentId || '';
            userForm.querySelector('[name="isActive"]').checked = user.isActive !== false;

            // Ukryj pole hasła przy edycji
            const passwordField = document.getElementById('user-password-field');
            if (passwordField) passwordField.style.display = 'none';
            const resetPasswordField = document.getElementById('user-password-reset-field');
            if (resetPasswordField) resetPasswordField.style.display = 'block';
            userForm.querySelector('[name="password"]').removeAttribute('required');
            const newPasswordInput = userForm.querySelector('[name="newPassword"]');
            if (newPasswordInput) newPasswordInput.value = '';

            userForm.querySelector('button[type="submit"] span').textContent = 'Zapisz zmiany';
        } else {
            // Nowy użytkownik
            userModalTitle.textContent = 'Dodaj nowego użytkownika';
            userForm.reset();
            userForm.querySelector('[name="email"]').disabled = false;
            userForm.querySelector('[name="isActive"]').checked = true;

            // Pokaż pole hasła
            const passwordField = document.getElementById('user-password-field');
            if (passwordField) passwordField.style.display = 'block';
            const resetPasswordField = document.getElementById('user-password-reset-field');
            if (resetPasswordField) resetPasswordField.style.display = 'none';
            userForm.querySelector('[name="password"]').setAttribute('required', 'required');
            const newPasswordInput = userForm.querySelector('[name="newPassword"]');
            if (newPasswordInput) newPasswordInput.value = '';

            userForm.querySelector('button[type="submit"] span').textContent = 'Utwórz użytkownika';
        }

        populateDepartmentFilters();
        userModal.classList.remove('hidden');
    }

    // Zamykanie formularza użytkownika
    function closeUserForm() {
        userModal.classList.add('hidden');
        userForm.reset();
        currentEditingUserId = null;
        userFormError.classList.add('hidden');
        userFormError.textContent = '';
    }

    // Obsługa zapisu użytkownika
    async function handleUserFormSubmit(e) {
        e.preventDefault();
        userFormError.classList.add('hidden');
        userFormError.textContent = '';

        const formData = new FormData(userForm);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            role: formData.get('role'),
            departmentId: formData.get('departmentId') || null,
            isActive: formData.get('isActive') === 'on',
        };

        if (!currentEditingUserId) {
            // Nowy użytkownik - wymagane hasło
            const password = formData.get('password');
            if (!password || password.length < 6) {
                userFormError.textContent = 'Hasło musi mieć co najmniej 6 znaków';
                userFormError.classList.remove('hidden');
                return;
            }
            data.password = password;
        } else {
            // Edycja - opcjonalne nowe hasło
            const newPassword = formData.get('newPassword');
            if (newPassword && newPassword.length > 0) {
                if (newPassword.length < 6) {
                    userFormError.textContent = 'Nowe hasło musi mieć co najmniej 6 znaków';
                    userFormError.classList.remove('hidden');
                    return;
                }
                data.password = newPassword;
            }
        }

        try {
            const url = currentEditingUserId
                ? `/api/admin/users/${currentEditingUserId}`
                : '/api/admin/users';

            const method = currentEditingUserId ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });

            const json = await res.json();

            if (json.status === 'success') {
                closeUserForm();
                fetchUsers();
            } else {
                userFormError.textContent = json.message || 'Błąd podczas zapisu użytkownika';
                userFormError.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Błąd podczas zapisu użytkownika:', err);
            userFormError.textContent = 'Błąd połączenia z serwerem';
            userFormError.classList.remove('hidden');
        }
    }

    // Populacja filtra ról
    if (usersRoleFilter) {
        const roles = [
            { value: 'ADMIN', label: 'Administrator' },
            { value: 'SALES_REP', label: 'Handlowiec' },
            { value: 'WAREHOUSE', label: 'Magazyn' },
            { value: 'SALES_DEPT', label: 'Dział Sprzedaży' },
            { value: 'PRODUCTION', label: 'Produkcja' },
            { value: 'GRAPHICS', label: 'Graficy' },
            { value: 'NEW_USER', label: 'Nowy Użytkownik' },
        ];

        roles.forEach(role => {
            const opt = document.createElement('option');
            opt.value = role.value;
            opt.textContent = role.label;
            usersRoleFilter.appendChild(opt);
        });
    }

    // ============================================
    // WIDOK ZAMÓWIENIA - PEŁNA IMPLEMENTACJA
    // ============================================
    const ordersTableBody = document.getElementById('orders-table-body');
    const ordersTableHead = document.getElementById('orders-table-head');
    const ordersTableInfo = document.getElementById('orders-table-info');
    const ordersStatusFilter = document.getElementById('orders-status-filter');
    const ordersUserFilter = document.getElementById('orders-user-filter');
    const ordersSearchInput = document.getElementById('orders-search-input');
    const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
    const exportOrdersCsvBtn = document.getElementById('export-orders-csv-btn');
    const adminPrintPreviewModal = document.getElementById('admin-print-preview-modal');
    const adminPrintPreviewContent = document.getElementById('admin-print-preview-content');
    const adminPrintPreviewPrint = document.getElementById('admin-print-preview-print');
    const adminPrintPreviewClose = document.getElementById('admin-print-preview-close');
    const deleteOrderModal = document.getElementById('delete-order-modal');
    const deleteOrderNumber = document.getElementById('delete-order-number');
    const deleteOrderCancel = document.getElementById('delete-order-cancel');
    const deleteOrderConfirm = document.getElementById('delete-order-confirm');
    const editOrderModal = document.getElementById('edit-order-modal');
    const editOrderNumber = document.getElementById('edit-order-number');
    const editOrderClose = document.getElementById('edit-order-close');
    const editOrderContent = document.getElementById('edit-order-content');
    const adminToastContainer = document.getElementById('admin-toast-container');

    let allAdminOrders = [];
    let currentUserRole = null;
    const loadingOrders = new Set();
    let currentSort = { column: 'createdAt', direction: 'desc' };
    let deleteOrderId = null;

    const STATUS_LABELS = {
        PENDING: 'Oczekujące', APPROVED: 'Zatwierdzone', IN_PRODUCTION: 'W produkcji',
        READY: 'Gotowe', SHIPPED: 'Wysłane', DELIVERED: 'Dostarczone', CANCELLED: 'Anulowane'
    };

    const STATUS_CLASSES = {
        PENDING: 'bg-yellow-100 text-yellow-800', APPROVED: 'bg-blue-100 text-blue-800',
        IN_PRODUCTION: 'bg-orange-100 text-orange-800', READY: 'bg-green-100 text-green-800',
        SHIPPED: 'bg-purple-100 text-purple-800', DELIVERED: 'bg-gray-100 text-gray-800',
        CANCELLED: 'bg-red-100 text-red-800'
    };

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

    const ROLE_STATUS_TRANSITIONS = {
        SALES_REP: [{ from: 'PENDING', to: 'CANCELLED' }],
        SALES_DEPT: [
            { from: 'PENDING', to: 'APPROVED' }, { from: 'APPROVED', to: 'IN_PRODUCTION' },
            { from: 'APPROVED', to: 'CANCELLED' }, { from: 'IN_PRODUCTION', to: 'CANCELLED' },
            { from: 'READY', to: 'CANCELLED' }, { from: 'SHIPPED', to: 'DELIVERED' }
        ],
        PRODUCTION: [{ from: 'APPROVED', to: 'IN_PRODUCTION' }, { from: 'IN_PRODUCTION', to: 'READY' }],
        WAREHOUSE: [{ from: 'READY', to: 'SHIPPED' }],
        ADMIN: 'ALL'
    };

    // Debounce helper
    function debounce(fn, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Toast notifications
    function showAdminToast(message, type = 'info', duration = 3000) {
        if (!adminToastContainer) return;
        const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
        const toast = document.createElement('div');
        toast.className = `admin-toast ${type}`;
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
        adminToastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease-out forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Get current user role from cookie
    function getCurrentUserRole() {
        const match = document.cookie.match(/auth_role=([^;]+)/);
        return match ? match[1] : null;
    }

    function getAllowedStatusTransitions(currentStatus, role) {
        if (!role) return [];
        const transitions = ROLE_STATUS_TRANSITIONS[role];
        if (transitions === 'ALL') {
            return Object.keys(STATUS_LABELS).filter(s => s !== currentStatus);
        }
        if (Array.isArray(transitions)) {
            return transitions.filter(t => t.from === currentStatus).map(t => t.to);
        }
        return [];
    }

    // Synchronizuj rolę użytkownika
    async function syncUserRole() {
        try {
            const response = await fetch('/api/auth/sync-role', {
                method: 'POST',
                credentials: 'include'
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Role synced:', result.data.role);
                return result.data.role;
            }
        } catch (error) {
            console.error('Error syncing role:', error);
        }
        return getCurrentUserRole();
    }

    // Załaduj zamówienia
    async function loadOrders() {
        if (!ordersTableBody) return;
        
        // Najpierw synchronizuj rolę
        currentUserRole = await syncUserRole();
        console.log('DEBUG: User role after sync:', currentUserRole);

        try {
            ordersTableBody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i> Ładowanie…</td></tr>';

            const params = new URLSearchParams();
            if (ordersStatusFilter?.value) params.append('status', ordersStatusFilter.value);
            if (ordersUserFilter?.value) params.append('userId', ordersUserFilter.value);

            const url = `/api/admin/orders?${params.toString()}`;
            const response = await fetch(url, { credentials: 'include' });

            if (!response.ok) {
                ordersTableBody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-red-500">Błąd ładowania zamówień</td></tr>';
                return;
            }

            const result = await response.json();
            allAdminOrders = result.data || [];

            sortOrders();
            renderOrdersTable();
            loadOrdersUsers();
        } catch (error) {
            console.error('Błąd pobierania zamówień:', error);
            ordersTableBody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-red-500">Błąd połączenia</td></tr>';
        }
    }

    const debouncedLoadOrders = debounce(loadOrders, 300);

    // Załaduj listę handlowców do filtra
    async function loadOrdersUsers() {
        if (!ordersUserFilter) return;
        try {
            const response = await fetch('/api/users', { credentials: 'include' });
            if (!response.ok) return;
            const result = await response.json();
            const users = result.data || [];
            ordersUserFilter.innerHTML = '<option value="">Wszyscy handlowcy</option>' +
                users.map(u => `<option value="${u.id}">${u.shortCode} - ${u.name}</option>`).join('');
        } catch (error) {
            console.error('Błąd pobierania handlowców:', error);
        }
    }

    // Sortowanie zamówień
    function sortOrders() {
        const { column, direction } = currentSort;
        const multiplier = direction === 'asc' ? 1 : -1;

        allAdminOrders.sort((a, b) => {
            let valA, valB;
            switch (column) {
                case 'orderNumber':
                    const extractNumber = (str) => { const match = str.match(/\/(\d+)\//); return match ? parseInt(match[1], 10) : 0; };
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

    function handleSortClick(e) {
        const header = e.target.closest('.sortable-header');
        if (!header) return;
        const column = header.dataset.sort;
        if (!column) return;

        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }

        sortOrders();
        renderOrdersTable();
        updateSortIcons();
    }

    function updateSortIcons() {
        if (!ordersTableHead) return;
        ordersTableHead.querySelectorAll('.sortable-header').forEach(header => {
            const icon = header.querySelector('.sort-icon');
            if (!icon) return;
            const column = header.dataset.sort;
            icon.classList.remove('fa-sort', 'fa-sort-up', 'fa-sort-down', 'active');
            if (column === currentSort.column) {
                icon.classList.add(currentSort.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down', 'active');
            } else {
                icon.classList.add('fa-sort');
            }
        });
    }

    // Renderuj tabelę zamówień
    function renderOrdersTable() {
        if (!ordersTableBody) return;

        // Filtrowanie po wyszukiwaniu
        let filteredOrders = allAdminOrders;
        const searchTerm = ordersSearchInput?.value?.toLowerCase() || '';
        if (searchTerm) {
            filteredOrders = allAdminOrders.filter(order =>
                (order.orderNumber || '').toLowerCase().includes(searchTerm) ||
                (order.Customer?.name || '').toLowerCase().includes(searchTerm)
            );
        }

        if (filteredOrders.length === 0) {
            ordersTableBody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-gray-500">Brak zamówień</td></tr>';
            if (ordersTableInfo) ordersTableInfo.textContent = 'Pokazuje 0 z 0 zamówień';
            return;
        }

        ordersTableBody.innerHTML = filteredOrders.map(order => {
            const date = new Date(order.createdAt).toLocaleDateString('pl-PL', {
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            });

            const canChangeStatus = ['ADMIN', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION', 'SALES_REP'].includes(currentUserRole);
            const allowedTransitions = canChangeStatus ? getAllowedStatusTransitions(order.status, currentUserRole) : [];
            const canSelectStatus = allowedTransitions.length > 0;
            const statusClass = STATUS_CLASSES[order.status] || 'bg-gray-100 text-gray-800';
            const statusLabel = STATUS_LABELS[order.status] || order.status;

            const statusContent = canSelectStatus
                ? `<select class="order-status-select px-3 py-1 rounded-full text-xs font-semibold border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ${statusClass}" data-order-id="${order.id}" data-original-status="${order.status}" onclick="event.stopPropagation()">
                        ${[order.status, ...allowedTransitions].filter((s, i, arr) => arr.indexOf(s) === i).map(s => `<option value="${s}" ${s === order.status ? 'selected' : ''}>${STATUS_LABELS[s] || s}</option>`).join('')}
                   </select>`
                : `<span class="px-3 py-1 rounded-full text-xs font-medium ${statusClass}">${statusLabel}</span>`;

            const canDelete = currentUserRole === 'ADMIN';
            const deleteBtn = canDelete
                ? `<button class="text-red-600 hover:text-red-800 p-1" data-action="delete" data-order-id="${order.id}" data-order-number="${order.orderNumber}" title="Usuń zamówienie"><i class="fas fa-trash"></i></button>`
                : '';

            const canEdit = currentUserRole === 'ADMIN';
            const editBtn = canEdit
                ? `<button class="text-green-600 hover:text-green-800 p-1" data-action="edit" data-order-id="${order.id}" title="Edytuj zamówienie"><i class="fas fa-edit"></i></button>`
                : '';

            return `
                <tr class="hover:bg-gray-50 cursor-pointer order-row" data-order-id="${order.id}">
                    <td class="p-4 w-8"><i class="fas fa-chevron-right chevron-icon text-gray-400" data-order-id="${order.id}"></i></td>
                    <td class="p-4 font-semibold text-blue-600">${order.orderNumber}</td>
                    <td class="p-4">${date}</td>
                    <td class="p-4">${order.Customer?.name || '-'}</td>
                    <td class="p-4">${order.User?.shortCode || '-'}</td>
                    <td class="p-4">${statusContent}</td>
                    <td class="p-4 text-right font-semibold">${(order.total || 0).toFixed(2)} zł</td>
                    <td class="p-4 text-right">
                        ${editBtn}
                        <button class="text-purple-600 hover:text-purple-800 p-1" onclick="window.adminPrintOrder('${order.id}')" title="Drukuj"><i class="fas fa-print"></i></button>
                        ${deleteBtn}
                    </td>
                </tr>
            `;
        }).join('');

        if (ordersTableInfo) ordersTableInfo.textContent = `Pokazuje ${filteredOrders.length} z ${allAdminOrders.length} zamówień`;

        // Attach status change listeners
        ordersTableBody.querySelectorAll('.order-status-select').forEach(select => {
            select.addEventListener('change', handleInlineStatusChange);
        });
    }

    // Handle order row click for inline details
    async function handleOrderRowClick(e) {
        const row = e.target.closest('.order-row');
        if (!row) return;

        // Ignore clicks on buttons, selects
        if (e.target.closest('button') || e.target.closest('select')) return;

        const orderId = row.dataset.orderId;
        const existingDetails = document.getElementById(`details-${orderId}`);

        if (existingDetails) {
            existingDetails.remove();
            rotateChevron(orderId, false);
            return;
        }

        if (loadingOrders.has(orderId)) return;
        loadingOrders.add(orderId);

        try {
            const response = await fetch(`/api/orders/${orderId}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Nie udało się pobrać szczegółów');

            const result = await response.json();
            const fullOrder = result.data;

            const detailsRow = document.createElement('tr');
            detailsRow.id = `details-${orderId}`;
            detailsRow.className = 'bg-indigo-50 border-t-2 border-indigo-200 details-row';

            const orderItems = fullOrder.items || fullOrder.OrderItem || [];
            const showSourceBadge = true; // zawsze pokazuj źródło (PM/KI)
            
            const itemsHtml = orderItems.map(item => {
                const identifier = item.Product?.identifier || '-';
                const index = item.Product?.index || '-';
                const productLabel = (index && index !== '-' && index !== identifier) ? `${identifier} (${index})` : identifier;
                const sourceBadge = getSourceBadge(item.source, showSourceBadge);
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
                
                return `
                <tr class="border-b border-indigo-100 hover:bg-indigo-100 transition-colors">
                    <td class="p-2 text-xs font-medium text-gray-800">${productLabel}</td>
                    <td class="p-2 text-xs text-gray-700">${projectsDisplay}</td>
                    <td class="p-2 text-xs text-center text-gray-700">${item.quantity}</td>
                    <td class="p-2 text-xs text-right text-gray-700">${(item.unitPrice || 0).toFixed(2)} zł</td>
                    <td class="p-2 text-xs text-right font-semibold text-gray-900">${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)} zł</td>
                    <td class="p-2 text-xs text-gray-700">${sourceBadge}${locationDisplay}</td>
                    <td class="p-2 text-xs text-gray-600 italic">${notesDisplay}</td>
                </tr>`;
            }).join('');

            const canEditNotes = ['ADMIN', 'SALES_DEPT'].includes(currentUserRole);
            const createdDate = new Date(fullOrder.createdAt).toLocaleString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            const updatedDate = fullOrder.updatedAt ? new Date(fullOrder.updatedAt).toLocaleString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

            const timelineHtml = `
                <div class="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                    <div class="flex items-center gap-1"><i class="fas fa-plus-circle text-green-500"></i><span>Utworzono: <strong class="text-gray-700">${createdDate}</strong></span>${fullOrder.User ? `<span class="text-gray-400">przez ${fullOrder.User.name || fullOrder.User.shortCode}</span>` : ''}</div>
                    ${updatedDate && updatedDate !== createdDate ? `<div class="flex items-center gap-1"><i class="fas fa-edit text-blue-500"></i><span>Aktualizacja: <strong class="text-gray-700">${updatedDate}</strong></span></div>` : ''}
                    <div class="flex items-center gap-1"><i class="fas fa-tag text-gray-500"></i><span>Status: <strong class="text-gray-700">${STATUS_LABELS[fullOrder.status] || fullOrder.status}</strong></span></div>
                </div>`;

            detailsRow.innerHTML = `
                <td colspan="8" class="p-0">
                    <div class="p-4 space-y-3">
                        ${timelineHtml}
                        <div class="border border-indigo-200 rounded-lg overflow-hidden bg-white">
                            <table class="w-full text-xs">
                                <thead class="bg-indigo-100 border-b border-indigo-200">
                                    <tr>
                                        <th class="p-2 text-left font-semibold text-gray-800 text-xs">Produkt</th>
                                        <th class="p-2 text-left font-semibold text-gray-800 text-xs">Projekty</th>
                                        <th class="p-2 text-center font-semibold text-gray-800 text-xs">Ilość</th>
                                        <th class="p-2 text-right font-semibold text-gray-800 text-xs">Cena j.</th>
                                        <th class="p-2 text-right font-semibold text-gray-800 text-xs">Wartość</th>
                                        <th class="p-2 text-left font-semibold text-gray-800 text-xs">Lokalizacja</th>
                                        <th class="p-2 text-left font-semibold text-gray-800 text-xs">Uwagi</th>
                                    </tr>
                                </thead>
                                <tbody>${itemsHtml || '<tr><td colspan="7" class="p-3 text-center text-gray-500">Brak pozycji</td></tr>'}</tbody>
                            </table>
                        </div>
                        <div class="flex gap-3 items-end">
                            <div class="flex-1">
                                ${canEditNotes ? `<textarea id="order-notes-${orderId}" class="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" rows="2" placeholder="Notatki...">${fullOrder.notes || ''}</textarea>` : `<div class="p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 max-h-16 overflow-y-auto">${fullOrder.notes || 'Brak notatek'}</div>`}
                            </div>
                            <div class="flex gap-2">
                                <button onclick="window.adminToggleOrderHistory('${fullOrder.id}')" class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors font-medium whitespace-nowrap flex items-center gap-1">
                                    <i id="admin-history-icon-${fullOrder.id}" class="fas fa-history"></i> Historia
                                </button>
                                ${canEditNotes ? `<button onclick="window.adminSaveOrderNotes('${fullOrder.id}')" class="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors font-medium whitespace-nowrap"><i class="fas fa-save"></i> Zapisz</button>` : ''}
                                <button onclick="window.adminPrintOrder('${fullOrder.id}')" class="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors font-medium whitespace-nowrap"><i class="fas fa-print"></i> Drukuj</button>
                            </div>
                        </div>
                        
                        <!-- Kontener historii (domyślnie ukryty) -->
                        <div id="admin-history-container-${orderId}" class="hidden mt-3 transition-all duration-300 ease-in-out"></div>
                    </div>
                </td>`;

            row.insertAdjacentElement('afterend', detailsRow);
            rotateChevron(orderId, true);
        } catch (error) {
            console.error('Błąd pobierania szczegółów:', error);
            showAdminToast('Nie udało się pobrać szczegółów zamówienia', 'error');
        } finally {
            loadingOrders.delete(orderId);
        }
    }

    function rotateChevron(orderId, open) {
        const chevron = document.querySelector(`.chevron-icon[data-order-id="${orderId}"]`);
        if (chevron) {
            if (open) chevron.classList.add('rotated');
            else chevron.classList.remove('rotated');
        }
    }

    // Handle inline status change
    async function handleInlineStatusChange(e) {
        const select = e.target;
        const orderId = select.dataset.orderId;
        const originalStatus = select.dataset.originalStatus;
        const newStatus = select.value;

        if (newStatus === originalStatus) return;
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
                const order = allAdminOrders.find(o => o.id === orderId);
                if (order) order.status = newStatus;
                select.dataset.originalStatus = newStatus;
                // Update select styling
                Object.values(STATUS_CLASSES).forEach(cls => cls.split(' ').forEach(c => select.classList.remove(c)));
                (STATUS_CLASSES[newStatus] || 'bg-gray-100 text-gray-800').split(' ').forEach(c => select.classList.add(c));
                showAdminToast('Status zamówienia został zaktualizowany', 'success');
            } else {
                showAdminToast(result.message || 'Nie udało się zmienić statusu', 'error');
                select.value = originalStatus;
            }
        } catch (error) {
            console.error('Błąd zmiany statusu:', error);
            showAdminToast('Błąd połączenia z serwerem', 'error');
            select.value = originalStatus;
        } finally {
            select.disabled = false;
        }
    }

    // Save order notes
    window.adminSaveOrderNotes = async function(orderId) {
        const textarea = document.getElementById(`order-notes-${orderId}`);
        if (!textarea) return;

        const notes = textarea.value;
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ notes })
            });

            const result = await response.json();
            if (result.status === 'success') {
                showAdminToast('Notatki zostały zapisane', 'success');
            } else {
                showAdminToast(result.message || 'Nie udało się zapisać notatek', 'error');
            }
        } catch (error) {
            console.error('Błąd zapisu notatek:', error);
            showAdminToast('Błąd połączenia z serwerem', 'error');
        }
    };

    // Print order
    window.adminPrintOrder = async function(orderId) {
        try {
            const response = await fetch(`/api/orders/${orderId}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Nie udało się pobrać szczegółów zamówienia');

            const result = await response.json();
            const order = result.data;

            const printOrderItems = order.items || order.OrderItem || [];
            const printShowSourceBadge = true; // zawsze pokazuj źródło (PM/KI) na wydruku
            
            const itemsHtml = printOrderItems.map(item => {
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
                
                return `<tr><td style="font-size:8px;">${productLabel}</td><td style="font-size:8px;">${projectsDisplay}</td><td style="text-align:center;font-size:8px;">${item.quantity}</td><td style="text-align:right;font-size:8px;">${(item.unitPrice || 0).toFixed(2)} zł</td><td style="text-align:right;font-size:8px;">${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)} zł</td><td style="font-size:8px;">${sourcePrefix}${locationDisplay}</td><td style="font-size:7px;font-style:italic;color:#666;">${notesDisplay}</td></tr>`;
            }).join('');

            const createdDate = new Date(order.createdAt).toLocaleString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

            const printHtml = `
                <div class="print-document">
                    <div class="print-header">
                        <div><div class="print-company">ZAMÓWIENIA</div><div class="print-title">Zamówienie ${order.orderNumber}</div></div>
                        <div class="print-meta"><div>Data: ${createdDate}</div><div>Status: ${STATUS_LABELS[order.status] || order.status}</div></div>
                    </div>
                    <div class="print-section">
                        <div class="print-grid">
                            <div class="print-field"><div class="print-field-label">Klient</div><div class="print-field-value">${order.Customer?.name || '-'}</div></div>
                            <div class="print-field"><div class="print-field-label">Handlowiec</div><div class="print-field-value">${order.User?.name || order.User?.shortCode || '-'}</div></div>
                        </div>
                    </div>
                    <div class="print-section">
                        <div class="print-section-title">Pozycje</div>
                        <table class="print-table"><thead><tr><th style="font-size:8px;">Produkt</th><th style="font-size:8px;">Projekty</th><th style="text-align:center;font-size:8px;">Ilość</th><th style="text-align:right;font-size:8px;">Cena j.</th><th style="text-align:right;font-size:8px;">Wartość</th><th style="font-size:8px;">Lokalizacja</th><th style="font-size:8px;">Uwagi</th></tr></thead><tbody>${itemsHtml || '<tr><td colspan="7" style="text-align: center; color: #999;">Brak pozycji</td></tr>'}</tbody></table>
                    </div>
                    <div class="print-total">Razem: ${(order.total || 0).toFixed(2)} zł</div>
                    ${order.notes ? `<div class="print-section" style="margin-top: 8px;"><div class="print-section-title">Notatki</div><div style="font-size: 10px; color: #374151; white-space: pre-wrap; line-height: 1.2;">${order.notes}</div></div>` : ''}
                    <div class="print-footer"><div>Wydruk z systemu zarządzania zamówieniami | ${new Date().toLocaleString('pl-PL')}</div></div>
                </div>`;

            if (adminPrintPreviewContent) adminPrintPreviewContent.innerHTML = printHtml;
            if (adminPrintPreviewModal) adminPrintPreviewModal.classList.remove('hidden');
        } catch (error) {
            console.error('Błąd przygotowania wydruku:', error);
            showAdminToast('Nie udało się przygotować wydruku', 'error');
        }
    };

    // Export CSV
    function exportOrdersCSV() {
        if (allAdminOrders.length === 0) {
            showAdminToast('Brak zamówień do eksportu', 'warning');
            return;
        }

        const headers = ['Numer zamówienia', 'Data', 'Klient', 'Handlowiec', 'Status', 'Wartość'];
        const rows = allAdminOrders.map(order => {
            const date = new Date(order.createdAt).toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            return [order.orderNumber || '', date, order.Customer?.name || '', order.User?.name || order.User?.shortCode || '', STATUS_LABELS[order.status] || order.status, (order.total || 0).toFixed(2)];
        });

        const escapeCSV = (val) => { const str = String(val); if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`; return str; };
        const csvContent = [headers.map(escapeCSV).join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\n');

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

        showAdminToast(`Wyeksportowano ${allAdminOrders.length} zamówień`, 'success');
    }

    // Delete order
    function showDeleteModal(orderId, orderNumber) {
        deleteOrderId = orderId;
        if (deleteOrderNumber) deleteOrderNumber.textContent = orderNumber;
        if (deleteOrderModal) deleteOrderModal.classList.remove('hidden');
    }

    // Edit order modal
    async function showEditOrderModal(orderId) {
        if (!editOrderModal || !editOrderContent) return;

        try {
            // Show modal with loading
            if (editOrderNumber) editOrderNumber.textContent = '';
            editOrderModal.classList.remove('hidden');

            const response = await fetch(`/api/orders/${orderId}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Nie udało się pobrać szczegółów zamówienia');

            const result = await response.json();
            const order = result.data;

            if (editOrderNumber) editOrderNumber.textContent = order.orderNumber;

            const itemsHtml = (order.items || order.OrderItem || []).map((item, itemIndex) => {
                const identifier = item.Product?.identifier || '-';
                const productIndex = item.Product?.index || '-';
                const productLabel = (productIndex && productIndex !== '-' && productIndex !== identifier) ? `${identifier} (${productIndex})` : identifier;
                
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
                
                return `
                <tr class="border-b">
                    <td class="p-2">${itemIndex + 1}</td>
                    <td class="p-2">${productLabel}</td>
                    <td class="p-2">${projectsDisplay}</td>
                    <td class="p-2 text-center">${item.quantity}</td>
                    <td class="p-2 text-right">${(item.unitPrice || 0).toFixed(2)} zł</td>
                    <td class="p-2 text-right">${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)} zł</td>
                </tr>`;
            }).join('');

            editOrderContent.innerHTML = `
                <div class="space-y-6">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Numer zamówienia</label>
                            <input type="text" value="${order.orderNumber}" disabled class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select id="edit-order-status" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                ${Object.keys(STATUS_LABELS).map(status => 
                                    `<option value="${status}" ${status === order.status ? 'selected' : ''}>${STATUS_LABELS[status]}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Klient</label>
                        <input type="text" value="${order.Customer?.name || '-'}" disabled class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Notatki</label>
                        <textarea id="edit-order-notes" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows="3">${order.notes || ''}</textarea>
                    </div>

                    <div>
                        <h4 class="text-sm font-medium text-gray-700 mb-3">Pozycje zamówienia</h4>
                        <div class="border border-gray-200 rounded-lg overflow-hidden">
                            <table class="w-full text-sm">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="p-2 text-left">Lp.</th>
                                        <th class="p-2 text-left">Produkt</th>
                                        <th class="p-2 text-left">Projekty</th>
                                        <th class="p-2 text-center">Ilość</th>
                                        <th class="p-2 text-right">Cena j.</th>
                                        <th class="p-2 text-right">Wartość</th>
                                    </tr>
                                </thead>
                                <tbody>${itemsHtml}</tbody>
                            </table>
                        </div>
                        <div class="text-right mt-2">
                            <strong>Suma: ${(order.total || 0).toFixed(2)} zł</strong>
                        </div>
                    </div>

                    <div class="flex justify-end gap-3 pt-4 border-t">
                        <button id="edit-order-cancel" class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium transition-colors">
                            Anuluj
                        </button>
                        <button id="edit-order-save" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
                            <i class="fas fa-save"></i> Zapisz zmiany
                        </button>
                    </div>
                </div>
            `;

            // Add event listeners
            document.getElementById('edit-order-cancel').addEventListener('click', () => {
                editOrderModal.classList.add('hidden');
            });

            document.getElementById('edit-order-save').addEventListener('click', () => {
                saveOrderChanges(order.id);
            });

        } catch (error) {
            console.error('Błąd ładowania zamówienia:', error);
            showAdminToast('Nie udało się załadować zamówienia', 'error');
            editOrderModal.classList.add('hidden');
        }
    }

    async function saveOrderChanges(orderId) {
        try {
            const status = document.getElementById('edit-order-status').value;
            const notes = document.getElementById('edit-order-notes').value;

            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status, notes })
            });

            const result = await response.json();
            if (result.status === 'success') {
                showAdminToast('Zmiany zostały zapisane', 'success');
                editOrderModal.classList.add('hidden');
                loadOrders(); // Reload orders to show updated status
            } else {
                showAdminToast(result.message || 'Nie udało się zapisać zmian', 'error');
            }
        } catch (error) {
            console.error('Błąd zapisu zmian:', error);
            showAdminToast('Błąd połączenia z serwerem', 'error');
        }
    }

    async function confirmDeleteOrder() {
        if (!deleteOrderId) return;

        try {
            const response = await fetch(`/api/orders/${deleteOrderId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const result = await response.json();
            if (result.status === 'success') {
                showAdminToast('Zamówienie zostało usunięte', 'success');
                loadOrders();
            } else {
                showAdminToast(result.message || 'Nie udało się usunąć zamówienia', 'error');
            }
        } catch (error) {
            console.error('Błąd usuwania zamówienia:', error);
            showAdminToast('Błąd połączenia z serwerem', 'error');
        } finally {
            if (deleteOrderModal) deleteOrderModal.classList.add('hidden');
            deleteOrderId = null;
        }
    }

    // Handle table actions
    function handleOrdersTableClick(e) {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            const orderId = actionBtn.dataset.orderId;
            const orderNumber = actionBtn.dataset.orderNumber;

            if (action === 'delete') {
                e.stopPropagation();
                showDeleteModal(orderId, orderNumber);
                return;
            }
            if (action === 'edit') {
                e.stopPropagation();
                showEditOrderModal(orderId);
                return;
            }
        }

        // Handle row click for inline details
        handleOrderRowClick(e);
    }

    // Event listeners
    if (refreshOrdersBtn) refreshOrdersBtn.addEventListener('click', loadOrders);
    if (ordersStatusFilter) ordersStatusFilter.addEventListener('change', debouncedLoadOrders);
    if (ordersUserFilter) ordersUserFilter.addEventListener('change', debouncedLoadOrders);
    if (ordersSearchInput) ordersSearchInput.addEventListener('input', debounce(() => renderOrdersTable(), 300));
    if (exportOrdersCsvBtn) exportOrdersCsvBtn.addEventListener('click', exportOrdersCSV);
    if (ordersTableBody) ordersTableBody.addEventListener('click', handleOrdersTableClick);
    if (ordersTableHead) ordersTableHead.addEventListener('click', handleSortClick);

    // Print preview
    if (adminPrintPreviewClose) adminPrintPreviewClose.addEventListener('click', () => adminPrintPreviewModal?.classList.add('hidden'));
    if (adminPrintPreviewPrint) {
        adminPrintPreviewPrint.addEventListener('click', () => {
            const printContent = adminPrintPreviewContent?.innerHTML || '';
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Wydruk zamówienia</title><style>* { margin: 0; padding: 0; } body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 10px; line-height: 1.3; } .print-document { background: white; padding: 15px; max-width: 210mm; margin: 0 auto; } .print-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; border-bottom: 1px solid #1f2937; padding-bottom: 8px; } .print-company { font-size: 16px; font-weight: bold; color: #1f2937; } .print-title { font-size: 14px; font-weight: bold; color: #1f2937; margin-top: 2px; } .print-meta { font-size: 10px; color: #6b7280; text-align: right; } .print-section { margin-bottom: 10px; } .print-section-title { font-size: 11px; font-weight: bold; color: #1f2937; margin-bottom: 6px; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; } .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; } .print-field { font-size: 10px; } .print-field-label { color: #6b7280; font-weight: 600; margin-bottom: 2px; } .print-field-value { color: #1f2937; font-weight: 500; } .print-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; } .print-table thead { background: #f3f4f6; border-bottom: 1px solid #d1d5db; } .print-table th { padding: 4px 6px; text-align: left; font-weight: 600; color: #1f2937; } .print-table td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; color: #374151; } .print-table tbody tr:last-child td { border-bottom: none; } .print-total { text-align: right; font-size: 11px; font-weight: bold; color: #1f2937; margin-top: 8px; padding-top: 6px; border-top: 1px solid #d1d5db; } .print-footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #6b7280; text-align: center; }</style></head><body>${printContent}</body></html>`);
            printWindow.document.close();
            printWindow.print();
        });
    }

    // Delete modal
    if (deleteOrderCancel) deleteOrderCancel.addEventListener('click', () => { deleteOrderModal?.classList.add('hidden'); deleteOrderId = null; });
    if (deleteOrderConfirm) deleteOrderConfirm.addEventListener('click', confirmDeleteOrder);

    // Edit modal
    if (editOrderClose) editOrderClose.addEventListener('click', () => { editOrderModal?.classList.add('hidden'); });

    // ============================================
    // OBSŁUGA PRZEŁĄCZANIA WIDOKÓW
    // ============================================
    const navLinks = document.querySelectorAll('nav [data-view]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = link.dataset.view;

            // Ukryj wszystkie widoki
            document.querySelectorAll('.view-container').forEach(container => {
                container.classList.add('hidden');
            });

            // Pokaż wybrany widok
            const selectedView = document.getElementById(`view-${viewName}`);
            if (selectedView) {
                selectedView.classList.remove('hidden');
            }

            // Zaktualizuj aktywny link w menu
            navLinks.forEach(l => {
                l.classList.remove('text-blue-600', 'bg-blue-50', 'font-medium');
                l.classList.add('text-gray-700');
            });
            link.classList.remove('text-gray-700');
            link.classList.add('text-blue-600', 'bg-blue-50', 'font-medium');

            // Załaduj dane dla wybranego widoku
            if (viewName === 'orders') {
                loadOrders();
            } else if (viewName === 'folder-access') {
                loadFolderAccess();
            } else if (viewName === 'city-access') {
                loadCityAccess();
            } else if (viewName === 'product-mapping') {
                loadProductMappingProjects();
            }
        });
    });

    // ============================================
    // MODUŁ: PRZYPISANIA FOLDERÓW KI
    // ============================================
    
    let allFolderAccess = [];
    let allQnapFolders = [];
    let folderAccessUsers = [];
    
    
    // Event listenery dla folderów KI
    if (newFolderAccessBtn) newFolderAccessBtn.addEventListener('click', () => openFolderAccessModal());
    if (refreshFolderAccessBtn) refreshFolderAccessBtn.addEventListener('click', loadFolderAccess);
    if (folderAccessModalClose) folderAccessModalClose.addEventListener('click', closeFolderAccessModal);
    if (folderAccessCancelBtn) folderAccessCancelBtn.addEventListener('click', closeFolderAccessModal);
    if (folderAccessForm) folderAccessForm.addEventListener('submit', handleFolderAccessSubmit);
    if (folderAccessSearch) folderAccessSearch.addEventListener('input', filterFolderAccess);
    if (folderAccessUserFilter) folderAccessUserFilter.addEventListener('change', filterFolderAccess);
    if (folderAccessStatusFilter) folderAccessStatusFilter.addEventListener('change', filterFolderAccess);
    if (folderAccessTableBody) folderAccessTableBody.addEventListener('click', handleFolderAccessTableClick);
    
    async function loadFolderAccess() {
        if (!folderAccessTableBody) return;
        
        folderAccessTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-gray-500">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
                        <span>Ładowanie danych...</span>
                    </div>
                </td>
            </tr>
        `;
        
        try {
            // Pobierz przypisania
            const accessResponse = await fetch('/api/admin/user-folder-access');
            const accessResult = await accessResponse.json();
            
            if (accessResult.status === 'success') {
                allFolderAccess = accessResult.data || [];
            } else {
                throw new Error(accessResult.message || 'Błąd pobierania przypisań');
            }
            
            // Pobierz użytkowników (do filtra i selecta)
            const usersResponse = await fetch('/api/admin/users');
            const usersResult = await usersResponse.json();
            
            if (usersResult.status === 'success') {
                folderAccessUsers = usersResult.data || [];
                populateFolderAccessUserFilter();
                populateFolderAccessUserSelect();
            }
            
            // Pobierz foldery z QNAP (do autouzupełniania)
            try {
                const foldersResponse = await fetch('/api/gallery/salespeople');
                const foldersResult = await foldersResponse.json();
                if (foldersResult.salesPeople) {
                    allQnapFolders = foldersResult.salesPeople;
                    populateFolderSuggestions();
                }
            } catch (e) {
                console.warn('Nie udało się pobrać folderów z QNAP:', e);
            }
            
            filterFolderAccess();
            updateFolderAccessStats();
            
        } catch (error) {
            console.error('Błąd ładowania przypisań folderów:', error);
            folderAccessTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-red-500">
                        <div class="flex flex-col items-center gap-2">
                            <i class="fas fa-exclamation-triangle text-2xl"></i>
                            <span>Błąd: ${error.message}</span>
                        </div>
                    </td>
                </tr>
            `;
        }
    }
    
    function populateFolderAccessUserFilter() {
        if (!folderAccessUserFilter) return;
        
        const currentValue = folderAccessUserFilter.value;
        folderAccessUserFilter.innerHTML = '<option value="">Wszyscy użytkownicy</option>';
        
        // Tylko użytkownicy którzy mają przypisania
        const usersWithAccess = [...new Set(allFolderAccess.map(a => a.userId))];
        const relevantUsers = folderAccessUsers.filter(u => usersWithAccess.includes(u.id));
        
        relevantUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name || user.email;
            folderAccessUserFilter.appendChild(option);
        });
        
        folderAccessUserFilter.value = currentValue;
    }
    
    function populateFolderAccessUserSelect() {
        if (!folderAccessUserSelect) return;
        
        folderAccessUserSelect.innerHTML = '<option value="">Wybierz użytkownika...</option>';
        
        // Grupuj użytkowników po roli
        const roleOrder = ['SALES_REP', 'CLIENT', 'SALES_DEPT', 'NEW_USER', 'ADMIN'];
        const roleLabels = {
            'ADMIN': 'Administratorzy',
            'SALES_REP': 'Handlowcy',
            'SALES_DEPT': 'Dział Sprzedaży',
            'NEW_USER': 'Nowi użytkownicy',
            'CLIENT': 'Klienci zewnętrzni',
            'WAREHOUSE': 'Magazyn',
            'PRODUCTION': 'Produkcja',
            'GRAPHICS': 'Graficy'
        };
        
        roleOrder.forEach(role => {
            const usersInRole = folderAccessUsers.filter(u => u.role === role && u.isActive);
            if (usersInRole.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = roleLabels[role] || role;
                
                usersInRole.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = user.name || user.email;
                    optgroup.appendChild(option);
                });
                
                folderAccessUserSelect.appendChild(optgroup);
            }
        });
    }
    
    function populateFolderSuggestions() {
        if (!folderSuggestions) return;
        
        folderSuggestions.innerHTML = '';
        allQnapFolders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder;
            folderSuggestions.appendChild(option);
        });
    }
    
    function filterFolderAccess() {
        const searchTerm = folderAccessSearch?.value?.toLowerCase() || '';
        const userFilter = folderAccessUserFilter?.value || '';
        const statusFilter = folderAccessStatusFilter?.value || '';
        
        let filtered = allFolderAccess;
        
        if (searchTerm) {
            filtered = filtered.filter(a => 
                a.folderName?.toLowerCase().includes(searchTerm) ||
                a.user?.name?.toLowerCase().includes(searchTerm) ||
                a.user?.email?.toLowerCase().includes(searchTerm)
            );
        }
        
        if (userFilter) {
            filtered = filtered.filter(a => a.userId === userFilter);
        }
        
        if (statusFilter === 'active') {
            filtered = filtered.filter(a => a.isActive);
        } else if (statusFilter === 'inactive') {
            filtered = filtered.filter(a => !a.isActive);
        }
        
        renderFolderAccessTable(filtered);
        
        const tableInfo = document.getElementById('folder-access-table-info');
        if (tableInfo) {
            tableInfo.textContent = `Pokazuje ${filtered.length} z ${allFolderAccess.length} przypisań`;
        }
    }
    
    function renderFolderAccessTable(data) {
        if (!folderAccessTableBody) return;
        
        if (data.length === 0) {
            folderAccessTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-gray-500">
                        <div class="flex flex-col items-center gap-2">
                            <i class="fas fa-folder-open text-4xl text-gray-300"></i>
                            <span>Brak przypisań folderów</span>
                            <button onclick="document.getElementById('new-folder-access-btn').click()" class="text-blue-600 hover:underline text-sm">
                                Dodaj pierwsze przypisanie
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        const roleLabels = {
            'ADMIN': 'Admin',
            'SALES_REP': 'Handlowiec',
            'SALES_DEPT': 'Dz. Sprzedaży',
            'NEW_USER': 'Nowy',
            'CLIENT': 'Klient',
            'WAREHOUSE': 'Magazyn',
            'PRODUCTION': 'Produkcja'
        };
        
        const roleBadgeColors = {
            'ADMIN': 'bg-red-100 text-red-700',
            'SALES_REP': 'bg-blue-100 text-blue-700',
            'SALES_DEPT': 'bg-green-100 text-green-700',
            'NEW_USER': 'bg-gray-100 text-gray-700',
            'CLIENT': 'bg-purple-100 text-purple-700'
        };
        
        folderAccessTableBody.innerHTML = data.map(access => {
            const userName = access.user?.name || 'Nieznany';
            const userEmail = access.user?.email || '';
            const userRole = access.user?.role || '';
            const assignedByName = access.assignedByUser?.name || access.assignedByUser?.email || '—';
            const createdAt = access.createdAt ? new Date(access.createdAt).toLocaleDateString('pl-PL') : '—';
            const notes = access.notes || '';
            const notesShort = notes.length > 30 ? notes.substring(0, 30) + '...' : notes;
            
            const statusBadge = access.isActive 
                ? '<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Aktywny</span>'
                : '<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Nieaktywny</span>';
            
            const roleBadge = `<span class="px-2 py-0.5 text-xs font-medium rounded ${roleBadgeColors[userRole] || 'bg-gray-100 text-gray-700'}">${roleLabels[userRole] || userRole}</span>`;
            
            return `
                <tr class="hover:bg-gray-50 ${!access.isActive ? 'opacity-60' : ''}">
                    <td class="p-4">
                        <div class="font-medium text-gray-900">${userName}</div>
                        <div class="text-xs text-gray-500">${userEmail}</div>
                        <div class="mt-1">${roleBadge}</div>
                    </td>
                    <td class="p-4">
                        <div class="font-mono text-sm bg-gray-100 px-2 py-1 rounded inline-block">${access.folderName}</div>
                    </td>
                    <td class="p-4 text-center">${statusBadge}</td>
                    <td class="p-4 text-sm text-gray-600">${assignedByName}</td>
                    <td class="p-4 text-sm text-gray-500">${createdAt}</td>
                    <td class="p-4 text-sm text-gray-600" title="${notes}">${notesShort || '<span class="text-gray-400">—</span>'}</td>
                    <td class="p-4 text-right">
                        <div class="flex justify-end gap-2">
                            <button class="folder-access-toggle-btn px-3 py-1 text-xs rounded border ${access.isActive ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-green-300 text-green-700 hover:bg-green-50'}" data-id="${access.id}" data-active="${access.isActive}">
                                ${access.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                            </button>
                            <button class="folder-access-edit-btn px-2 py-1 text-gray-600 hover:text-blue-600" data-id="${access.id}" title="Edytuj">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="folder-access-delete-btn px-2 py-1 text-gray-600 hover:text-red-600" data-id="${access.id}" title="Usuń">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    function updateFolderAccessStats() {
        const activeCount = allFolderAccess.filter(a => a.isActive).length;
        const uniqueUsers = new Set(allFolderAccess.filter(a => a.isActive).map(a => a.userId)).size;
        const uniqueFolders = new Set(allFolderAccess.filter(a => a.isActive).map(a => a.folderName)).size;
        
        const statsActive = document.getElementById('folder-stats-active');
        const statsUsers = document.getElementById('folder-stats-users');
        const statsFolders = document.getElementById('folder-stats-folders');
        
        if (statsActive) statsActive.textContent = activeCount;
        if (statsUsers) statsUsers.textContent = uniqueUsers;
        if (statsFolders) statsFolders.textContent = uniqueFolders;
    }
    
    function openFolderAccessModal(accessData = null) {
        if (!folderAccessModal || !folderAccessForm) return;
        
        folderAccessForm.reset();
        folderAccessForm.querySelector('[name="id"]').value = '';
        
        if (accessData) {
            folderAccessModalTitle.textContent = 'Edytuj przypisanie';
            folderAccessForm.querySelector('[name="id"]').value = accessData.id;
            folderAccessForm.querySelector('[name="userId"]').value = accessData.userId;
            folderAccessForm.querySelector('[name="userId"]').disabled = true;
            folderAccessForm.querySelector('[name="folderName"]').value = accessData.folderName;
            folderAccessForm.querySelector('[name="notes"]').value = accessData.notes || '';
            folderAccessForm.querySelector('[name="isActive"]').checked = accessData.isActive;
            folderAccessActiveField?.classList.remove('hidden');
        } else {
            folderAccessModalTitle.textContent = 'Nowe przypisanie folderu';
            folderAccessForm.querySelector('[name="userId"]').disabled = false;
            folderAccessActiveField?.classList.add('hidden');
        }
        
        folderAccessModal.classList.remove('hidden');
    }
    
    function closeFolderAccessModal() {
        if (folderAccessModal) {
            folderAccessModal.classList.add('hidden');
        }
    }
    
    async function handleFolderAccessSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(folderAccessForm);
        const id = formData.get('id');
        const userId = formData.get('userId');
        const folderName = formData.get('folderName')?.trim();
        const notes = formData.get('notes')?.trim();
        const isActive = folderAccessForm.querySelector('[name="isActive"]')?.checked ?? true;
        
        if (!userId || !folderName) {
            alert('Wybierz użytkownika i podaj nazwę folderu');
            return;
        }
        
        const submitBtn = folderAccessSubmitBtn || folderAccessForm.querySelector('button[type="submit"]');
        const originalText = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Zapisywanie...';
        }
        
        try {
            let response;
            
            if (id) {
                // Aktualizacja
                response = await fetch(`/api/admin/user-folder-access/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderName, notes, isActive })
                });
            } else {
                // Nowe przypisanie
                response = await fetch('/api/admin/user-folder-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, folderName, notes })
                });
            }
            
            const result = await response.json();
            
            if (result.status === 'success') {
                closeFolderAccessModal();
                loadFolderAccess();
            } else {
                alert('Błąd: ' + (result.message || 'Nie udało się zapisać'));
            }
        } catch (error) {
            console.error('Błąd zapisu przypisania:', error);
            alert('Wystąpił błąd podczas zapisywania');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }
    
    async function handleFolderAccessTableClick(e) {
        const toggleBtn = e.target.closest('.folder-access-toggle-btn');
        const editBtn = e.target.closest('.folder-access-edit-btn');
        const deleteBtn = e.target.closest('.folder-access-delete-btn');
        
        if (toggleBtn) {
            const id = toggleBtn.dataset.id;
            const currentActive = toggleBtn.dataset.active === 'true';
            
            try {
                const response = await fetch(`/api/admin/user-folder-access/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isActive: !currentActive })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    loadFolderAccess();
                } else {
                    alert('Błąd: ' + result.message);
                }
            } catch (error) {
                console.error('Błąd zmiany statusu:', error);
            }
        }
        
        if (editBtn) {
            const id = editBtn.dataset.id;
            const accessData = allFolderAccess.find(a => a.id == id);
            if (accessData) {
                openFolderAccessModal(accessData);
            }
        }
        
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (!confirm('Czy na pewno chcesz usunąć to przypisanie? Ta operacja jest nieodwracalna.')) {
                return;
            }
            
            try {
                const response = await fetch(`/api/admin/user-folder-access/${id}`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    loadFolderAccess();
                } else {
                    alert('Błąd: ' + result.message);
                }
            } catch (error) {
                console.error('Błąd usuwania:', error);
                alert('Wystąpił błąd podczas usuwania');
            }
        }
    }

    // ============================================
    // MODUŁ: PRZYPISANIA MIEJSCOWOŚCI PM (KAFELKI)
    // ============================================
    
    let allQnapCities = [];
    let cityAccessUsers = [];
    let selectedUserCityAccess = []; // przypisania wybranego użytkownika
    let selectedUserId = null;
    let cityTilesLoading = false;
    
    // DOM elements for city access tiles
    const cityAccessUserSelect = document.getElementById('city-access-user-select');
    const cityTilesContainer = document.getElementById('city-tiles-container');
    const cityTilesSearch = document.getElementById('city-tiles-search');
    const cityTilesSort = document.getElementById('city-tiles-sort');
    const cityTilesShowAssignedOnly = document.getElementById('city-tiles-show-assigned-only');
    const refreshCityAccessBtn = document.getElementById('refresh-city-access-btn');
    
    // Event listenery dla kafelków miejscowości
    if (refreshCityAccessBtn) refreshCityAccessBtn.addEventListener('click', () => loadCityTilesData());
    if (cityAccessUserSelect) cityAccessUserSelect.addEventListener('change', handleUserSelectChange);
    if (cityTilesSearch) cityTilesSearch.addEventListener('input', debounce(renderCityTiles, 200));
    if (cityTilesSort) cityTilesSort.addEventListener('change', renderCityTiles);
    if (cityTilesShowAssignedOnly) cityTilesShowAssignedOnly.addEventListener('change', renderCityTiles);
    
    async function loadCityAccess() {
        // Sprawdź rolę użytkownika
        try {
            const authResponse = await fetch('/api/auth/me');
            const authResult = await authResponse.json();
            
            if (authResult.status === 'success' && authResult.role === 'GRAPHICS') {
                // Dla GRAPHICS pokaż specjalny widok nieprzypisanych miejscowości
                await loadUnassignedCitiesView();
            } else {
                // Dla ADMIN i SALES_DEPT pokaż standardowy widok
                await loadCityTilesData();
            }
        } catch (error) {
            console.error('Błąd sprawdzania roli:', error);
            await loadCityTilesData();
        }
    }
    
    // Funkcja specjalnego widoku dla GRAPHICS - nieprzypisane miejscowości
    async function loadUnassignedCitiesView() {
        try {
            // Ukryj standardowe kontrolki dla GRAPHICS
            if (cityAccessUserSelect) cityAccessUserSelect.parentElement.style.display = 'none';
            if (cityTilesSearch) cityTilesSearch.parentElement.style.display = 'none';
            if (cityTilesSort) cityTilesSort.parentElement.style.display = 'none';
            if (cityTilesShowAssignedOnly) cityTilesShowAssignedOnly.parentElement.style.display = 'none';
            
            // Pobierz użytkowników do selecta
            const usersResponse = await fetch('/api/admin/users');
            const usersResult = await usersResponse.json();
            if (usersResult.status === 'success') {
                cityAccessUsers = usersResult.data || [];
            }
            
            // Pokaż informację o przeznaczeniu widoku
            if (cityTilesContainer) {
                cityTilesContainer.innerHTML = `
                    <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div class="flex items-center gap-3">
                            <i class="fas fa-info-circle text-blue-600 text-xl"></i>
                            <div>
                                <h3 class="font-semibold text-blue-900">Widok Grafika - Nowe miejscowości</h3>
                                <p class="text-sm text-blue-700 mt-1">
                                    Poniżej znajdują się miejscowości, które nie są jeszcze przypisane do żadnego handlowca.
                                    Wybierz handlowca i kliknij "Przypisz", aby przypisać miejscowość.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div id="unassigned-cities-list" class="space-y-4">
                        <div class="flex justify-center items-center py-8">
                            <i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
                            <span class="ml-2 text-gray-500">Ładowanie nieprzypisanych miejscowości...</span>
                        </div>
                    </div>
                `;
            }
            
            // Pobierz nieprzypisane miejscowości
            const response = await fetch('/api/admin/unassigned-cities');
            const result = await response.json();
            
            if (result.status === 'success') {
                renderUnassignedCitiesList(result.data);
            } else {
                throw new Error(result.message || 'Błąd pobierania danych');
            }
            
        } catch (error) {
            console.error('Błąd ładowania widoku nieprzypisanych miejscowości:', error);
            if (cityTilesContainer) {
                cityTilesContainer.innerHTML = `
                    <div class="text-center py-8 text-red-500">
                        <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                        <p>Błąd ładowania danych: ${error.message}</p>
                        <button onclick="loadCityAccess()" class="mt-2 text-blue-600 underline text-sm">Spróbuj ponownie</button>
                    </div>
                `;
            }
        }
    }
    
    // Funkcja renderująca listę nieprzypisanych miejscowości dla GRAPHICS
    function renderUnassignedCitiesList(data) {
        const container = document.getElementById('unassigned-cities-list');
        if (!container) return;
        
        if (data.unassignedCities.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-green-600">
                    <i class="fas fa-check-circle text-4xl mb-2"></i>
                    <p class="font-semibold">Wszystkie miejscowości są przypisane!</p>
                    <p class="text-sm text-gray-500 mt-1">Nie ma nowych miejscowości wymagających przypisania.</p>
                </div>
            `;
            return;
        }
        
        // Pobierz listę handlowców
        const salespeople = cityAccessUsers.filter(user => 
            ['SALES_REP', 'SALES_DEPT'].includes(user.role) && user.isActive
        );
        
        container.innerHTML = `
            <div class="mb-4">
                <div class="flex items-center justify-between">
                    <h3 class="font-semibold text-gray-800">
                        Nieprzypisane miejscowości (${data.unassignedCities.length})
                    </h3>
                    <div class="text-sm text-gray-500">
                        Razem miejscowości: ${data.stats.total} | Przypisane: ${data.stats.assigned}
                    </div>
                </div>
            </div>
            <div class="grid gap-3">
                ${data.unassignedCities.map(city => `
                    <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-map-marker-alt text-amber-600"></i>
                                </div>
                                <div>
                                    <h4 class="font-medium text-gray-900">${city}</h4>
                                    <p class="text-sm text-gray-500">Nieprzypisana miejscowość</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <select class="city-assignment-select px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" data-city="${city}">
                                    <option value="">Wybierz handlowca</option>
                                    ${salespeople.map(user => `
                                        <option value="${user.id}">${user.name} (${user.email})</option>
                                    `).join('')}
                                </select>
                                <button class="assign-city-btn px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors" data-city="${city}">
                                    <i class="fas fa-plus mr-1"></i> Przypisz
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Dodaj event listenery do przycisków przypisania
        container.querySelectorAll('.assign-city-btn').forEach(btn => {
            btn.addEventListener('click', handleAssignCityFromUnassigned);
        });
    }
    
    // Funkcja obsługująca przypisanie miejscowości z widoku GRAPHICS
    async function handleAssignCityFromUnassigned(event) {
        const btn = event.currentTarget;
        const cityName = btn.dataset.city;
        const select = btn.parentElement.querySelector('.city-assignment-select');
        const userId = select.value;
        
        if (!userId) {
            alert('Proszę wybrać handlowca');
            return;
        }
        
        const originalBtnText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Przypisywanie...';
        
        try {
            const response = await fetch('/api/admin/user-city-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, cityName })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                // Sukces - odśwież widok
                await loadUnassignedCitiesView();
                
                // Pokaż krótkie powiadomienie
                const notification = document.createElement('div');
                notification.className = 'fixed top-4 right-4 bg-green-50 border border-green-200 rounded-lg p-3 shadow-lg z-50';
                notification.innerHTML = `
                    <div class="flex items-center gap-2">
                        <i class="fas fa-check-circle text-green-600"></i>
                        <span class="text-sm text-green-800">Miejscowość ${cityName} została przypisana</span>
                    </div>
                `;
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 3000);
                
            } else {
                throw new Error(result.message || 'Błąd przypisania');
            }
        } catch (error) {
            console.error('Błąd przypisania miejscowości:', error);
            alert('Błąd: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }
    }
    
    async function loadCityTilesData() {
        try {
            // Pobierz użytkowników
            const usersResponse = await fetch('/api/admin/users');
            const usersResult = await usersResponse.json();
            
            if (usersResult.status === 'success') {
                cityAccessUsers = usersResult.data || [];
                populateCityAccessUserSelect();
            }
            
            // Pobierz miejscowości z QNAP i przefiltruj foldery zaczynające się od '00_'
            const citiesResponse = await fetch('/api/gallery/cities?' + Date.now()); // Dodaj timestamp, aby uniknąć cache
            const citiesResult = await citiesResponse.json();
            if (citiesResult.cities) {
                const allCities = citiesResult.cities;
                allQnapCities = allCities
                    .filter(city => !/^\d+\./.test(city))  // Pomijaj foldery zaczynające się od cyfr i kropki (np. "01.", "02.", "00.")
                    .sort((a, b) => a.localeCompare(b, 'pl'));
            }
            
            // Pobierz wszystkie przypisania w systemie, aby wiedzieć, które miejscowości są nieprzypisane globalnie
            await loadAllCityAssignments();
            
            // Jeśli był wybrany użytkownik, odśwież jego dane
            if (selectedUserId) {
                await loadUserCityAccess(selectedUserId);
            }
            
        } catch (error) {
            console.error('Błąd ładowania danych:', error);
        }
    }
    
    // Globalna zmienna na wszystkie przypisania w systemie
    let allSystemCityAssignments = [];
    
    async function loadAllCityAssignments() {
        try {
            const response = await fetch('/api/admin/user-city-access');
            const result = await response.json();
            
            if (result.status === 'success') {
                allSystemCityAssignments = result.data || [];
            } else {
                allSystemCityAssignments = [];
            }
        } catch (error) {
            console.error('Błąd ładowania wszystkich przypisań:', error);
            allSystemCityAssignments = [];
        }
    }
    
    function getGloballyUnassignedCities() {
        // Stwórz zbiór wszystkich miejscowości, które mają aktywne przypisanie w systemie
        const globallyAssignedCities = new Set();
        allSystemCityAssignments.forEach(a => {
            if (a.isActive) {
                globallyAssignedCities.add(a.cityName);
            }
        });
        
        // Zwróć miejscowości, które nie mają żadnego przypisania w systemie
        return allQnapCities.filter(city => !globallyAssignedCities.has(city));
    }
    
    function populateCityAccessUserSelect() {
        if (!cityAccessUserSelect) return;
        
        const currentValue = cityAccessUserSelect.value;
        cityAccessUserSelect.innerHTML = '<option value="">-- Wybierz handlowca --</option>';
        
        // Grupuj użytkowników po roli
        const roleOrder = ['SALES_REP', 'CLIENT', 'SALES_DEPT', 'NEW_USER'];
        const roleLabels = {
            'ADMIN': 'Administratorzy',
            'SALES_REP': 'Handlowcy',
            'SALES_DEPT': 'Dział Sprzedaży',
            'NEW_USER': 'Nowi użytkownicy',
            'CLIENT': 'Klienci zewnętrzni'
        };
        
        roleOrder.forEach(role => {
            const usersInRole = cityAccessUsers.filter(u => u.role === role && u.isActive);
            if (usersInRole.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = roleLabels[role] || role;
                
                usersInRole.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = `${user.name || user.email}`;
                    optgroup.appendChild(option);
                });
                
                cityAccessUserSelect.appendChild(optgroup);
            }
        });
        
        if (currentValue) {
            cityAccessUserSelect.value = currentValue;
        }
    }
    
    async function handleUserSelectChange() {
        selectedUserId = cityAccessUserSelect?.value || null;
        
        if (!selectedUserId) {
            selectedUserCityAccess = [];
            renderCityTilesPlaceholder();
            updateCityTilesStats();
            return;
        }
        
        await loadUserCityAccess(selectedUserId);
    }
    
    async function loadUserCityAccess(userId) {
        if (cityTilesLoading) return;
        cityTilesLoading = true;
        
        // Pokaż loading
        if (cityTilesContainer) {
            cityTilesContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                    <i class="fas fa-spinner fa-spin text-4xl mb-4 text-blue-500"></i>
                    <p>Ładowanie miejscowości...</p>
                </div>
            `;
        }
        
        try {
            const response = await fetch(`/api/admin/user-city-access?userId=${userId}`);
            const result = await response.json();
            
            if (result.status === 'success') {
                selectedUserCityAccess = result.data || [];
            } else {
                selectedUserCityAccess = [];
            }
            
            renderCityTiles();
            updateCityTilesStats();
            
        } catch (error) {
            console.error('Błąd ładowania przypisań:', error);
            selectedUserCityAccess = [];
            renderCityTiles();
        } finally {
            cityTilesLoading = false;
        }
    }
    
    function renderCityTilesPlaceholder() {
        if (!cityTilesContainer) return;
        cityTilesContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                <i class="fas fa-user-circle text-6xl mb-4"></i>
                <p class="text-lg">Wybierz użytkownika, aby zobaczyć miejscowości</p>
            </div>
        `;
    }
    
    function renderCityTiles() {
        if (!cityTilesContainer || !selectedUserId) return;
        
        const searchTerm = cityTilesSearch?.value?.toLowerCase() || '';
        const sortMode = cityTilesSort?.value || 'alpha';
        const showAssignedOnly = cityTilesShowAssignedOnly?.checked || false;
        
        // Przygotuj mapę przypisań
        const assignedCities = new Map();
        selectedUserCityAccess.forEach(a => {
            if (a.isActive) {
                assignedCities.set(a.cityName, a);
            }
        });
        
        // Filtruj miejscowości
        let cities = allQnapCities.filter(city => {
            if (searchTerm && !city.toLowerCase().includes(searchTerm)) return false;
            if (showAssignedOnly && !assignedCities.has(city)) return false;
            return true;
        });
        
                
        // Sortuj
        if (sortMode === 'assigned-first') {
            cities.sort((a, b) => {
                const aAssigned = assignedCities.has(a) ? 0 : 1;
                const bAssigned = assignedCities.has(b) ? 0 : 1;
                if (aAssigned !== bAssigned) return aAssigned - bAssigned;
                return a.localeCompare(b, 'pl');
            });
        } else if (sortMode === 'unassigned-first') {
            cities.sort((a, b) => {
                const aAssigned = assignedCities.has(a) ? 1 : 0;
                const bAssigned = assignedCities.has(b) ? 1 : 0;
                if (aAssigned !== bAssigned) return aAssigned - bAssigned;
                return a.localeCompare(b, 'pl');
            });
        } else {
            cities.sort((a, b) => a.localeCompare(b, 'pl'));
        }
        
        if (cities.length === 0) {
            cityTilesContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                    <i class="fas fa-search text-4xl mb-4"></i>
                    <p>Brak miejscowości spełniających kryteria</p>
                </div>
            `;
            return;
        }
        
        // Grupuj po pierwszej literze
        const grouped = {};
        cities.forEach(city => {
            const letter = city.charAt(0).toUpperCase();
            if (!grouped[letter]) grouped[letter] = [];
            grouped[letter].push(city);
        });
        
        // Renderuj kafelki
        let html = '';
        Object.keys(grouped).sort().forEach(letter => {
            html += `
                <div class="mb-6">
                    <div class="text-sm font-bold text-gray-400 mb-2 sticky top-0 bg-white py-1">${letter}</div>
                    <div class="flex flex-wrap gap-2">
            `;
            
            grouped[letter].forEach(city => {
                const isAssigned = assignedCities.has(city);
                const accessData = assignedCities.get(city);
                
                // Sprawdź, czy miejscowość jest globalnie nieprzypisana
                const globallyUnassignedCities = getGloballyUnassignedCities();
                const isGloballyUnassigned = globallyUnassignedCities.includes(city);
                
                const baseClasses = 'city-tile px-4 py-2 rounded-lg font-medium text-sm cursor-pointer transition-all duration-200 transform select-none relative';
                const assignedClasses = 'bg-green-500 text-white shadow-lg scale-105 hover:bg-green-600 hover:shadow-xl';
                const availableClasses = 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 hover:scale-105 hover:shadow-md';
                
                const classes = isAssigned ? `${baseClasses} ${assignedClasses}` : `${baseClasses} ${availableClasses}`;
                const icon = isAssigned ? '<i class="fas fa-check mr-1"></i>' : '';
                const dataId = accessData ? `data-access-id="${accessData.id}"` : '';
                
                // Dodaj pomarańczową kropkę tylko dla miejscowości globalnie nieprzypisanych
                const unassignedInfo = isGloballyUnassigned ? 
                    '<span class="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full" title="Nieprzypisana do żadnego handlowca"></span>' : '';
                
                html += `
                    <button class="${classes}" data-city="${city}" data-assigned="${isAssigned}" ${dataId}>
                        ${icon}${city}
                        ${unassignedInfo}
                    </button>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        cityTilesContainer.innerHTML = html;
        
        // Dodaj event listenery do kafelków
        cityTilesContainer.querySelectorAll('.city-tile').forEach(tile => {
            tile.addEventListener('click', handleCityTileClick);
        });
        
        updateCityTilesStats();
    }
    
    async function handleCityTileClick(e) {
        const tile = e.currentTarget;
        const city = tile.dataset.city;
        const isAssigned = tile.dataset.assigned === 'true';
        const accessId = tile.dataset.accessId;
        
        if (!selectedUserId || !city) return;
        
        // Disable tile during operation
        tile.disabled = true;
        tile.style.opacity = '0.5';
        
        try {
            if (isAssigned && accessId) {
                // Usuń przypisanie
                const response = await fetch(`/api/admin/user-city-access/${accessId}`, {
                    method: 'DELETE'
                });
                const result = await response.json();
                
                if (result.status === 'success') {
                    // Animacja usunięcia
                    tile.classList.remove('bg-green-500', 'text-white', 'shadow-lg', 'scale-105');
                    tile.classList.add('bg-gray-100', 'text-gray-700', 'border', 'border-gray-200');
                    tile.dataset.assigned = 'false';
                    tile.removeAttribute('data-access-id');
                    tile.innerHTML = city;
                    
                    // Aktualizuj lokalną listę
                    selectedUserCityAccess = selectedUserCityAccess.filter(a => a.id != accessId);
                    updateCityTilesStats();
                } else {
                    alert('Błąd: ' + (result.message || 'Nie udało się usunąć'));
                }
            } else {
                // Dodaj przypisanie
                const response = await fetch('/api/admin/user-city-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: selectedUserId, cityName: city })
                });
                const result = await response.json();
                
                if (result.status === 'success') {
                    // Animacja dodania
                    tile.classList.remove('bg-gray-100', 'text-gray-700', 'border', 'border-gray-200');
                    tile.classList.add('bg-green-500', 'text-white', 'shadow-lg', 'scale-105');
                    tile.dataset.assigned = 'true';
                    tile.dataset.accessId = result.data.id;
                    tile.innerHTML = `<i class="fas fa-check mr-1"></i>${city}`;
                    
                    // Aktualizuj lokalną listę
                    selectedUserCityAccess.push(result.data);
                    updateCityTilesStats();
                } else {
                    alert('Błąd: ' + (result.message || 'Nie udało się przypisać'));
                }
            }
        } catch (error) {
            console.error('Błąd operacji:', error);
            alert('Wystąpił błąd podczas operacji');
        } finally {
            tile.disabled = false;
            tile.style.opacity = '1';
        }
    }
    
    function updateCityTilesStats() {
        const assignedCities = new Set(selectedUserCityAccess
            .filter(a => a.isActive)
            .map(a => a.cityName));
            
        const unassignedCities = allQnapCities.filter(city => !assignedCities.has(city));
        const globallyUnassignedCities = getGloballyUnassignedCities();
        
        const assignedCount = assignedCities.size;
        const totalCount = allQnapCities.length;
        const availableCount = unassignedCities.length;
        const globallyUnassignedCount = globallyUnassignedCities.length;
        
        const statsAssigned = document.getElementById('city-stats-assigned');
        const statsAvailable = document.getElementById('city-stats-available');
        const statsTotal = document.getElementById('city-stats-total');
        
        if (statsAssigned) statsAssigned.textContent = assignedCount;
        if (statsAvailable) statsAvailable.textContent = availableCount;
        if (statsTotal) statsTotal.textContent = totalCount;
        
        // Dodaj obsługę kliknięcia na "Dostępnych" - pokazuje listę globalnie nieprzypisanych
        const availableTrigger = document.getElementById('available-cities-trigger');
        if (availableTrigger) {
            availableTrigger.onclick = (e) => {
                e.stopPropagation();
                if (globallyUnassignedCities.length > 0) {
                    showAllUnassignedCities(globallyUnassignedCities);
                }
            };
            
            // Aktualizuj title z liczbą globalnie nieprzypisanych
            availableTrigger.title = `Kliknij, aby zobaczyć listę (${globallyUnassignedCount} miejscowości nieprzypisanych do żadnego handlowca)`;
        }
    }
    
    function showAllUnassignedCities(cities) {
        // Utwórz modal z listą wszystkich dostępnych miejscowości
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div class="p-6 border-b border-gray-200">
                    <h3 class="text-xl font-semibold text-gray-800">Miejscowości nieprzypisane do żadnego handlowca</h3>
                    <p class="text-sm text-gray-500 mt-1">Liczba: ${cities.length}</p>
                </div>
                <div class="p-4 overflow-y-auto flex-grow">
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        ${cities.map(city => 
                            `<div class="p-2 bg-gray-50 rounded border border-gray-100 text-sm">
                                ${city}
                            </div>`
                        ).join('')}
                    </div>
                </div>
                <div class="p-4 border-t border-gray-200 flex justify-end">
                    <button id="close-cities-modal" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Zamknij
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Obsługa zamknięcia modala
        const closeBtn = modal.querySelector('#close-cities-modal');
        if (closeBtn) {
            closeBtn.onclick = () => modal.remove();
        }
        
        // Zamknij po kliknięciu poza modalem
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };
        
        // Zamknij po ESC
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    // ============================================
    // OBSŁUGA HISTORII ZAMÓWIEŃ
    // ============================================
    const adminLoadingHistory = new Set();
    
    window.adminToggleOrderHistory = async function(orderId) {
        if (adminLoadingHistory.has(orderId)) {
            console.log(`[adminToggleOrderHistory] Historia dla ${orderId} już się ładuje`);
            return;
        }
        
        const container = document.getElementById(`admin-history-container-${orderId}`);
        const btnIcon = document.getElementById(`admin-history-icon-${orderId}`);
        
        if (!container) return;

        if (!container.classList.contains('hidden')) {
            container.classList.add('hidden');
            if (btnIcon) btnIcon.className = 'fas fa-history';
            return;
        }

        adminLoadingHistory.add(orderId);
        container.classList.remove('hidden');
        
        if (btnIcon) btnIcon.className = 'fas fa-spinner fa-spin';

        try {
            const response = await fetch(`/api/orders/${orderId}/history`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Nie udało się pobrać historii');
            }

            const result = await response.json();
            const history = result.data || [];

            if (history.length === 0) {
                container.innerHTML = `
                    <div class="bg-gray-50 rounded-lg p-4 text-center">
                        <i class="fas fa-info-circle text-gray-400 mr-2"></i>
                        <span class="text-gray-600 text-sm">Brak historii zmian statusu</span>
                    </div>
                `;
            } else {
                const historyHtml = history.map(entry => {
                    const date = new Date(entry.changedAt).toLocaleString('pl-PL', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                    });
                    const userName = entry.User?.name || 'System';
                    return `
                        <div class="bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <i class="fas fa-exchange-alt text-blue-500 text-sm"></i>
                                    <span class="text-sm font-medium text-gray-900">
                                        ${STATUS_LABELS[entry.oldStatus] || entry.oldStatus} → ${STATUS_LABELS[entry.newStatus] || entry.newStatus}
                                    </span>
                                </div>
                                <span class="text-xs text-gray-500">${date}</span>
                            </div>
                            <div class="mt-1 text-xs text-gray-600">
                                <i class="fas fa-user text-gray-400 mr-1"></i>
                                ${userName} • ${entry.notes || 'Zmiana statusu'}
                            </div>
                        </div>
                    `;
                }).join('');
                
                container.innerHTML = historyHtml;
            }
        } catch (error) {
            console.error('Błąd pobierania historii:', error);
            container.innerHTML = `
                <div class="bg-red-50 rounded-lg p-4 text-center">
                    <i class="fas fa-exclamation-triangle text-red-400 mr-2"></i>
                    <span class="text-red-600 text-sm">Nie udało się pobrać historii</span>
                </div>
            `;
        } finally {
            if (btnIcon) btnIcon.className = 'fas fa-history';
            adminLoadingHistory.delete(orderId);
        }
    };
    // ============================================
    // MODUŁ: MAPOWANIE PRODUKTÓW (GalleryProject → Product)
    // ============================================

    let pmAllProjects = [];
    let pmFilteredProjects = [];
    let pmSelectedProjectId = null;
    let pmAllDbProducts = [];

    const pmProjectsList = document.getElementById('product-mapping-projects-list');
    const pmSearch = document.getElementById('product-mapping-search');
    const pmRefreshBtn = document.getElementById('refresh-product-mapping-btn');
    const pmSelectedProjectName = document.getElementById('pm-selected-project-name');
    const pmProjectDetails = document.getElementById('pm-project-details');
    const pmAddProductBtn = document.getElementById('pm-add-product-btn');
    const pmStatsProjects = document.getElementById('pm-stats-projects');
    const pmStatsMapped = document.getElementById('pm-stats-mapped');
    const pmStatsUnmapped = document.getElementById('pm-stats-unmapped');

    // Modal elements
    const pmModal = document.getElementById('pm-add-product-modal');
    const pmModalClose = document.getElementById('pm-modal-close');
    const pmModalCancel = document.getElementById('pm-modal-cancel');
    const pmModalSave = document.getElementById('pm-modal-save');
    const pmModalProjectName = document.getElementById('pm-modal-project-name');
    const pmModalProjectId = document.getElementById('pm-modal-project-id');
    const pmProductSelect = document.getElementById('pm-product-select');
    const pmProductSearchInput = document.getElementById('pm-product-search-input');

    // Event listeners
    if (pmRefreshBtn) pmRefreshBtn.addEventListener('click', loadProductMappingProjects);
    if (pmSearch) pmSearch.addEventListener('input', filterProductMappingProjects);
    if (pmAddProductBtn) pmAddProductBtn.addEventListener('click', openProductMappingModal);
    if (pmModalClose) pmModalClose.addEventListener('click', closeProductMappingModal);
    if (pmModalCancel) pmModalCancel.addEventListener('click', closeProductMappingModal);
    if (pmModalSave) pmModalSave.addEventListener('click', handleProductMappingSave);
    if (pmProductSearchInput) pmProductSearchInput.addEventListener('input', filterProductMappingSelect);

    async function loadProductMappingProjects() {
        if (!pmProjectsList) return;

        pmProjectsList.innerHTML = `
            <div class="p-8 text-center text-gray-400">
                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                <p>Ładowanie projektów...</p>
            </div>
        `;

        try {
            const response = await fetch('/api/admin/gallery-projects');
            const result = await response.json();

            if (result.status === 'success') {
                pmAllProjects = result.data || [];
                pmFilteredProjects = [...pmAllProjects];
                renderProductMappingProjects();
                updateProductMappingStats();
            } else {
                throw new Error(result.message || 'Błąd pobierania projektów');
            }

            // Pobierz też listę wszystkich produktów z bazy (do modala)
            await loadAllDbProducts();

        } catch (error) {
            console.error('Błąd ładowania projektów mapowania:', error);
            pmProjectsList.innerHTML = `
                <div class="p-8 text-center text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Nie udało się załadować projektów</p>
                    <p class="text-sm text-gray-500">${error.message}</p>
                </div>
            `;
        }
    }

    async function loadAllDbProducts() {
        try {
            const response = await fetch('/api/admin/products-with-stock');
            const result = await response.json();

            if (result.status === 'success') {
                pmAllDbProducts = (result.data || []).filter(p => p.isActive !== false);
                populateProductMappingSelect();
            }
        } catch (error) {
            console.error('Błąd ładowania produktów:', error);
        }
    }

    function populateProductMappingSelect(filter = '') {
        if (!pmProductSelect) return;

        const normalizedFilter = filter.toLowerCase().trim();
        const filtered = normalizedFilter
            ? pmAllDbProducts.filter(p =>
                (p.identifier || '').toLowerCase().includes(normalizedFilter) ||
                (p.index || '').toLowerCase().includes(normalizedFilter)
            )
            : pmAllDbProducts;

        pmProductSelect.innerHTML = '<option value="">-- Wybierz produkt --</option>';
        filtered.slice(0, 100).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.identifier || '(brak identyfikatora)'} (${p.index || '-'})`;
            pmProductSelect.appendChild(opt);
        });

        if (filtered.length > 100) {
            const opt = document.createElement('option');
            opt.disabled = true;
            opt.textContent = `... i ${filtered.length - 100} więcej (użyj wyszukiwania)`;
            pmProductSelect.appendChild(opt);
        }
    }

    function filterProductMappingSelect() {
        const filter = pmProductSearchInput?.value || '';
        populateProductMappingSelect(filter);
    }

    function filterProductMappingProjects() {
        const search = (pmSearch?.value || '').toLowerCase().trim();
        if (!search) {
            pmFilteredProjects = [...pmAllProjects];
        } else {
            pmFilteredProjects = pmAllProjects.filter(p =>
                (p.displayName || '').toLowerCase().includes(search) ||
                (p.slug || '').toLowerCase().includes(search)
            );
        }
        renderProductMappingProjects();
    }

    function updateProductMappingStats() {
        const total = pmAllProjects.length;
        const mapped = pmAllProjects.filter(p => p.productCount > 0).length;
        const unmapped = total - mapped;

        if (pmStatsProjects) pmStatsProjects.textContent = total;
        if (pmStatsMapped) pmStatsMapped.textContent = mapped;
        if (pmStatsUnmapped) pmStatsUnmapped.textContent = unmapped;
    }

    function renderProductMappingProjects() {
        if (!pmProjectsList) return;

        if (pmFilteredProjects.length === 0) {
            pmProjectsList.innerHTML = `
                <div class="p-8 text-center text-gray-400">
                    <i class="fas fa-folder-open text-4xl mb-3"></i>
                    <p>Brak projektów do wyświetlenia</p>
                </div>
            `;
            return;
        }

        pmProjectsList.innerHTML = pmFilteredProjects.map(p => {
            const isSelected = p.id === pmSelectedProjectId;
            const hasMappings = p.productCount > 0;
            return `
                <div class="pm-project-item flex items-center justify-between px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}"
                     data-project-id="${p.id}">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-800 truncate">${p.displayName || p.slug}</div>
                        <div class="text-xs text-gray-500 truncate">${p.slug}</div>
                    </div>
                    <div class="ml-3 flex items-center gap-2">
                        <span class="px-2 py-0.5 text-xs rounded-full ${hasMappings ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">
                            ${p.productCount} ${p.productCount === 1 ? 'produkt' : 'produktów'}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        // Event listeners for project items
        pmProjectsList.querySelectorAll('.pm-project-item').forEach(item => {
            item.addEventListener('click', () => {
                const projectId = item.dataset.projectId;
                selectProductMappingProject(projectId);
            });
        });
    }

    async function selectProductMappingProject(projectId) {
        pmSelectedProjectId = projectId;
        renderProductMappingProjects(); // Re-render to show selection

        const project = pmAllProjects.find(p => p.id === projectId);
        if (!project) return;

        if (pmSelectedProjectName) pmSelectedProjectName.textContent = project.displayName || project.slug;
        if (pmAddProductBtn) pmAddProductBtn.classList.remove('hidden');

        if (pmProjectDetails) {
            pmProjectDetails.innerHTML = `
                <div class="flex items-center justify-center py-8">
                    <i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
                </div>
            `;
        }

        try {
            const response = await fetch(`/api/admin/gallery-projects/${projectId}/products`);
            const result = await response.json();

            if (result.status === 'success') {
                renderProjectProducts(result.data || [], project);
            } else {
                throw new Error(result.message || 'Błąd pobierania produktów');
            }
        } catch (error) {
            console.error('Błąd ładowania produktów projektu:', error);
            if (pmProjectDetails) {
                pmProjectDetails.innerHTML = `
                    <div class="text-center text-red-500 py-8">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>Nie udało się załadować produktów</p>
                    </div>
                `;
            }
        }
    }

    function renderProjectProducts(products, project) {
        if (!pmProjectDetails) return;

        if (products.length === 0) {
            pmProjectDetails.innerHTML = `
                <div class="flex flex-col items-center justify-center h-48 text-gray-400">
                    <i class="fas fa-box-open text-4xl mb-3"></i>
                    <p>Brak przypisanych produktów</p>
                    <p class="text-sm mt-1">Kliknij "Dodaj produkt", aby przypisać produkty do tego projektu</p>
                </div>
            `;
            return;
        }

        pmProjectDetails.innerHTML = `
            <table class="w-full text-left">
                <thead class="bg-gray-50 text-gray-600 uppercase text-xs font-semibold tracking-wider">
                    <tr>
                        <th class="p-3">Identyfikator</th>
                        <th class="p-3">Indeks</th>
                        <th class="p-3 text-right">Akcje</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 text-sm">
                    ${products.map(p => `
                        <tr class="hover:bg-gray-50">
                            <td class="p-3 font-medium text-gray-800">${p.identifier || '-'}</td>
                            <td class="p-3 text-gray-600">${p.index || '-'}</td>
                            <td class="p-3 text-right">
                                <button class="pm-remove-product text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                        data-product-id="${p.productId}" title="Usuń przypisanie">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Event listeners for remove buttons
        pmProjectDetails.querySelectorAll('.pm-remove-product').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const productId = btn.dataset.productId;
                if (confirm('Czy na pewno chcesz usunąć to przypisanie?')) {
                    await removeProductFromProject(project.id, productId);
                }
            });
        });
    }

    async function removeProductFromProject(projectId, productId) {
        try {
            const response = await fetch(`/api/admin/gallery-projects/${projectId}/products/${productId}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (result.status === 'success') {
                showAdminToast('Przypisanie usunięte', 'success');
                // Odśwież dane
                await loadProductMappingProjects();
                if (pmSelectedProjectId === projectId) {
                    selectProductMappingProject(projectId);
                }
            } else {
                throw new Error(result.message || 'Błąd usuwania');
            }
        } catch (error) {
            console.error('Błąd usuwania przypisania:', error);
            showAdminToast('Nie udało się usunąć przypisania: ' + error.message, 'error');
        }
    }

    function openProductMappingModal() {
        if (!pmModal || !pmSelectedProjectId) return;

        const project = pmAllProjects.find(p => p.id === pmSelectedProjectId);
        if (!project) return;

        if (pmModalProjectName) pmModalProjectName.value = project.displayName || project.slug;
        if (pmModalProjectId) pmModalProjectId.value = project.id;
        if (pmProductSelect) pmProductSelect.value = '';
        if (pmProductSearchInput) pmProductSearchInput.value = '';
        populateProductMappingSelect();

        pmModal.classList.remove('hidden');
    }

    function closeProductMappingModal() {
        if (pmModal) pmModal.classList.add('hidden');
    }

    async function handleProductMappingSave() {
        const projectId = pmModalProjectId?.value;
        const productId = pmProductSelect?.value;

        if (!projectId || !productId) {
            showAdminToast('Wybierz produkt do przypisania', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/admin/gallery-projects/${projectId}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId })
            });
            const result = await response.json();

            if (result.status === 'success') {
                showAdminToast('Produkt przypisany do projektu', 'success');
                closeProductMappingModal();
                // Odśwież dane
                await loadProductMappingProjects();
                if (pmSelectedProjectId === projectId) {
                    selectProductMappingProject(projectId);
                }
            } else {
                throw new Error(result.message || 'Błąd przypisywania');
            }
        } catch (error) {
            console.error('Błąd przypisywania produktu:', error);
            showAdminToast('Nie udało się przypisać produktu: ' + error.message, 'error');
        }
    }

});

// Funkcja sprawdzająca uprawnienia użytkownika i dostosowująca UI
async function checkUserPermissionsAndAdaptUI() {
    try {
        const response = await fetch('/api/auth/me');
        const result = await response.json();
        
        if (result.status === 'success') {
            const userRole = result.role;
            
            // Pokaż/ukryj elementy menu w zależności od roli
            const cityAccessLink = document.querySelector('[data-view="city-access"]');
            const folderAccessLink = document.querySelector('[data-view="folder-access"]');
            const usersLink = document.querySelector('[data-view="users"]');
            const productsLink = document.querySelector('[data-view="products"]');
            const ordersLink = document.querySelector('[data-view="orders"]');
            const productMappingLink = document.querySelector('[data-view="product-mapping"]');
            
            // Mapowanie produktów - tylko ADMIN
            if (productMappingLink) {
                if (userRole === 'ADMIN') {
                    productMappingLink.style.display = 'flex';
                } else {
                    productMappingLink.style.display = 'none';
                }
            }
            
            // Miejscowości PM - dostęp dla ADMIN, SALES_DEPT, GRAPHICS
            if (cityAccessLink) {
                if (['ADMIN', 'SALES_DEPT', 'GRAPHICS'].includes(userRole)) {
                    cityAccessLink.style.display = 'flex';
                } else {
                    cityAccessLink.style.display = 'none';
                }
            }
            
            // Foldery KI - dostęp dla ADMIN, SALES_DEPT
            if (folderAccessLink) {
                if (['ADMIN', 'SALES_DEPT'].includes(userRole)) {
                    folderAccessLink.style.display = 'flex';
                } else {
                    folderAccessLink.style.display = 'none';
                }
            }
            
            // Użytkownicy - tylko ADMIN
            if (usersLink) {
                if (userRole === 'ADMIN') {
                    usersLink.style.display = 'flex';
                } else {
                    usersLink.style.display = 'none';
                }
            }
            
            // Produkty - tylko ADMIN i WAREHOUSE (SALES_DEPT ma tylko podgląd magazynu)
            if (productsLink) {
                if (['ADMIN', 'WAREHOUSE'].includes(userRole)) {
                    productsLink.style.display = 'flex';
                } else {
                    productsLink.style.display = 'none';
                }
            }
            
            // Zamówienia - ADMIN, WAREHOUSE, PRODUCTION (SALES_DEPT używa głównego panelu zamówień)
            if (ordersLink) {
                if (['ADMIN', 'WAREHOUSE', 'PRODUCTION'].includes(userRole)) {
                    ordersLink.style.display = 'flex';
                } else {
                    ordersLink.style.display = 'none';
                }
            }
            
            // Klienci - ADMIN, SALES_DEPT
            const clientsLink = document.querySelector('[data-view="clients"]');
            if (clientsLink) {
                if (['ADMIN', 'SALES_DEPT'].includes(userRole)) {
                    clientsLink.style.display = 'flex';
                } else {
                    clientsLink.style.display = 'none';
                }
            }
            
            // Dla GRAPHICS - ukryj sidebar i pokaż tylko widok nieprzypisanych miejscowości
            if (userRole === 'GRAPHICS') {
                const sidebar = document.querySelector('aside');
                if (sidebar) {
                    sidebar.style.display = 'none';
                }
                
                const pageTitle = document.querySelector('h1');
                if (pageTitle) {
                    pageTitle.textContent = 'Nowe miejscowości do przypisania';
                }
                
                setTimeout(() => {
                    if (cityAccessLink) {
                        cityAccessLink.click();
                    }
                }, 100);
            }
            
            // Dla SALES_DEPT - ograniczony dostęp
            if (userRole === 'SALES_DEPT') {
                // Ukryj przyciski dodawania użytkowników
                const newUserBtn = document.getElementById('new-user-btn');
                if (newUserBtn) newUserBtn.style.display = 'none';
                
                // Zmień tytuł strony
                const pageTitle = document.querySelector('h1');
                if (pageTitle) {
                    pageTitle.textContent = 'Panel Działu Sprzedaży';
                }
                
                // Automatycznie przejdź do widoku Miejscowości PM
                setTimeout(() => {
                    if (cityAccessLink) {
                        cityAccessLink.click();
                    }
                }, 100);
            }
        }
    } catch (error) {
        console.error('Błąd sprawdzania uprawnień:', error);
    }
}

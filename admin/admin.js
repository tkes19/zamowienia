// Globalna funkcja escapeHtml - używana w całym pliku
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Globalna funkcja showAdminToast - używana w module produkcyjnym
function showAdminToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('admin-toast-container');
    if (!container) {
        console.log(`[Toast ${type}] ${message}`);
        return;
    }
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

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

    // Delivery presets module elements
    const deliveryPresetsTbody = document.getElementById('delivery-presets-tbody');
    const deliveryPresetsTotal = document.getElementById('delivery-presets-total');
    const deliveryPresetsActive = document.getElementById('delivery-presets-active');
    const deliveryPresetsDefaultLabel = document.getElementById('delivery-presets-default-label');
    const newDeliveryPresetBtn = document.getElementById('new-delivery-preset-btn');
    const refreshDeliveryPresetsBtn = document.getElementById('refresh-delivery-presets-btn');
    const deliveryPresetModal = document.getElementById('delivery-preset-modal');
    const deliveryPresetModalTitle = document.getElementById('delivery-preset-modal-title');
    const deliveryPresetModalClose = document.getElementById('delivery-preset-modal-close');
    const deliveryPresetForm = document.getElementById('delivery-preset-form');
    const deliveryPresetFormCancel = document.getElementById('delivery-preset-form-cancel');
    const deliveryPresetFormError = document.getElementById('delivery-preset-form-error');
    const deliveryPresetSubmitText = document.getElementById('delivery-preset-submit-text');

    let allProducts = [];
    let filteredProducts = [];
    let currentEditingProductId = null;
    let currentInventoryProductId = null;
    let deliveryPresets = [];
    let editingDeliveryPreset = null;

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

    if (newDeliveryPresetBtn) {
        newDeliveryPresetBtn.addEventListener('click', () => openDeliveryPresetModal());
    }

    if (refreshDeliveryPresetsBtn) {
        refreshDeliveryPresetsBtn.addEventListener('click', () => loadDeliveryPresets());
    }

    if (deliveryPresetModalClose) {
        deliveryPresetModalClose.addEventListener('click', closeDeliveryPresetModal);
    }

    if (deliveryPresetFormCancel) {
        deliveryPresetFormCancel.addEventListener('click', (e) => {
            e.preventDefault();
            closeDeliveryPresetModal();
        });
    }

    if (deliveryPresetForm) {
        deliveryPresetForm.addEventListener('submit', handleDeliveryPresetSubmit);
    }

    if (deliveryPresetsTbody) {
        deliveryPresetsTbody.addEventListener('click', handleDeliveryPresetsTableClick);
    }

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

            const mainLabel = product.identifier || product.name || '-';
            const mainLabelSafe = escapeHtml(mainLabel);
            const indexSafe = escapeHtml(product.index || '-');
            const categoryLabelSafe = escapeHtml(formatCategory(product.category || 'Inne'));
            const imageUrlSafe = imageUrl ? escapeHtml(imageUrl) : '';

            return `
                <tr class="hover:bg-gray-50 transition-colors" data-product-id="${product.id}">
                    <td class="p-4">
                        <div class="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200">
                            ${imageUrl 
                                ? `<img src="${imageUrlSafe}" alt="" class="w-full h-full object-cover">` 
                                : `<i class="fas fa-image text-gray-300 text-xl"></i>`
                            }
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="font-medium text-gray-900 flex items-center flex-wrap gap-1">
                            ${mainLabelSafe}
                            ${isNew}
                        </div>
                        <div class="text-xs text-gray-500 font-mono mt-0.5">${indexSafe}</div>
                    </td>
                    <td class="p-4">
                        <span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                            ${categoryLabelSafe}
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
        const safeMessage = escapeHtml(message || 'Wystąpił błąd');
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="p-8 text-center text-red-500">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fas fa-exclamation-circle text-2xl"></i>
                        <span>${safeMessage}</span>
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

    // ============================================
    // MODUŁ: PRESETY TERMINÓW DOSTAWY
    // ============================================

    async function loadDeliveryPresets() {
        if (!deliveryPresetsTbody) return;

        deliveryPresetsTbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-gray-500">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
                        <span>Ładowanie presetów terminów dostawy...</span>
                    </div>
                </td>
            </tr>
        `;

        try {
            const response = await fetch('/api/admin/order-delivery-presets');
            const result = await response.json();

            if (response.ok && result.status === 'success') {
                deliveryPresets = result.data || [];
                renderDeliveryPresetsTable();
                updateDeliveryPresetsStats();
            } else {
                throw new Error(result.message || 'Nie udało się pobrać presetów');
            }
        } catch (error) {
            console.error('Błąd ładowania presetów terminów:', error);
            deliveryPresetsTbody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-red-500">
                        <div class="flex flex-col items-center gap-2">
                            <i class="fas fa-exclamation-triangle text-2xl"></i>
                            <span>${escapeHtml(error.message || 'Błąd połączenia z serwerem')}</span>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    function renderDeliveryPresetsTable() {
        if (!deliveryPresetsTbody) return;

        if (!deliveryPresets.length) {
            deliveryPresetsTbody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-gray-500">
                        <div class="flex flex-col items-center gap-2">
                            <i class="fas fa-calendar-times text-3xl text-gray-300"></i>
                            <span>Brak skonfigurowanych presetów terminów dostawy</span>
                            <button class="text-blue-600 hover:underline text-sm" id="delivery-presets-empty-add-btn">
                                Dodaj pierwszy preset
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            const emptyBtn = document.getElementById('delivery-presets-empty-add-btn');
            if (emptyBtn) {
                emptyBtn.addEventListener('click', () => openDeliveryPresetModal());
            }
            return;
        }

        deliveryPresetsTbody.innerHTML = deliveryPresets
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map(preset => {
                const isDefault = preset.isDefault;
                const isActive = preset.isActive;
                const modeLabel = preset.mode === 'FIXED_DATE' ? 'Stała data' : 'Offset dni';
                const valueLabel = preset.mode === 'FIXED_DATE'
                    ? (preset.fixedDate ? new Date(preset.fixedDate).toLocaleDateString('pl-PL') : '—')
                    : `${preset.offsetDays ?? '—'} dni`;

                return `
                    <tr class="hover:bg-gray-50 transition-colors ${!isActive ? 'opacity-60' : ''}">
                        <td class="p-4">
                            <div class="font-semibold text-gray-900">${escapeHtml(preset.label || 'Bez nazwy')}</div>
                        </td>
                        <td class="p-4 text-sm">
                            <span class="px-2 py-1 rounded-full text-xs font-medium ${preset.mode === 'FIXED_DATE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                                ${modeLabel}
                            </span>
                        </td>
                        <td class="p-4 text-sm text-gray-700">${escapeHtml(valueLabel)}</td>
                        <td class="p-4 text-center">
                            ${isDefault
                                ? '<span class="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700 font-semibold">Domyślny</span>'
                                : '<span class="text-gray-400">—</span>'}
                        </td>
                        <td class="p-4 text-center">
                            ${isActive
                                ? '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-semibold">Aktywny</span>'
                                : '<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-500">Nieaktywny</span>'}
                        </td>
                        <td class="p-4 text-center text-sm font-mono text-gray-600">${preset.sortOrder ?? '—'}</td>
                        <td class="p-4">
                            <div class="flex justify-end gap-2 text-sm">
                                <button class="delivery-preset-edit-btn px-2 py-1 text-blue-600 hover:text-blue-800" data-id="${preset.id}" title="Edytuj">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="delivery-preset-delete-btn px-2 py-1 text-red-600 hover:text-red-800" data-id="${preset.id}" title="Usuń">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
    }

    function updateDeliveryPresetsStats() {
        if (deliveryPresetsTotal) deliveryPresetsTotal.textContent = deliveryPresets.length;
        if (deliveryPresetsActive) deliveryPresetsActive.textContent = deliveryPresets.filter(p => p.isActive).length;

        if (deliveryPresetsDefaultLabel) {
            const defaultPreset = deliveryPresets.find(p => p.isDefault);
            deliveryPresetsDefaultLabel.textContent = defaultPreset?.label || 'Brak';
        }
    }

    function openDeliveryPresetModal(preset = null) {
        if (!deliveryPresetModal || !deliveryPresetForm) return;

        editingDeliveryPreset = preset;
        deliveryPresetForm.reset();
        hideDeliveryPresetError();

        deliveryPresetForm.elements['id'].value = preset?.id || '';
        deliveryPresetForm.elements['label'].value = preset?.label || '';
        deliveryPresetForm.elements['mode'].value = preset?.mode || 'OFFSET';
        deliveryPresetForm.elements['offsetDays'].value = preset?.offsetDays ?? '';
        deliveryPresetForm.elements['fixedDate'].value = preset?.fixedDate ? preset.fixedDate.split('T')[0] : '';
        deliveryPresetForm.elements['sortOrder'].value = preset?.sortOrder ?? '';
        deliveryPresetForm.elements['isDefault'].checked = preset?.isDefault ?? false;
        deliveryPresetForm.elements['isActive'].checked = preset?.isActive ?? true;

        if (deliveryPresetModalTitle) {
            deliveryPresetModalTitle.textContent = preset ? 'Edytuj preset terminu' : 'Nowy preset terminu';
        }
        if (deliveryPresetSubmitText) {
            deliveryPresetSubmitText.textContent = preset ? 'Zapisz zmiany' : 'Utwórz preset';
        }

        deliveryPresetModal.classList.remove('hidden');
    }

    function closeDeliveryPresetModal() {
        if (deliveryPresetModal) {
            deliveryPresetModal.classList.add('hidden');
        }
        editingDeliveryPreset = null;
        hideDeliveryPresetError();
    }

    function hideDeliveryPresetError() {
        if (deliveryPresetFormError) {
            deliveryPresetFormError.classList.add('hidden');
            const span = deliveryPresetFormError.querySelector('span');
            if (span) span.textContent = '';
        }
    }

    function showDeliveryPresetError(message) {
        if (!deliveryPresetFormError) return;
        const span = deliveryPresetFormError.querySelector('span');
        if (span) span.textContent = message;
        deliveryPresetFormError.classList.remove('hidden');
    }

    async function handleDeliveryPresetSubmit(e) {
        e.preventDefault();
        if (!deliveryPresetForm) return;
        hideDeliveryPresetError();

        const formData = new FormData(deliveryPresetForm);
        const id = formData.get('id');
        const mode = formData.get('mode') || 'OFFSET';

        const payload = {
            label: formData.get('label')?.trim(),
            mode,
            offsetDays: formData.get('offsetDays') ? Number(formData.get('offsetDays')) : null,
            fixedDate: formData.get('fixedDate') || null,
            sortOrder: formData.get('sortOrder') ? Number(formData.get('sortOrder')) : null,
            isDefault: deliveryPresetForm.elements['isDefault'].checked,
            isActive: deliveryPresetForm.elements['isActive'].checked,
        };

        if (!payload.label) {
            showDeliveryPresetError('Podaj nazwę preset-u');
            return;
        }

        if (mode === 'OFFSET' && (payload.offsetDays === null || Number.isNaN(payload.offsetDays))) {
            showDeliveryPresetError('Podaj liczbę dni dla trybu OFFSET');
            return;
        }

        if (mode === 'FIXED_DATE' && !payload.fixedDate) {
            showDeliveryPresetError('Wybierz datę dla trybu FIXED_DATE');
            return;
        }

        if (payload.fixedDate) {
            payload.fixedDate = new Date(payload.fixedDate).toISOString();
        }

        setDeliveryPresetFormLoading(true);

        try {
            const url = id ? `/api/admin/order-delivery-presets/${id}` : '/api/admin/order-delivery-presets';
            const method = id ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();

            if (response.ok && result.status === 'success') {
                closeDeliveryPresetModal();
                await loadDeliveryPresets();
            } else {
                throw new Error(result.message || 'Nie udało się zapisać preset-u');
            }
        } catch (error) {
            console.error('Błąd zapisu preset-u:', error);
            showDeliveryPresetError(error.message || 'Błąd połączenia z serwerem');
        } finally {
            setDeliveryPresetFormLoading(false);
        }
    }

    function setDeliveryPresetFormLoading(isLoading) {
        const submitBtn = deliveryPresetForm?.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = isLoading;
        if (deliveryPresetSubmitText) {
            deliveryPresetSubmitText.textContent = isLoading
                ? 'Zapisywanie...'
                : (editingDeliveryPreset ? 'Zapisz zmiany' : 'Utwórz preset');
        }
    }

    async function handleDeliveryPresetsTableClick(e) {
        const editBtn = e.target.closest('.delivery-preset-edit-btn');
        const deleteBtn = e.target.closest('.delivery-preset-delete-btn');

        if (editBtn) {
            const presetId = editBtn.dataset.id;
            const preset = deliveryPresets.find(p => p.id == presetId);
            if (preset) {
                openDeliveryPresetModal(preset);
            }
            return;
        }

        if (deleteBtn) {
            const presetId = deleteBtn.dataset.id;
            if (!confirm('Czy na pewno chcesz usunąć ten preset terminu?')) return;
            await deleteDeliveryPreset(presetId);
        }
    }

    async function deleteDeliveryPreset(id) {
        try {
            const response = await fetch(`/api/admin/order-delivery-presets/${id}`, { method: 'DELETE' });
            const result = await response.json();

            if (response.ok && result.status === 'success') {
                await loadDeliveryPresets();
            } else {
                throw new Error(result.message || 'Nie udało się usunąć preset-u');
            }
        } catch (error) {
            console.error('Błąd usuwania preset-u:', error);
            showAdminToast(error.message || 'Błąd usuwania preset-u', 'error');
        }
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
                const safeMessage = escapeHtml(json.message || 'Nie udało się pobrać użytkowników');
                usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="p-8 text-center text-red-600">
                            Błąd: ${safeMessage}
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
            const nameSafe = escapeHtml(user.name || '-');
            const emailSafe = escapeHtml(user.email || '');
            const roleLabelSafe = escapeHtml(roleLabel);
            const departmentSafe = escapeHtml(user.departmentName || '-');

            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="p-4 font-medium text-gray-900">${nameSafe}</td>
                    <td class="p-4 text-gray-600">${emailSafe}</td>
                    <td class="p-4">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">${roleLabelSafe}</span>
                    </td>
                    <td class="p-4 text-gray-600">${departmentSafe}</td>
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
            userForm.querySelector('[name="productionRoomId"]').value = user.productionroomid || '';
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
        populateProductionRoomSelect();
        handleRoleChange(); // Ustaw widoczność pola pokoju
        userModal.classList.remove('hidden');
    }

    function handleRoleChange() {
        const roleSelect = userForm.querySelector('[name="role"]');
        const roomField = document.getElementById('production-room-field');
        const multiRolesSection = document.getElementById('multi-roles-section');
        const role = roleSelect.value;
        
        // Pokaż/ukryj pole pokoju produkcyjnego
        if (['PRODUCTION', 'OPERATOR', 'PRODUCTION_MANAGER'].includes(role)) {
            roomField.classList.remove('hidden');
        } else {
            roomField.classList.add('hidden');
            userForm.querySelector('[name="productionRoomId"]').value = '';
        }
        
        // Pokaż/ukryj sekcję wieloról (tylko w trybie edycji i dla ról nie-ADMIN)
        if (currentEditingUserId && role !== 'ADMIN' && role !== 'NEW_USER') {
            multiRolesSection?.classList.remove('hidden');
            // Zaznacz checkbox głównej roli w wielorolach
            const mainRoleCheckbox = multiRolesSection?.querySelector(`input[value="${role}"]`);
            if (mainRoleCheckbox) {
                mainRoleCheckbox.checked = true;
                mainRoleCheckbox.disabled = true;
            }
            // Włącz pozostałe checkboxy
            multiRolesSection?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb.value !== role) {
                    cb.disabled = false;
                }
            });
            // Załaduj wielorole użytkownika
            loadUserMultiRoles(currentEditingUserId);
        } else {
            multiRolesSection?.classList.add('hidden');
        }
    }
    
    /**
     * Ładuje wielorole użytkownika z API i zaznacza odpowiednie checkboxy
     */
    async function loadUserMultiRoles(userId) {
        const multiRolesSection = document.getElementById('multi-roles-section');
        if (!multiRolesSection || !userId) return;
        
        try {
            const response = await fetch(`/api/admin/user-role-assignments?userId=${userId}`, {
                credentials: 'include'
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                const activeRoles = (result.data.assignments || [])
                    .filter(a => a.isActive)
                    .map(a => a.role);
                
                // Zaznacz checkboxy dla aktywnych ról
                multiRolesSection.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = activeRoles.includes(cb.value);
                });
            }
        } catch (error) {
            console.error('Błąd ładowania wieloról:', error);
        }
    }

    async function populateProductionRoomSelect() {
        const select = userForm.querySelector('[name="productionRoomId"]');
        const currentVal = select.value;
        
        select.innerHTML = '<option value="">Brak przypisanego pokoju</option>';
        
        try {
            if (!productionRooms || productionRooms.length === 0) {
                const response = await fetch('/api/production/rooms', { credentials: 'include' });
                const result = await response.json();
                if (result.status === 'success') {
                    productionRooms = result.data || [];
                }
            }
            
            productionRooms.forEach(room => {
                const opt = document.createElement('option');
                opt.value = room.id;
                opt.textContent = room.name;
                select.appendChild(opt);
            });
            
            if (currentVal) select.value = currentVal;
        } catch (e) {
            console.error('Błąd ładowania pokojów do formularza:', e);
        }
    }

    // Event listener dla zmiany roli
    if (userForm) {
        const roleSelect = userForm.querySelector('[name="role"]');
        if (roleSelect) roleSelect.addEventListener('change', handleRoleChange);
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
            productionRoomId: formData.get('productionRoomId') || null,
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
                // Zapisz wielorole jeśli są zaznaczone
                if (currentEditingUserId) {
                    await saveUserMultiRoles(currentEditingUserId);
                }
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

    /**
     * Zapisuje wielorole użytkownika do API (synchronizacja)
     */
    async function saveUserMultiRoles(userId) {
        const multiRolesSection = document.getElementById('multi-roles-section');
        if (!multiRolesSection || multiRolesSection.classList.contains('hidden')) return;
        
        const selectedRoles = [];
        multiRolesSection.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            selectedRoles.push(cb.value);
        });
        
        try {
            await fetch(`/api/admin/user-role-assignments/sync/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ roles: selectedRoles })
            });
        } catch (error) {
            console.error('Błąd zapisywania wieloról:', error);
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
    
    // Przełącznik widoku statusów: 'pills' (pigułki) lub 'dropdown' (lista)
    let statusViewMode = localStorage.getItem('statusViewMode') || 'dropdown';
    const statusViewPillsBtn = document.getElementById('status-view-pills');
    const statusViewDropdownBtn = document.getElementById('status-view-dropdown');
    
    // Inicjalizacja przełącznika widoku statusów
    function initStatusViewToggle() {
        updateStatusViewButtons();
        
        statusViewPillsBtn?.addEventListener('click', () => {
            statusViewMode = 'pills';
            localStorage.setItem('statusViewMode', 'pills');
            updateStatusViewButtons();
            renderOrdersTable();
        });
        
        statusViewDropdownBtn?.addEventListener('click', () => {
            statusViewMode = 'dropdown';
            localStorage.setItem('statusViewMode', 'dropdown');
            updateStatusViewButtons();
            renderOrdersTable();
        });
    }
    
    function updateStatusViewButtons() {
        statusViewPillsBtn?.classList.toggle('active', statusViewMode === 'pills');
        statusViewDropdownBtn?.classList.toggle('active', statusViewMode === 'dropdown');
    }

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
            { from: 'PENDING', to: 'APPROVED' },
            // SALES_DEPT NIE może: APPROVED → IN_PRODUCTION (to robi produkcja/operator)
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
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
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
            const optionsHtml = users.map(u => {
                const idSafe = escapeHtml(String(u.id));
                const shortCodeSafe = escapeHtml(u.shortCode || '');
                const nameSafe = escapeHtml(u.name || '');
                return `<option value="${idSafe}">${shortCodeSafe} - ${nameSafe}</option>`;
            }).join('');
            ordersUserFilter.innerHTML = '<option value="">Wszyscy handlowcy</option>' + optionsHtml;
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
            ordersTableBody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-gray-500">Brak zamówień</td></tr>';
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
            const statusLabelSafe = escapeHtml(statusLabel);
            const orderNumberSafe = escapeHtml(order.orderNumber || '');
            const customerNameSafe = escapeHtml(order.Customer?.name || '-');
            const userShortSafe = escapeHtml(order.User?.shortCode || '-');

            // Generuj HTML statusu w zależności od trybu widoku
            let statusContent;
            if (!canSelectStatus) {
                // Brak możliwości zmiany - tylko badge
                statusContent = `<span class="px-3 py-1 rounded-full text-xs font-medium ${statusClass}">${statusLabelSafe}</span>`;
            } else if (statusViewMode === 'pills') {
                // Tryb pigułek - wszystkie statusy jako klikalne elementy
                const allStatuses = Object.keys(STATUS_LABELS);
                statusContent = `<div class="status-pills" data-order-id="${order.id}" onclick="event.stopPropagation()">
                    ${allStatuses.map(s => {
                        const sClass = STATUS_CLASSES[s] || 'bg-gray-100 text-gray-800';
                        const sLabel = escapeHtml(STATUS_LABELS[s] || s);
                        const isCurrent = s === order.status;
                        const isAllowed = allowedTransitions.includes(s);
                        const pillClass = isCurrent ? 'current' : (isAllowed ? 'allowed' : '');
                        const clickable = isAllowed && !isCurrent;
                        return `<span class="status-pill ${sClass} ${pillClass}" 
                            data-status="${s}" 
                            ${clickable ? `data-order-id="${order.id}" data-clickable="true"` : ''}
                            title="${isCurrent ? 'Aktualny status' : (isAllowed ? 'Kliknij aby zmienić' : 'Niedostępne')}"
                        >${sLabel}</span>`;
                    }).join('')}
                </div>`;
            } else {
                // Tryb listy rozwijanej (domyślny) - styl jak przycisk z wypełnionym tłem
                statusContent = `<select class="order-status-select" data-status="${order.status}" data-order-id="${order.id}" data-original-status="${order.status}" onclick="event.stopPropagation()">
                        ${[order.status, ...allowedTransitions]
                            .filter((s, i, arr) => arr.indexOf(s) === i)
                            .map(s => {
                                const optionLabel = escapeHtml(STATUS_LABELS[s] || s);
                                return `<option value="${s}" ${s === order.status ? 'selected' : ''}>${optionLabel}</option>`;
                            }).join('')}
                   </select>`;
            }

            const canDelete = currentUserRole === 'ADMIN';
            const deleteBtn = canDelete
                ? `<button class="text-red-600 hover:text-red-800 p-1" data-action="delete" data-order-id="${order.id}" data-order-number="${orderNumberSafe}" title="Usuń zamówienie"><i class="fas fa-trash"></i></button>`
                : '';

            const canEdit = currentUserRole === 'ADMIN';
            const editBtn = canEdit
                ? `<button class="text-green-600 hover:text-green-800 p-1" data-action="edit" data-order-id="${order.id}" title="Edytuj zamówienie"><i class="fas fa-edit"></i></button>`
                : '';

            // Kolumna produkcji z paskiem postępu
            let productionHtml = '<span class="text-gray-400 text-xs">-</span>';
            if (order.productionProgress) {
                const pp = order.productionProgress;
                const barColor = pp.percent === 100 ? 'bg-green-500' : pp.percent > 0 ? 'bg-amber-500' : 'bg-blue-500';
                productionHtml = `
                    <div class="flex items-center gap-2 min-w-[100px]">
                        <div class="flex-1 bg-gray-200 rounded-full h-2">
                            <div class="${barColor} h-2 rounded-full transition-all" style="width: ${pp.percent}%"></div>
                        </div>
                        <span class="text-xs font-medium text-gray-600 whitespace-nowrap">${pp.label}</span>
                    </div>
                `;
            } else if (order.status === 'PENDING') {
                productionHtml = '<span class="text-gray-400 text-xs">Oczekuje</span>';
            }

            return `
                <tr class="hover:bg-gray-50 cursor-pointer order-row" data-order-id="${order.id}">
                    <td class="p-4 w-8"><i class="fas fa-chevron-right chevron-icon text-gray-400" data-order-id="${order.id}"></i></td>
                    <td class="p-4 font-semibold text-blue-600">${orderNumberSafe}</td>
                    <td class="p-4">${date}</td>
                    <td class="p-4">${customerNameSafe}</td>
                    <td class="p-4">${userShortSafe}</td>
                    <td class="p-4">${statusContent}</td>
                    <td class="p-4">${productionHtml}</td>
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

        // Attach status change listeners - dla listy rozwijanej
        ordersTableBody.querySelectorAll('.order-status-select').forEach(select => {
            select.addEventListener('change', handleInlineStatusChange);
        });
        
        // Attach status change listeners - dla pigułek
        ordersTableBody.querySelectorAll('.status-pill[data-clickable="true"]').forEach(pill => {
            pill.addEventListener('click', handlePillStatusChange);
        });
    }
    
    // Obsługa kliknięcia w pigułkę statusu
    async function handlePillStatusChange(e) {
        e.stopPropagation();
        const pill = e.target.closest('.status-pill');
        if (!pill) return;
        
        const orderId = pill.dataset.orderId;
        const newStatus = pill.dataset.status;
        if (!orderId || !newStatus) return;
        
        // Znajdź zamówienie
        const order = allAdminOrders.find(o => o.id === orderId);
        if (!order || order.status === newStatus) return;
        
        // Wizualne oznaczenie ładowania
        const pillsContainer = pill.closest('.status-pills');
        if (pillsContainer) {
            pillsContainer.style.opacity = '0.5';
            pillsContainer.style.pointerEvents = 'none';
        }
        
        try {
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Błąd zmiany statusu');
            }
            
            // Aktualizuj lokalnie
            order.status = newStatus;
            showAdminToast(`Status zmieniony na: ${STATUS_LABELS[newStatus]}`, 'success');
            renderOrdersTable();
        } catch (error) {
            console.error('Błąd zmiany statusu:', error);
            showAdminToast(error.message || 'Nie udało się zmienić statusu', 'error');
            if (pillsContainer) {
                pillsContainer.style.opacity = '1';
                pillsContainer.style.pointerEvents = 'auto';
            }
        }
    }

    // Handle order row click for inline details
    async function handleOrderRowClick(e) {
        const row = e.target.closest('.order-row');
        if (!row) return;

        // Ignore clicks on buttons, selects, status pills
        if (e.target.closest('button') || e.target.closest('select') || e.target.closest('.status-pills')) return;

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
            // Pobierz szczegóły zamówienia i zlecenia produkcyjne równolegle
            const [orderResponse, prodOrdersResponse] = await Promise.all([
                fetch(`/api/orders/${orderId}`, { credentials: 'include' }),
                fetch(`/api/production/orders?sourceOrderId=${orderId}`, { credentials: 'include' })
            ]);
            
            if (!orderResponse.ok) throw new Error('Nie udało się pobrać szczegółów');

            const result = await orderResponse.json();
            const fullOrder = result.data;
            
            // Pobierz zlecenia produkcyjne (może być puste)
            let productionOrders = [];
            if (prodOrdersResponse.ok) {
                const prodResult = await prodOrdersResponse.json();
                productionOrders = prodResult.data || [];
            }

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

                const productLabelSafe = escapeHtml(productLabel);
                const projectsDisplaySafe = escapeHtml(projectsDisplay);
                const locationDisplaySafe = escapeHtml(locationDisplay);
                const notesDisplaySafe = escapeHtml(notesDisplay);
                
                return `
                <tr class="border-b border-indigo-100 hover:bg-indigo-100 transition-colors">
                    <td class="p-2 text-xs font-medium text-gray-800">${productLabelSafe}</td>
                    <td class="p-2 text-xs text-gray-700">${projectsDisplaySafe}</td>
                    <td class="p-2 text-xs text-center text-gray-700">${item.quantity}</td>
                    <td class="p-2 text-xs text-right text-gray-700">${(item.unitPrice || 0).toFixed(2)} zł</td>
                    <td class="p-2 text-xs text-right font-semibold text-gray-900">${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)} zł</td>
                    <td class="p-2 text-xs text-gray-700">${sourceBadge}${locationDisplaySafe}</td>
                    <td class="p-2 text-xs text-gray-600 italic">${notesDisplaySafe}</td>
                </tr>`;
            }).join('');

            const canEditNotes = ['ADMIN', 'SALES_DEPT'].includes(currentUserRole);
            const createdDate = new Date(fullOrder.createdAt).toLocaleString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            const updatedDate = fullOrder.updatedAt ? new Date(fullOrder.updatedAt).toLocaleString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
            const creatorName = fullOrder.User ? (fullOrder.User.name || fullOrder.User.shortCode || '') : '';
            const creatorNameSafe = creatorName ? escapeHtml(creatorName) : '';
            const statusLabelFull = STATUS_LABELS[fullOrder.status] || fullOrder.status;
            const statusLabelFullSafe = escapeHtml(statusLabelFull);
            const notesText = fullOrder.notes || '';
            const notesSafe = escapeHtml(notesText);
            const notesDisplaySafe = notesText ? notesSafe : 'Brak notatek';

            const timelineHtml = `
                <div class="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                    <div class="flex items-center gap-1"><i class="fas fa-plus-circle text-green-500"></i><span>Utworzono: <strong class="text-gray-700">${createdDate}</strong></span>${fullOrder.User ? `<span class="text-gray-400">przez ${creatorNameSafe}</span>` : ''}</div>
                    ${updatedDate && updatedDate !== createdDate ? `<div class="flex items-center gap-1"><i class="fas fa-edit text-blue-500"></i><span>Aktualizacja: <strong class="text-gray-700">${updatedDate}</strong></span></div>` : ''}
                    <div class="flex items-center gap-1"><i class="fas fa-tag text-gray-500"></i><span>Status: <strong class="text-gray-700">${statusLabelFullSafe}</strong></span></div>
                </div>`;

            // Sekcja zleceń produkcyjnych
            let productionOrdersHtml = '';
            if (productionOrders.length > 0) {
                const prodOrdersRows = productionOrders.map(po => {
                    const poNumber = po.ordernumber || '-';
                    const poProduct = po.product?.identifier || po.product?.name || '-';
                    const poPath = po.pathNames || po.productionpathexpression || '-';
                    const poProgress = po.progress || { label: '0/0', percent: 0 };
                    const poCurrentStep = po.currentStep?.label || (po.currentStep?.phase === 'DONE' ? 'Zakończone' : '-');
                    const poStatus = po.status || 'planned';
                    
                    const statusLabels = { planned: 'Zaplanowane', approved: 'Zatwierdzone', in_progress: 'W realizacji', completed: 'Zakończone', cancelled: 'Anulowane' };
                    const statusClasses = { planned: 'bg-blue-100 text-blue-800', approved: 'bg-indigo-100 text-indigo-800', in_progress: 'bg-amber-100 text-amber-800', completed: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800' };
                    const poStatusLabel = statusLabels[poStatus] || poStatus;
                    const poStatusClass = statusClasses[poStatus] || 'bg-gray-100 text-gray-800';
                    
                    const progressBarColor = poStatus === 'completed' ? 'bg-green-500' : poStatus === 'cancelled' ? 'bg-red-300' : poProgress.percent > 0 ? 'bg-amber-500' : 'bg-blue-500';
                    
                    return `
                        <tr class="border-b border-amber-100 hover:bg-amber-50 transition-colors">
                            <td class="p-2 text-xs font-medium text-gray-800">${escapeHtml(poNumber)}</td>
                            <td class="p-2 text-xs text-gray-700">${escapeHtml(poProduct)}</td>
                            <td class="p-2 text-xs text-purple-700">${escapeHtml(poPath)}</td>
                            <td class="p-2 text-xs text-gray-700">${escapeHtml(poCurrentStep)}</td>
                            <td class="p-2 text-xs">
                                <div class="flex items-center gap-1">
                                    <div class="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[40px]">
                                        <div class="${progressBarColor} h-1.5 rounded-full" style="width: ${poProgress.percent}%"></div>
                                    </div>
                                    <span class="text-gray-600">${poProgress.label}</span>
                                </div>
                            </td>
                            <td class="p-2 text-xs text-center">
                                <span class="px-2 py-0.5 rounded text-xs font-medium ${poStatusClass}">${poStatusLabel}</span>
                            </td>
                        </tr>`;
                }).join('');
                
                productionOrdersHtml = `
                    <div class="border border-amber-200 rounded-lg overflow-hidden bg-white mt-3">
                        <div class="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center gap-2">
                            <i class="fas fa-industry text-amber-600"></i>
                            <span class="font-semibold text-amber-800 text-xs">Zlecenia produkcyjne (${productionOrders.length})</span>
                        </div>
                        <table class="w-full text-xs">
                            <thead class="bg-amber-100 border-b border-amber-200">
                                <tr>
                                    <th class="p-2 text-left font-semibold text-gray-800 text-xs">Nr zlecenia</th>
                                    <th class="p-2 text-left font-semibold text-gray-800 text-xs">Produkt</th>
                                    <th class="p-2 text-left font-semibold text-gray-800 text-xs">Ścieżka</th>
                                    <th class="p-2 text-left font-semibold text-gray-800 text-xs">Aktualny etap</th>
                                    <th class="p-2 text-left font-semibold text-gray-800 text-xs">Postęp</th>
                                    <th class="p-2 text-center font-semibold text-gray-800 text-xs">Status</th>
                                </tr>
                            </thead>
                            <tbody>${prodOrdersRows}</tbody>
                        </table>
                    </div>`;
            }

            detailsRow.innerHTML = `
                <td colspan="9" class="p-0">
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
                        ${productionOrdersHtml}
                        <div class="flex gap-3 items-end">
                            <div class="flex-1">
                                ${canEditNotes ? `<textarea id="order-notes-${orderId}" class="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" rows="2" placeholder="Notatki...">${notesSafe}</textarea>` : `<div class="p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 max-h-16 overflow-y-auto">${notesDisplaySafe}</div>`}
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
        
        // Natychmiast aktualizuj kolor przycisku
        select.dataset.status = newStatus;
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

                const productLabelSafe = escapeHtml(productLabel);
                const projectsDisplaySafe = escapeHtml(projectsDisplay);
                const locationDisplaySafe = escapeHtml(locationDisplay);
                const notesDisplaySafe = escapeHtml(notesDisplay);
                const sourcePrefixSafe = escapeHtml(sourcePrefix);
                
                return `<tr><td style="font-size:8px;">${productLabelSafe}</td><td style="font-size:8px;">${projectsDisplaySafe}</td><td style="text-align:center;font-size:8px;">${item.quantity}</td><td style="text-align:right;font-size:8px;">${(item.unitPrice || 0).toFixed(2)} zł</td><td style="text-align:right;font-size:8px;">${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)} zł</td><td style="font-size:8px;">${sourcePrefixSafe}${locationDisplaySafe}</td><td style="font-size:7px;font-style:italic;color:#666;">${notesDisplaySafe}</td></tr>`;
            }).join('');

            const createdDate = new Date(order.createdAt).toLocaleString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            const orderNumberSafe = escapeHtml(order.orderNumber || '');
            const statusLabelPrint = STATUS_LABELS[order.status] || order.status;
            const statusLabelPrintSafe = escapeHtml(statusLabelPrint);
            const customerNamePrintSafe = escapeHtml(order.Customer?.name || '-');
            const userNamePrint = order.User?.name || order.User?.shortCode || '-';
            const userNamePrintSafe = escapeHtml(userNamePrint);
            const notesPrintSafe = order.notes ? escapeHtml(order.notes) : '';

            const printHtml = `
                <div class="print-document">
                    <div class="print-header">
                        <div><div class="print-company">ZAMÓWIENIA</div><div class="print-title">Zamówienie ${orderNumberSafe}</div></div>
                        <div class="print-meta"><div>Data: ${createdDate}</div><div>Status: ${statusLabelPrintSafe}</div></div>
                    </div>
                    <div class="print-section">
                        <div class="print-grid">
                            <div class="print-field"><div class="print-field-label">Klient</div><div class="print-field-value">${customerNamePrintSafe}</div></div>
                            <div class="print-field"><div class="print-field-label">Handlowiec</div><div class="print-field-value">${userNamePrintSafe}</div></div>
                        </div>
                    </div>
                    <div class="print-section">
                        <div class="print-section-title">Pozycje</div>
                        <table class="print-table"><thead><tr><th style="font-size:8px;">Produkt</th><th style="font-size:8px;">Projekty</th><th style="text-align:center;font-size:8px;">Ilość</th><th style="text-align:right;font-size:8px;">Cena j.</th><th style="text-align:right;font-size:8px;">Wartość</th><th style="font-size:8px;">Lokalizacja</th><th style="font-size:8px;">Uwagi</th></tr></thead><tbody>${itemsHtml || '<tr><td colspan="7" style="text-align: center; color: #999;">Brak pozycji</td></tr>'}</tbody></table>
                    </div>
                    <div class="print-total">Razem: ${(order.total || 0).toFixed(2)} zł</div>
                    ${order.notes ? `<div class="print-section" style="margin-top: 8px;"><div class="print-section-title">Notatki</div><div style="font-size: 10px; color: #374151; white-space: pre-wrap; line-height: 1.2;">${notesPrintSafe}</div></div>` : ''}
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

    async function confirmDeleteOrder(force = false) {
        if (!deleteOrderId) return;

        try {
            const url = force 
                ? `/api/orders/${deleteOrderId}?force=true` 
                : `/api/orders/${deleteOrderId}`;
            
            const response = await fetch(url, {
                method: 'DELETE',
                credentials: 'include'
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                let msg = 'Zamówienie zostało usunięte';
                if (result.deletedProductionOrders > 0) {
                    msg += ` (+ ${result.deletedProductionOrders} zleceń produkcyjnych)`;
                }
                showAdminToast(msg, 'success');
                loadOrders();
                if (deleteOrderModal) deleteOrderModal.classList.add('hidden');
                deleteOrderId = null;
            } else if (result.requiresForce) {
                // Zlecenia produkcyjne w trakcie - pytaj o force
                const poList = result.productionOrders.map(po => `• ${po.orderNumber} (${po.status})`).join('\n');
                const confirmForce = confirm(
                    `${result.message}\n\nPowiązane zlecenia produkcyjne:\n${poList}\n\nCzy na pewno chcesz usunąć zamówienie i wszystkie zlecenia produkcyjne?`
                );
                if (confirmForce) {
                    confirmDeleteOrder(true);
                }
            } else {
                showAdminToast(result.message || 'Nie udało się usunąć zamówienia', 'error');
                if (deleteOrderModal) deleteOrderModal.classList.add('hidden');
                deleteOrderId = null;
            }
        } catch (error) {
            console.error('Błąd usuwania zamówienia:', error);
            showAdminToast('Błąd połączenia z serwerem', 'error');
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
    
    // Inicjalizacja przełącznika widoku statusów
    initStatusViewToggle();

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
            } else if (viewName === 'delivery-presets') {
                loadDeliveryPresets();
            } else if (viewName === 'production-rooms') {
                loadProductionRooms();
            } else if (viewName === 'production-work-center-types') {
                loadWorkCenterTypesView();
            } else if (viewName === 'production-operation-types') {
                loadOperationTypesView();
            } else if (viewName === 'production-work-centers') {
                loadWorkCenters();
            } else if (viewName === 'production-work-stations') {
                loadWorkStations();
            } else if (viewName === 'production-paths') {
                loadProductionPaths();
            } else if (viewName === 'production-orders') {
                loadProductionOrders();
            }
        });
    });

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
            const safeMessage = escapeHtml(error.message || 'Nieznany błąd');
            folderAccessTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-red-500">
                        <div class="flex flex-col items-center gap-2">
                            <i class="fas fa-exclamation-triangle text-2xl"></i>
                            <span>Błąd: ${safeMessage}</span>
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
    const cityFilterShared = document.getElementById('city-filter-shared');
    const cityFilterNew = document.getElementById('city-filter-new');
    const cityFilterUnassignedGlobal = document.getElementById('city-filter-unassigned-global');
    const cityFiltersClearBtn = document.getElementById('city-filters-clear-btn');
    const cityAccessExportCsvBtn = document.getElementById('city-access-export-csv-btn');
    const cityAccessPrintBtn = document.getElementById('city-access-print-btn');
    const refreshCityAccessBtn = document.getElementById('refresh-city-access-btn');
    
    // Event listenery dla kafelków miejscowości
    if (refreshCityAccessBtn) refreshCityAccessBtn.addEventListener('click', () => loadCityTilesData());
    if (cityAccessUserSelect) cityAccessUserSelect.addEventListener('change', handleUserSelectChange);
    if (cityTilesSearch) cityTilesSearch.addEventListener('input', debounce(renderCityTiles, 200));
    if (cityTilesSort) cityTilesSort.addEventListener('change', renderCityTiles);
    if (cityTilesShowAssignedOnly) cityTilesShowAssignedOnly.addEventListener('change', renderCityTiles);
    if (cityFilterShared) cityFilterShared.addEventListener('change', renderCityTiles);
    if (cityFilterNew) cityFilterNew.addEventListener('change', renderCityTiles);
    if (cityFilterUnassignedGlobal) cityFilterUnassignedGlobal.addEventListener('change', renderCityTiles);
    if (cityFiltersClearBtn) cityFiltersClearBtn.addEventListener('click', clearCityFilters);
    if (cityAccessExportCsvBtn) cityAccessExportCsvBtn.addEventListener('click', exportCityAccessCSV);
    if (cityAccessPrintBtn) cityAccessPrintBtn.addEventListener('click', showCityAccessPrintPreview);
    
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
                // Zaktualizuj liczniki w nagłówku dla widoku grafika na podstawie statystyk globalnych
                if (result.data && result.data.stats) {
                    updateCityStatsForGraphics(result.data.stats);
                }
                renderUnassignedCitiesList(result.data);
            } else {
                throw new Error(result.message || 'Błąd pobierania danych');
            }
            
        } catch (error) {
            console.error('Błąd ładowania widoku nieprzypisanych miejscowości:', error);
            if (cityTilesContainer) {
                const safeMessage = escapeHtml(error.message || 'Nieznany błąd');
                cityTilesContainer.innerHTML = `
                    <div class="text-center py-8 text-red-500">
                        <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                        <p>Błąd ładowania danych: ${safeMessage}</p>
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

        const totalSafe = escapeHtml(String(data.stats.total));
        const assignedSafe = escapeHtml(String(data.stats.assigned));
        
        container.innerHTML = `
            <div class="mb-4">
                <div class="flex items-center justify-between">
                    <h3 class="font-semibold text-gray-800">
                        Nieprzypisane miejscowości (${data.unassignedCities.length})
                    </h3>
                    <div class="text-sm text-gray-500">
                        Razem miejscowości: ${totalSafe} | Przypisane: ${assignedSafe}
                    </div>
                </div>
            </div>
            <div class="grid gap-3">
                ${data.unassignedCities.map(city => {
                    const citySafe = escapeHtml(city);
                    const optionsHtml = salespeople.map(user => {
                        const userIdSafe = escapeHtml(String(user.id));
                        const userNameSafe = escapeHtml(user.name || '');
                        const userEmailSafe = escapeHtml(user.email || '');
                        return `<option value="${userIdSafe}">${userNameSafe} (${userEmailSafe})</option>`;
                    }).join('');
                    return `
                    <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-map-marker-alt text-amber-600"></i>
                                </div>
                                <div>
                                    <h4 class="font-medium text-gray-900">${citySafe}</h4>
                                    <p class="text-sm text-gray-500">Nieprzypisana miejscowość</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <select class="city-assignment-select px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" data-city="${citySafe}">
                                    <option value="">Wybierz handlowca</option>
                                    ${optionsHtml}
                                </select>
                                <button class="assign-city-btn px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors" data-city="${citySafe}">
                                    <i class="fas fa-plus mr-1"></i> Przypisz
                                </button>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
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
                const cityNameSafe = escapeHtml(cityName);
                notification.className = 'fixed top-4 right-4 bg-green-50 border border-green-200 rounded-lg p-3 shadow-lg z-50';
                notification.innerHTML = `
                    <div class="flex items-center gap-2">
                        <i class="fas fa-check-circle text-green-600"></i>
                        <span class="text-sm text-green-800">Miejscowość ${cityNameSafe} została przypisana</span>
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
            } else {
                // Brak wybranego użytkownika – zaktualizuj globalne statystyki
                updateCityTilesStats();
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
        const globallyAssignedCities = new Set();
        const cityAssignmentCounts = new Map();
        const cityEntries = new Map(); // { user, assignmentId }

        allSystemCityAssignments.forEach(a => {
            if (a.isActive && a.cityName) {
                const key = a.cityName;
                globallyAssignedCities.add(key);

                const current = cityAssignmentCounts.get(key) || 0;
                cityAssignmentCounts.set(key, current + 1);

                const list = cityEntries.get(key) || [];
                if (a.user) {
                    const exists = list.some(e => e.user && e.user.id === a.user.id);
                    if (!exists) {
                        list.push({ user: a.user, assignmentId: a.id });
                    }
                }
                cityEntries.set(key, list);
            }
        });
        
        window.__citySharedStats = {
            counts: cityAssignmentCounts,
            entriesByCity: cityEntries,
        };

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

    function clearCityFilters() {
        if (cityTilesSearch) cityTilesSearch.value = '';
        if (cityTilesSort) cityTilesSort.value = 'alpha';
        if (cityTilesShowAssignedOnly) cityTilesShowAssignedOnly.checked = false;
        if (cityFilterShared) cityFilterShared.checked = false;
        if (cityFilterNew) cityFilterNew.checked = false;
        if (cityFilterUnassignedGlobal) cityFilterUnassignedGlobal.checked = false;

        renderCityTiles();
    }
    
    function renderCityTiles() {
        if (!cityTilesContainer || !selectedUserId) return;
        
        const searchTerm = cityTilesSearch?.value?.toLowerCase() || '';
        const sortMode = cityTilesSort?.value || 'alpha';
        const showAssignedOnly = cityTilesShowAssignedOnly?.checked || false;
        const filterSharedOn = cityFilterShared?.checked || false;
        const filterNewOn = cityFilterNew?.checked || false;
        const filterUnassignedGlobalOn = cityFilterUnassignedGlobal?.checked || false;
        
        // Przygotuj mapę przypisań
        const assignedCities = new Map();
        selectedUserCityAccess.forEach(a => {
            if (a.isActive) {
                assignedCities.set(a.cityName, a);
            }
        });
        
        // Globalne dane pomocnicze: nieprzypisane, współdzielone, nowe (30 dni)
        const globallyUnassignedCities = getGloballyUnassignedCities();
        const globallyUnassignedSet = new Set(globallyUnassignedCities);

        const sharedCounts = window.__citySharedStats && window.__citySharedStats.counts;

        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const cityFirstAssignmentAt = new Map();

        (allSystemCityAssignments || []).forEach(a => {
            if (!a || !a.isActive || !a.cityName) return;
            const tsRaw = a.updatedAt || a.createdAt;
            if (!tsRaw) return;
            const ts = new Date(tsRaw).getTime();
            if (!ts || Number.isNaN(ts)) return;
            const existing = cityFirstAssignmentAt.get(a.cityName);
            if (existing == null || ts < existing) {
                cityFirstAssignmentAt.set(a.cityName, ts);
            }
        });

        // Filtruj miejscowości
        let cities = allQnapCities.filter(city => {
            if (searchTerm && !city.toLowerCase().includes(searchTerm)) return false;
            if (showAssignedOnly && !assignedCities.has(city)) return false;

            // Filtry globalne
            if (filterSharedOn) {
                const count = sharedCounts && typeof sharedCounts.get === 'function'
                    ? (sharedCounts.get(city) || 0)
                    : 0;
                if (count <= 1) return false;
            }

            if (filterNewOn) {
                const firstAssignedTs = cityFirstAssignmentAt.get(city);
                const isNewCity = firstAssignedTs != null && (now - firstAssignedTs) <= THIRTY_DAYS_MS;
                if (!isNewCity) return false;
            }

            if (filterUnassignedGlobalOn && !globallyUnassignedSet.has(city)) return false;

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
        } else if (sortMode === 'recent-first') {
            cities.sort((a, b) => {
                const aData = assignedCities.get(a);
                const bData = assignedCities.get(b);
                const aAssigned = !!aData;
                const bAssigned = !!bData;

                // Najpierw przypisane, potem pozostałe
                if (aAssigned && !bAssigned) return -1;
                if (!aAssigned && bAssigned) return 1;

                if (aAssigned && bAssigned) {
                    const aTimeRaw = aData.updatedAt || aData.createdAt || '';
                    const bTimeRaw = bData.updatedAt || bData.createdAt || '';
                    const aTime = aTimeRaw ? new Date(aTimeRaw).getTime() : 0;
                    const bTime = bTimeRaw ? new Date(bTimeRaw).getTime() : 0;
                    if (aTime !== bTime) {
                        // Nowsze przypisania na początku listy
                        return bTime - aTime;
                    }
                }

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
            const letterSafe = escapeHtml(letter);
            html += `
                <div class="mb-6">
                    <div class="text-sm font-bold text-gray-400 mb-2 sticky top-0 bg-white py-1">${letterSafe}</div>
                    <div class="flex flex-wrap gap-2">
            `;
            
            grouped[letter].forEach(city => {
                const isAssigned = assignedCities.has(city);
                const accessData = assignedCities.get(city);
                
                // Sprawdź, czy miejscowość jest globalnie nieprzypisana
                const isGloballyUnassigned = globallyUnassignedSet.has(city);

                // Sprawdź, czy miejscowość jest współdzielona (globalnie > 1 aktywne przypisanie)
                const sharedCount = sharedCounts && typeof sharedCounts.get === 'function'
                    ? (sharedCounts.get(city) || 0)
                    : 0;
                const isShared = sharedCount > 1;

                // Sprawdź, czy miejscowość jest "nowa" (pierwsze aktywne przypisanie w ostatnich 30 dniach)
                const firstAssignedTs = cityFirstAssignmentAt.get(city);
                const isNewCity = firstAssignedTs != null && (now - firstAssignedTs) <= THIRTY_DAYS_MS;
                
                const baseClasses = 'city-tile px-4 py-2 rounded-lg font-medium text-sm cursor-pointer transition-all duration-200 transform select-none relative';
                const assignedClasses = 'bg-green-500 text-white shadow-lg scale-105 hover:bg-green-600 hover:shadow-xl';
                const availableClasses = 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 hover:scale-105 hover:shadow-md';
                
                const classes = isAssigned ? `${baseClasses} ${assignedClasses}` : `${baseClasses} ${availableClasses}`;
                const icon = isAssigned ? '<i class="fas fa-check mr-1"></i>' : '';
                const dataId = accessData ? `data-access-id="${accessData.id}"` : '';
                const citySafe = escapeHtml(city);
                
                // Dodaj pomarańczową kropkę tylko dla miejscowości globalnie nieprzypisanych
                const unassignedInfo = isGloballyUnassigned ? 
                    '<span class="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full" title="Nieprzypisana do żadnego handlowca"></span>' : '';

                // Badge współdzielonej miejscowości (globalnie)
                const sharedBadge = isShared
                    ? `<span class="absolute -top-2 left-2 px-1 py-0 rounded-full bg-amber-500 text-white text-[8px] font-semibold shadow-sm flex items-center gap-1" title="Współdzielone: ${sharedCount} handlowców">
                            <i class="fas fa-users text-[8px]"></i>
                            <span>${sharedCount}</span>
                       </span>`
                    : '';

                // Badge "Nowe" dla miejscowości, które pojawiły się w systemie w ciągu ostatnich 30 dni
                const recentBadge = isNewCity
                    ? '<span class="absolute -top-2 right-2 px-1 py-0 rounded-full bg-blue-600 text-white text-[8px] font-semibold shadow-sm">Nowe</span>'
                    : '';
                
                html += `
                    <button class="${classes}" data-city="${citySafe}" data-assigned="${isAssigned}" ${dataId}>
                        ${icon}${citySafe}
                        ${unassignedInfo}
                        ${sharedBadge}
                        ${recentBadge}
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

    function exportCityAccessCSV() {
        const assignments = Array.isArray(allSystemCityAssignments) ? allSystemCityAssignments : [];
        if (assignments.length === 0) {
            showAdminToast('Brak przypisań miejscowości do eksportu', 'warning');
            return;
        }

        const userById = new Map();
        (cityAccessUsers || []).forEach(u => {
            if (!u || u.id == null) return;
            userById.set(String(u.id), u);
        });

        const headers = ['Handlowiec', 'Email', 'Rola', 'Miejscowość', 'Data przypisania', 'Aktywne'];

        const rows = assignments
            .filter(a => a && a.cityName && a.userId != null)
            .map(a => {
                const user = userById.get(String(a.userId)) || a.user || {};
                const name = user.name || '';
                const email = user.email || '';
                const role = user.role || '';
                const cityName = a.cityName || '';
                const tsRaw = a.updatedAt || a.createdAt || '';
                let dateStr = '';
                if (tsRaw) {
                    try {
                        dateStr = new Date(tsRaw).toLocaleString('pl-PL');
                    } catch (_) {
                        dateStr = tsRaw;
                    }
                }
                const active = a.isActive ? 'TAK' : 'NIE';
                return [name, email, role, cityName, dateStr, active];
            });

        if (rows.length === 0) {
            showAdminToast('Brak aktywnych przypisań do eksportu', 'warning');
            return;
        }

        const escapeCSV = (val) => {
            const str = String(val ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        const csvContent = [
            headers.map(escapeCSV).join(','),
            ...rows.map(row => row.map(escapeCSV).join(','))
        ].join('\n');

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `przypisania_miejscowosci_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showAdminToast(`Wyeksportowano ${rows.length} przypisań miejscowości`, 'success');
    }

    function showCityAccessPrintPreview() {
        const assignments = Array.isArray(allSystemCityAssignments) ? allSystemCityAssignments : [];
        if (assignments.length === 0) {
            alert('Brak przypisań miejscowości do wydruku.');
            return;
        }

        const userById = new Map();
        (cityAccessUsers || []).forEach(u => {
            if (!u || u.id == null) return;
            userById.set(String(u.id), u);
        });

        const map = new Map();
        assignments
            .filter(a => a && a.cityName && a.userId != null && a.isActive)
            .forEach(a => {
                const user = userById.get(String(a.userId)) || a.user || {};
                const userKey = String(a.userId);
                if (!map.has(userKey)) {
                    map.set(userKey, { user, cities: new Set() });
                }
                map.get(userKey).cities.add(a.cityName);
            });

        if (map.size === 0) {
            alert('Brak aktywnych przypisań miejscowości do wydruku.');
            return;
        }

        const groups = Array.from(map.values()).map(({ user, cities }) => {
            const name = user.name || user.email || `Użytkownik #${user.id ?? ''}`;
            const email = user.email || '';
            const role = user.role || '';
            const citiesSorted = Array.from(cities).sort((a, b) => a.localeCompare(b, 'pl'));
            return { name, email, role, cities: citiesSorted };
        }).sort((a, b) => a.name.localeCompare(b.name, 'pl'));

        const sectionsHtml = groups.map(group => {
            const safeName = escapeHtml(group.name);
            const safeEmail = escapeHtml(group.email);
            const safeRole = escapeHtml(group.role || '');
            const citiesHtml = group.cities.map(city => `<li>${escapeHtml(city)}</li>`).join('');
            return `
                <section class="mb-6 break-inside-avoid">
                    <header class="mb-1">
                        <div class="text-sm font-semibold text-gray-900">${safeName}</div>
                        <div class="text-[10px] text-gray-500">${safeEmail}${safeRole ? ' · ' + safeRole : ''}</div>
                    </header>
                    <ol class="list-decimal list-inside text-[11px] text-gray-800 leading-snug">
                        ${citiesHtml}
                    </ol>
                </section>
            `;
        }).join('');

        const nowStr = new Date().toLocaleString('pl-PL');

        const printHtml = `
            <div class="print-document">
                <div class="print-header">
                    <div>
                        <div class="print-company">Rezon</div>
                        <div class="print-title">Przypisania miejscowości PM</div>
                    </div>
                    <div class="print-meta">
                        <div>Data wydruku: ${escapeHtml(nowStr)}</div>
                    </div>
                </div>
                <div class="print-section">
                    <div class="print-section-title">Zestawienie według handlowców</div>
                    <div class="print-grid" style="grid-template-columns: 1fr 1fr; gap: 16px;">
                        ${sectionsHtml}
                    </div>
                </div>
            </div>
        `;

        if (adminPrintPreviewContent) adminPrintPreviewContent.innerHTML = printHtml;
        if (adminPrintPreviewModal) adminPrintPreviewModal.classList.remove('hidden');
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
                // Sprawdź, czy to ostatnie aktywne przypisanie tej miejscowości w całym systemie
                let isLastAssignment = false;
                if (Array.isArray(allSystemCityAssignments) && allSystemCityAssignments.length > 0) {
                    const activeForCity = allSystemCityAssignments.filter(a =>
                        a && a.isActive && a.cityName === city
                    );
                    if (activeForCity.length === 1) {
                        isLastAssignment = true;
                    }
                }

                if (isLastAssignment) {
                    const confirmMessage = `Ta operacja spowoduje, że miejscowość "${city}" nie będzie przypisana do żadnego handlowca.\n\nCzy na pewno chcesz usunąć ostatnie przypisanie?`;
                    const confirmed = confirm(confirmMessage);
                    if (!confirmed) {
                        tile.disabled = false;
                        tile.style.opacity = '1';
                        return;
                    }
                }

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
                    await loadAllCityAssignments();
                    updateCityTilesStats();
                    renderCityTiles();
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
                    await loadAllCityAssignments();
                    updateCityTilesStats();
                    renderCityTiles();
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
        const statsAssigned = document.getElementById('city-stats-assigned');
        const statsAvailable = document.getElementById('city-stats-available');
        const statsTotal = document.getElementById('city-stats-total');
        const availableTrigger = document.getElementById('available-cities-trigger');
        const sharedTrigger = document.getElementById('shared-cities-trigger');
        const sharedCounter = document.getElementById('city-stats-shared');
        const recentTrigger = document.getElementById('recent-assignments-trigger');
        const recentCounter = document.getElementById('city-stats-recent');
        const modeLabel = document.getElementById('city-stats-mode');
        const userSummary = document.getElementById('city-user-summary');

        const globallyUnassignedCities = getGloballyUnassignedCities();
        const globallyUnassignedCount = globallyUnassignedCities.length;
        const totalCount = allQnapCities.length;
        const globallyAssignedCount = Math.max(totalCount - globallyUnassignedCount, 0);

        // Oblicz współdzielone miejscowości (mające >1 aktywne przypisanie)
        let sharedCities = [];
        const sharedCounts = window.__citySharedStats && window.__citySharedStats.counts;
        const entriesByCity = window.__citySharedStats && window.__citySharedStats.entriesByCity;
        if (sharedCounts) {
            sharedCounts.forEach((count, city) => {
                if (count > 1) {
                    const entries = entriesByCity ? (entriesByCity.get(city) || []) : [];
                    const assignments = entries.map(e => ({
                        user: e.user,
                        assignmentId: e.assignmentId || null,
                    }));
                    const users = assignments.map(a => a.user).filter(Boolean);
                    sharedCities.push({ cityName: city, count, users, assignments });
                }
            });
        }
        const sharedCount = sharedCities.length;

        // Nowe przypisania z ostatnich 30 dni (na podstawie updatedAt lub createdAt)
        const now = Date.now();
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const recentAssignmentsAll = (allSystemCityAssignments || []).filter(a => {
            if (!a || !a.isActive) return false;
            const tsRaw = a.updatedAt || a.createdAt;
            if (!tsRaw) return false;
            const ts = new Date(tsRaw).getTime();
            if (!ts || Number.isNaN(ts)) return false;
            return (now - ts) <= THIRTY_DAYS_MS;
        });
        const recentGlobalCount = recentAssignmentsAll.length;

        // Brak wybranego użytkownika – pokaż statystyki globalne
        if (!selectedUserId) {
            if (statsAssigned) statsAssigned.textContent = globallyAssignedCount;
            if (statsAvailable) statsAvailable.textContent = globallyUnassignedCount;
            if (statsTotal) statsTotal.textContent = totalCount;

            if (recentCounter) recentCounter.textContent = recentGlobalCount;

            if (modeLabel) {
                modeLabel.textContent = 'Widok globalny – statystyki dla całego systemu';
            }

            if (userSummary) {
                userSummary.textContent = '';
                userSummary.classList.add('hidden');
            }

            const assignedPct = totalCount ? Math.round((globallyAssignedCount / totalCount) * 100) : 0;
            const availablePct = totalCount ? Math.round((globallyUnassignedCount / totalCount) * 100) : 0;
            if (statsAssigned) statsAssigned.title = `Globalnie przypisane miejscowości (${assignedPct}% wszystkich)`;
            if (statsAvailable) statsAvailable.title = `Globalnie nieprzypisane miejscowości (${availablePct}% wszystkich)`;
            if (statsTotal) statsTotal.title = 'Liczba wszystkich miejscowości dostępnych w systemie';

            if (availableTrigger) {
                availableTrigger.onclick = (e) => {
                    e.stopPropagation();
                    if (globallyUnassignedCities.length > 0) {
                        showAllUnassignedCities(globallyUnassignedCities);
                    }
                };
                availableTrigger.title = `Kliknij, aby zobaczyć listę (${globallyUnassignedCount} miejscowości nieprzypisanych do żadnego handlowca – dane globalne)`;
            }

            if (sharedTrigger) {
                if (sharedCounter) sharedCounter.textContent = sharedCount;
                sharedTrigger.onclick = (e) => {
                    e.stopPropagation();
                    if (sharedCount > 0) {
                        showSharedCitiesModal(sharedCities);
                    }
                };
                sharedTrigger.title = sharedCount > 0
                    ? `Liczba miejscowości współdzielonych przez wielu handlowców: ${sharedCount}`
                    : 'Brak miejscowości współdzielonych przez wielu handlowców';
            }

            if (recentTrigger) {
                recentTrigger.onclick = (e) => {
                    e.stopPropagation();
                    if (recentAssignmentsAll.length > 0) {
                        showRecentAssignmentsModal(recentAssignmentsAll, { scope: 'global' });
                    } else {
                        alert('Brak nowych przypisań w ostatnich 30 dniach (globalnie).');
                    }
                };
                recentTrigger.title = recentGlobalCount > 0
                    ? `Liczba nowych przypisań w ostatnich 30 dniach (globalnie): ${recentGlobalCount}`
                    : 'Brak nowych przypisań w ostatnich 30 dniach (globalnie)';
            }

            updateCityRanking();
            return;
        }

        // Wybrany użytkownik – statystyki dla konkretnego handlowca
        const assignedCities = new Set(selectedUserCityAccess
            .filter(a => a.isActive)
            .map(a => a.cityName));

        const unassignedCities = allQnapCities.filter(city => !assignedCities.has(city));
        const assignedCount = assignedCities.size;
        const availableCount = unassignedCities.length;

        const assignedPctUser = totalCount ? Math.round((assignedCount / totalCount) * 100) : 0;
        const availablePctUser = totalCount ? Math.round((availableCount / totalCount) * 100) : 0;

        const recentAssignmentsForUser = recentAssignmentsAll.filter(a => a.userId === selectedUserId);
        const recentUserCount = recentAssignmentsForUser.length;

        if (modeLabel) {
            const currentUser = cityAccessUsers.find(u => u.id === selectedUserId);
            const name = currentUser?.name || currentUser?.email || 'wybranego użytkownika';
            modeLabel.textContent = `Widok dla: ${name}`;
        }

        if (statsAssigned) {
            statsAssigned.textContent = assignedCount;
            statsAssigned.title = `Miejscowości przypisane do wybranego handlowca (${assignedPctUser}% wszystkich)`;
        }
        if (statsAvailable) {
            statsAvailable.textContent = availableCount;
            statsAvailable.title = `Miejscowości, których wybrany handlowiec jeszcze nie ma (${availablePctUser}% wszystkich)`;
        }
        if (statsTotal) {
            statsTotal.textContent = totalCount;
            statsTotal.title = 'Liczba wszystkich miejscowości dostępnych w systemie';
        }

        if (userSummary) {
            const sharedForUser = sharedCities.filter(item =>
                Array.isArray(item.users) && item.users.some(u => u && String(u.id) === String(selectedUserId))
            ).length;

            const sharedPart = `Współdzielone miejscowości: ${sharedForUser}`;
            const recentPart = `Nowe przypisania 30 dni: ${recentUserCount}`;
            userSummary.textContent = `${sharedPart} · ${recentPart}`;
            userSummary.classList.remove('hidden');
        }

        if (availableTrigger) {
            availableTrigger.onclick = (e) => {
                e.stopPropagation();
                if (globallyUnassignedCities.length > 0) {
                    showAllUnassignedCities(globallyUnassignedCities);
                }
            };
            availableTrigger.title = `Kliknij, aby zobaczyć listę (${globallyUnassignedCount} miejscowości nieprzypisanych do żadnego handlowca – dane globalne)`;
        }

        if (sharedTrigger) {
            if (sharedCounter) sharedCounter.textContent = sharedCount;
            sharedTrigger.onclick = (e) => {
                e.stopPropagation();
                if (sharedCount > 0) {
                    showSharedCitiesModal(sharedCities);
                }
            };
            sharedTrigger.title = sharedCount > 0
                ? `Liczba miejscowości współdzielonych przez wielu handlowców: ${sharedCount}`
                : 'Brak miejscowości współdzielonych przez wielu handlowców';
        }

        if (recentTrigger) {
            if (recentCounter) recentCounter.textContent = recentUserCount;
            recentTrigger.onclick = (e) => {
                e.stopPropagation();
                if (recentAssignmentsForUser.length > 0) {
                    const currentUser = cityAccessUsers.find(u => u.id === selectedUserId);
                    const name = currentUser?.name || currentUser?.email || '';
                    showRecentAssignmentsModal(recentAssignmentsForUser, { scope: 'user', userName: name });
                } else {
                    alert('Brak nowych przypisań w ostatnich 30 dniach dla tego handlowca.');
                }
            };
            recentTrigger.title = recentUserCount > 0
                ? `Nowe przypisania w ostatnich 30 dniach dla wybranego handlowca: ${recentUserCount}`
                : 'Brak nowych przypisań w ostatnich 30 dniach dla wybranego handlowca';
        }

        updateCityRanking();
    }

    function updateCityRanking() {
        const container = document.getElementById('city-ranking-container');
        const topList = document.getElementById('city-ranking-top');
        const bottomList = document.getElementById('city-ranking-bottom');

        if (!container || !topList || !bottomList) return;

        const assignments = Array.isArray(allSystemCityAssignments) ? allSystemCityAssignments : [];
        if (assignments.length === 0 || !Array.isArray(cityAccessUsers)) {
            container.classList.add('hidden');
            topList.innerHTML = '';
            bottomList.innerHTML = '';
            return;
        }

        const counts = new Map();
        assignments.forEach(a => {
            if (!a || !a.isActive || !a.userId || !a.cityName) return;
            const current = counts.get(a.userId) || 0;
            counts.set(a.userId, current + 1);
        });

        const candidates = cityAccessUsers
            .filter(u => u && u.isActive && u.id != null && ['SALES_REP', 'SALES_DEPT'].includes(u.role))
            .map(u => ({
                userId: u.id,
                name: u.name || u.email || '',
                count: counts.get(u.id) || 0
            }))
            .filter(item => item.count > 0);

        if (candidates.length === 0) {
            container.classList.add('hidden');
            topList.innerHTML = '';
            bottomList.innerHTML = '';
            return;
        }

        container.classList.remove('hidden');

        const maxItems = 5;

        const sortedDesc = [...candidates].sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return (a.name || '').localeCompare(b.name || '', 'pl-PL');
        });

        const sortedAsc = [...candidates].sort((a, b) => {
            if (a.count !== b.count) return a.count - b.count;
            return (a.name || '').localeCompare(b.name || '', 'pl-PL');
        });

        const renderRow = (item, index, variant) => {
            const idSafe = escapeHtml(String(item.userId));
            const nameSafe = escapeHtml(item.name || '');
            const countSafe = escapeHtml(String(item.count));
            const badgeBase = 'inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full font-semibold';
            let badgeClasses = 'bg-gray-100 text-gray-600';
            if (variant === 'top') {
                badgeClasses = index === 0 ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700';
            } else if (variant === 'bottom') {
                badgeClasses = index === 0 ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700';
            }
            return `
                <button class="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors city-ranking-item" data-user-id="${idSafe}">
                    <div class="flex items-center gap-2">
                        <span class="${badgeBase} ${badgeClasses}">${index + 1}</span>
                        <span class="truncate">${nameSafe}</span>
                    </div>
                    <span class="text-xs text-gray-500 mr-1">${countSafe} miejsc.</span>
                </button>
            `;
        };

        const topItems = sortedDesc.slice(0, maxItems);
        const bottomFiltered = sortedAsc.filter(item => !topItems.some(top => top.userId === item.userId));
        const bottomItems = bottomFiltered.slice(0, maxItems);

        topList.innerHTML = topItems.map((item, index) => renderRow(item, index, 'top')).join('');
        if (bottomItems.length > 0) {
            bottomList.innerHTML = bottomItems.map((item, index) => renderRow(item, index, 'bottom')).join('');
        } else {
            bottomList.innerHTML = `<p class="text-xs text-gray-400">Za mało danych do wyświetlenia dolnego rankingu.</p>`;
        }

        const attachHandlers = (root) => {
            root.querySelectorAll('.city-ranking-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    const userId = btn.getAttribute('data-user-id');
                    if (!userId || !cityAccessUserSelect) return;
                    cityAccessUserSelect.value = userId;
                    const event = new Event('change');
                    cityAccessUserSelect.dispatchEvent(event);
                    const view = document.getElementById('view-city-access');
                    if (view && typeof view.scrollIntoView === 'function') {
                        view.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });
        };

        attachHandlers(topList);
        attachHandlers(bottomList);
    }

    function showSharedCitiesModal(sharedCities) {
        if (!Array.isArray(sharedCities) || sharedCities.length === 0) return;

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

        const itemsHtml = sharedCities
            .sort((a, b) => b.count - a.count || a.cityName.localeCompare(b.cityName, 'pl'))
            .map(item => {
                const citySafe = escapeHtml(item.cityName);
                const countSafe = escapeHtml(String(item.count));
                const assignments = Array.isArray(item.assignments) && item.assignments.length > 0
                    ? item.assignments
                    : (Array.isArray(item.users) ? item.users.map(u => ({ user: u, assignmentId: null })) : []);
                const usersHtml = assignments.map(a => {
                    const user = a.user || {};
                    const label = escapeHtml((user.name || user.email) || '');
                    const idSafe = a.assignmentId != null ? escapeHtml(String(a.assignmentId)) : '';
                    const userIdSafe = user.id != null ? escapeHtml(String(user.id)) : '';
                    const disabledAttr = idSafe ? '' : 'data-disabled="true"';
                    return `
                        <button class="shared-city-user inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] text-amber-800 hover:bg-amber-100" data-city="${citySafe}" data-assignment-id="${idSafe}" data-user-id="${userIdSafe}" ${disabledAttr}>
                            <span class="shared-city-user-label">${label}</span>
                            ${idSafe ? '<span class="shared-city-user-delete" title="Usuń przypisanie"><i class="fas fa-times text-[10px]"></i></span>' : ''}
                        </button>
                    `;
                }).join(' ');
                return `
                    <div class="shared-city-item p-3 bg-white rounded border border-gray-100 shadow-sm" data-city="${citySafe}">
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-800">${citySafe}</span>
                            <span class="text-xs font-semibold text-amber-700">${countSafe} handlowców</span>
                        </div>
                        <div class="mt-1 flex flex-wrap gap-1">
                            ${usersHtml}
                        </div>
                    </div>
                `;
            }).join('');

        const countSafe = escapeHtml(String(sharedCities.length));

        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div class="p-6 border-b border-gray-200">
                    <h3 class="text-xl font-semibold text-gray-800">Miejscowości współdzielone</h3>
                    <p class="text-sm text-gray-500 mt-1">Liczba miejscowości przypisanych do więcej niż jednego handlowca: ${countSafe}</p>
                </div>
                <div class="px-6 pt-3 pb-2 border-b bg-white text-xs text-gray-600">
                    <div class="grid gap-2 md:grid-cols-2">
                        <div class="relative">
                            <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]"></i>
                            <input id="shared-cities-filter-city" type="text" class="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-[11px]" placeholder="Filtruj po nazwie miejscowości...">
                        </div>
                        <div class="relative">
                            <i class="fas fa-user absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]"></i>
                            <input id="shared-cities-filter-user" type="text" class="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-[11px]" placeholder="Filtruj po handlowcu...">
                        </div>
                    </div>
                </div>
                <div class="p-4 overflow-y-auto flex-grow bg-gray-50">
                    <div id="shared-cities-list" class="space-y-2">
                        ${itemsHtml}
                    </div>
                </div>
                <div class="p-4 border-t border-gray-200 flex justify-end bg-white">
                    <button id="close-shared-cities-modal" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Zamknij
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#close-shared-cities-modal');
        if (closeBtn) {
            closeBtn.onclick = () => modal.remove();
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Filtrowanie listy współdzielonych miejscowości
        const filterCityInput = modal.querySelector('#shared-cities-filter-city');
        const filterUserInput = modal.querySelector('#shared-cities-filter-user');
        const listContainer = modal.querySelector('#shared-cities-list');

        const applySharedFilters = () => {
            if (!listContainer) return;
            const cityTerm = (filterCityInput?.value || '').toLowerCase().trim();
            const userTerm = (filterUserInput?.value || '').toLowerCase().trim();

            listContainer.querySelectorAll('.shared-city-item').forEach(item => {
                const cityName = (item.getAttribute('data-city') || '').toLowerCase();
                const matchesCity = !cityTerm || cityName.includes(cityTerm);

                const labels = Array.from(item.querySelectorAll('.shared-city-user-label'));
                const matchesUser = !userTerm || labels.some(el => (el.textContent || '').toLowerCase().includes(userTerm));

                item.style.display = (matchesCity && matchesUser) ? '' : 'none';
            });
        };

        if (filterCityInput) filterCityInput.addEventListener('input', applySharedFilters);
        if (filterUserInput) filterUserInput.addEventListener('input', applySharedFilters);

        // Obsługa kliknięć w "chipy" handlowców: klik w nazwisko przechodzi do widoku handlowca,
        // klik w ikonę X usuwa przypisanie (z ostrzeżeniem przy ostatnim przypisaniu).
        modal.querySelectorAll('.shared-city-user').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const deleteTarget = e.target.closest('.shared-city-user-delete');
                const assignmentId = btn.getAttribute('data-assignment-id');
                const cityName = btn.getAttribute('data-city') || '';
                const disabled = btn.getAttribute('data-disabled') === 'true';

                // Usuwanie przypisania tylko po kliknięciu w ikonę X
                if (deleteTarget && assignmentId && !disabled) {
                    // Sprawdź, czy to ostatnie aktywne przypisanie tej miejscowości w całym systemie
                    let isLastAssignment = false;
                    if (Array.isArray(allSystemCityAssignments) && allSystemCityAssignments.length > 0) {
                        const activeForCity = allSystemCityAssignments.filter(a =>
                            a && a.isActive && a.cityName === cityName
                        );
                        if (activeForCity.length === 1) {
                            isLastAssignment = true;
                        }
                    }

                    const labelText = btn.textContent.trim();
                    let confirmMessage = `Usunąć przypisanie miejscowości "${cityName}" od handlowca "${labelText}"?`;
                    if (isLastAssignment) {
                        confirmMessage += `\n\nUwaga: to ostatnie aktywne przypisanie tej miejscowości. Po usunięciu nie będzie ona przypisana do żadnego handlowca.`;
                    }

                    if (!confirm(confirmMessage)) return;

                    const originalHtml = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-[10px]"></i><span>Usuwanie...</span>';

                    try {
                        const response = await fetch(`/api/admin/user-city-access/${assignmentId}`, { method: 'DELETE' });
                        const result = await response.json();

                        if (result.status === 'success') {
                            // Odśwież dane globalne i statystyki
                            await loadAllCityAssignments();
                            updateCityTilesStats();
                            modal.remove();
                        } else {
                            alert('Błąd: ' + (result.message || 'Nie udało się usunąć przypisania'));
                            btn.disabled = false;
                            btn.innerHTML = originalHtml;
                        }
                    } catch (error) {
                        console.error('Błąd usuwania przypisania współdzielonego:', error);
                        alert('Wystąpił błąd podczas usuwania przypisania');
                        btn.disabled = false;
                        btn.innerHTML = originalHtml;
                    }

                    return;
                }

                // Klik w chip (nazwisko) – szybkie przejście do widoku handlowca
                const userId = btn.getAttribute('data-user-id');
                if (userId && cityAccessUserSelect) {
                    cityAccessUserSelect.value = userId;
                    const changeEvent = new Event('change');
                    cityAccessUserSelect.dispatchEvent(changeEvent);
                    modal.remove();

                    const view = document.getElementById('view-city-access');
                    if (view && typeof view.scrollIntoView === 'function') {
                        view.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        });
    }

    function showRecentAssignmentsModal(assignments, options = {}) {
        if (!Array.isArray(assignments) || assignments.length === 0) {
            alert('Brak nowych przypisań w wybranym okresie.');
            return;
        }

        const scope = options.scope || 'global';
        const userName = options.userName || '';

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

        const sorted = [...assignments].sort((a, b) => {
            const aTs = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const bTs = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return bTs - aTs;
        });

        const itemsHtml = sorted.map(a => {
            const citySafe = escapeHtml(a.cityName || '');
            const userLabel = a.user ? (a.user.name || a.user.email || '') : '';
            const userSafe = escapeHtml(userLabel);
            const tsRaw = a.updatedAt || a.createdAt || null;
            const ts = tsRaw ? new Date(tsRaw) : null;
            const dateSafe = ts ? escapeHtml(ts.toLocaleString('pl-PL')) : '';
            return `
                <div class="flex items-center justify-between p-2 bg-white rounded border border-gray-100 shadow-sm">
                    <div class="flex flex-col">
                        <span class="text-sm text-gray-800">${citySafe}</span>
                        <span class="text-xs text-gray-500">${userSafe}</span>
                    </div>
                    <span class="text-xs text-gray-400 font-mono">${dateSafe}</span>
                </div>
            `;
        }).join('');

        const countSafe = escapeHtml(String(assignments.length));
        const scopeLabel = scope === 'user'
            ? `dla użytkownika ${escapeHtml(userName || '')}`
            : 'globalnie';

        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div class="p-6 border-b border-gray-200">
                    <h3 class="text-xl font-semibold text-gray-800">Nowe przypisania (30 dni)</h3>
                    <p class="text-sm text-gray-500 mt-1">Liczba: ${countSafe} &middot; Zakres: ${scopeLabel}</p>
                </div>
                <div class="p-4 overflow-y-auto flex-grow bg-gray-50">
                    <div class="space-y-2">
                        ${itemsHtml}
                    </div>
                </div>
                <div class="p-4 border-t border-gray-200 flex justify-end bg-white">
                    <button id="close-recent-assignments-modal" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Zamknij</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#close-recent-assignments-modal');
        if (closeBtn) {
            closeBtn.onclick = () => modal.remove();
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    function updateCityStatsForGraphics(stats) {
        const statsAssigned = document.getElementById('city-stats-assigned');
        const statsAvailable = document.getElementById('city-stats-available');
        const statsTotal = document.getElementById('city-stats-total');

        if (!stats) {
            if (statsAssigned) statsAssigned.textContent = '0';
            if (statsAvailable) statsAvailable.textContent = '0';
            if (statsTotal) statsTotal.textContent = '0';
            return;
        }

        const total = Number(stats.total) || 0;
        const assigned = Number(stats.assigned) || 0;
        const unassigned = Number(stats.unassigned) || 0;

        if (statsAssigned) statsAssigned.textContent = assigned;
        if (statsAvailable) statsAvailable.textContent = unassigned;
        if (statsTotal) statsTotal.textContent = total;
    }

    function showAllUnassignedCities(cities) {
        // Utwórz modal z listą wszystkich dostępnych miejscowości
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        const countSafe = escapeHtml(String(cities.length));
        const citiesHtml = cities.map(city => {
            const citySafe = escapeHtml(city);
            return `<div class="p-2 bg-gray-50 rounded border border-gray-100 text-sm">${citySafe}</div>`;
        }).join('');
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div class="p-6 border-b border-gray-200">
                    <h3 class="text-xl font-semibold text-gray-800">Miejscowości nieprzypisane do żadnego handlowca</h3>
                    <p class="text-sm text-gray-500 mt-1">Liczba: ${countSafe}</p>
                </div>
                <div class="p-4 overflow-y-auto flex-grow">
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        ${citiesHtml}
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
                    const oldLabel = STATUS_LABELS[entry.oldStatus] || entry.oldStatus;
                    const newLabel = STATUS_LABELS[entry.newStatus] || entry.newStatus;
                    const notesText = entry.notes || 'Zmiana statusu';
                    const userNameSafe = escapeHtml(userName);
                    const oldLabelSafe = escapeHtml(oldLabel);
                    const newLabelSafe = escapeHtml(newLabel);
                    const notesSafe = escapeHtml(notesText);
                    return `
                        <div class="bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <i class="fas fa-exchange-alt text-blue-500 text-sm"></i>
                                    <span class="text-sm font-medium text-gray-900">
                                        ${oldLabelSafe} → ${newLabelSafe}
                                    </span>
                                </div>
                                <span class="text-xs text-gray-500">${date}</span>
                            </div>
                            <div class="mt-1 text-xs text-gray-600">
                                <i class="fas fa-user text-gray-400 mr-1"></i>
                                ${userNameSafe} • ${notesSafe}
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
            const safeMessage = escapeHtml(error.message || 'Nieznany błąd');
            pmProjectsList.innerHTML = `
                <div class="p-8 text-center text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Nie udało się załadować projektów</p>
                    <p class="text-sm text-gray-500">${safeMessage}</p>
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

        // Posortuj tak, aby projekty z przypisanymi produktami były na górze,
        // a w obrębie każdej grupy alfabetycznie po nazwie/slug.
        const sortedProjects = [...pmFilteredProjects].sort((a, b) => {
            const aCount = a.productCount || 0;
            const bCount = b.productCount || 0;

            const aHas = aCount > 0;
            const bHas = bCount > 0;

            if (aHas !== bHas) {
                return aHas ? -1 : 1; // najpierw z przypisaniami
            }

            const aName = (a.displayName || a.slug || '').toLowerCase();
            const bName = (b.displayName || b.slug || '').toLowerCase();

            return aName.localeCompare(bName, 'pl-PL');
        });

        pmProjectsList.innerHTML = sortedProjects.map(p => {
            const isSelected = p.id === pmSelectedProjectId;
            const hasMappings = p.productCount > 0;
            const projectId = p.id; // używane tylko jako data-attribute
            const nameText = p.displayName || p.slug || '';
            const slugText = p.slug || '';
            const nameSafe = escapeHtml(nameText);
            const slugSafe = escapeHtml(slugText);
            const count = p.productCount || 0;
            const countText = `${count} ${count === 1 ? 'produkt' : 'produktów'}`;
            const countSafe = escapeHtml(countText);
            return `
                <div class="pm-project-item flex items-center justify-between px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}"
                     data-project-id="${projectId}">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-800 truncate">${nameSafe}</div>
                        <div class="text-xs text-gray-500 truncate">${slugSafe}</div>
                    </div>
                    <div class="ml-3 flex items-center gap-2">
                        <span class="px-2 py-0.5 text-xs rounded-full ${hasMappings ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">
                            ${countSafe}
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
                    ${products.map(p => {
                        const identifierSafe = escapeHtml(p.identifier || '-');
                        const indexSafe = escapeHtml(p.index || '-');
                        const productId = p.productId; // tylko data-attribute
                        return `
                        <tr class="hover:bg-gray-50">
                            <td class="p-3 font-medium text-gray-800">${identifierSafe}</td>
                            <td class="p-3 text-gray-600">${indexSafe}</td>
                            <td class="p-3 text-right">
                                <button class="pm-remove-product text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                        data-product-id="${productId}" title="Usuń przypisanie">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </td>
                        </tr>`;
                    }).join('')}
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

// ============================================
// MODUŁ: PANEL PRODUKCYJNY
// ============================================

// Typy gniazd ładowane dynamicznie z API
let workCenterTypes = [];

// Typy operacji ładowane dynamicznie z API
let operationTypes = [];

// Fallback dla starych danych (jeśli typ nie jest w słowniku)
const WORK_CENTER_TYPE_LABELS = {
    'laser_co2': 'Laser CO2',
    'laser_fiber': 'Laser Fiber',
    'uv_print': 'Druk UV',
    'cnc': 'CNC',
    'cutting': 'Cięcie',
    'assembly': 'Montaż',
    'packaging': 'Pakowanie',
    'other': 'Inne'
};

// Funkcja pobierająca nazwę typu (najpierw ze słownika, potem fallback)
function getWorkCenterTypeName(typeCode) {
    const fromApi = workCenterTypes.find(t => t.code === typeCode);
    if (fromApi) return fromApi.name;
    return WORK_CENTER_TYPE_LABELS[typeCode] || typeCode || 'Nieznany';
}

// Funkcja pobierająca nazwę typu operacji (API -> fallback do stałej)
function getOperationTypeName(typeCode) {
    if (!typeCode) return 'Nieznany';

    const fromApi = operationTypes.find(t => t.code === typeCode);
    if (fromApi) return fromApi.name;

    if (OPERATION_TYPES && Object.prototype.hasOwnProperty.call(OPERATION_TYPES, typeCode)) {
        return OPERATION_TYPES[typeCode];
    }

    return typeCode || 'Nieznany';
}

// Ładowanie typów gniazd z API
async function loadWorkCenterTypes() {
    try {
        const response = await fetch('/api/production/work-center-types?isActive=true', { credentials: 'include' });
        const result = await response.json();
        if (result.status === 'success') {
            workCenterTypes = result.data || [];
        }
    } catch (error) {
        console.error('Błąd ładowania typów gniazd:', error);
    }
    return workCenterTypes;
}

// Ładowanie typów operacji z API (do formularzy i widoku słownika)
async function loadOperationTypes() {
    try {
        const response = await fetch('/api/production/operation-types?isActive=true', { credentials: 'include' });
        const result = await response.json();
        if (result.status === 'success') {
            operationTypes = result.data || [];
        }
    } catch (error) {
        console.error('Błąd ładowania typów operacji:', error);
    }
    return operationTypes;
}

const WORK_STATION_STATUS_LABELS = {
    'available': { label: 'Dostępna', color: 'green', icon: 'check-circle' },
    'in_use': { label: 'W użyciu', color: 'amber', icon: 'play-circle' },
    'maintenance': { label: 'Konserwacja', color: 'blue', icon: 'wrench' },
    'breakdown': { label: 'Awaria', color: 'red', icon: 'exclamation-triangle' }
};

let productionRooms = [];
let workCenters = [];
let workStations = [];

// ============================================
// MODUŁ: TYPY GNIAZD (WorkCenterType)
// ============================================

const workCenterTypesTbody = document.getElementById('work-center-types-tbody');
const workCenterTypeModal = document.getElementById('work-center-type-modal');
const workCenterTypeForm = document.getElementById('work-center-type-form');
const workCenterTypeModalTitle = document.getElementById('work-center-type-modal-title');
const workCenterTypeSubmitText = document.getElementById('work-center-type-submit-text');
const workCenterTypeFormError = document.getElementById('work-center-type-form-error');

// Event listenery dla typów gniazd
document.getElementById('new-work-center-type-btn')?.addEventListener('click', () => openWorkCenterTypeModal());
document.getElementById('refresh-work-center-types-btn')?.addEventListener('click', loadWorkCenterTypesView);
document.getElementById('work-center-type-modal-close')?.addEventListener('click', closeWorkCenterTypeModal);
document.getElementById('work-center-type-form-cancel')?.addEventListener('click', closeWorkCenterTypeModal);
workCenterTypeForm?.addEventListener('submit', handleWorkCenterTypeSubmit);
workCenterTypeModal?.addEventListener('click', (e) => { if (e.target === workCenterTypeModal) closeWorkCenterTypeModal(); });

async function loadWorkCenterTypesView() {
    if (!workCenterTypesTbody) return;
    
    workCenterTypesTbody.innerHTML = `
        <tr>
            <td colspan="5" class="px-6 py-12 text-center text-gray-400">
                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                <p class="text-lg">Ładowanie typów gniazd...</p>
            </td>
        </tr>
    `;
    
    try {
        const response = await fetch('/api/production/work-center-types', { credentials: 'include' });
        const result = await response.json();
        
        if (result.status === 'success') {
            workCenterTypes = result.data || [];
            renderWorkCenterTypes();
        } else {
            workCenterTypesTbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-12 text-center text-red-500">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>${escapeHtml(result.message || 'Błąd ładowania')}</p>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Błąd ładowania typów gniazd:', error);
        workCenterTypesTbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Błąd połączenia z serwerem</p>
                </td>
            </tr>
        `;
    }
}

function renderWorkCenterTypes() {
    if (!workCenterTypesTbody) return;
    
    if (workCenterTypes.length === 0) {
        workCenterTypesTbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-gray-400">
                    <i class="fas fa-tags text-4xl mb-4"></i>
                    <p class="text-lg">Brak typów gniazd</p>
                    <p class="text-sm mt-2">Kliknij "Dodaj typ" aby utworzyć pierwszy</p>
                </td>
            </tr>
        `;
        return;
    }
    
    workCenterTypesTbody.innerHTML = workCenterTypes.map(type => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4">
                <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">${escapeHtml(type.code)}</span>
            </td>
            <td class="px-6 py-4 font-medium text-gray-900">${escapeHtml(type.name)}</td>
            <td class="px-6 py-4 text-gray-600 text-sm">${escapeHtml(type.description || '-')}</td>
            <td class="px-6 py-4 text-center">
                ${type.isActive 
                    ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aktywny</span>'
                    : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Nieaktywny</span>'
                }
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="editWorkCenterType(${type.id})" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edytuj">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="toggleWorkCenterTypeActive(${type.id}, ${type.isActive})" class="p-2 ${type.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'} rounded-lg transition-colors" title="${type.isActive ? 'Dezaktywuj' : 'Aktywuj'}">
                        <i class="fas fa-${type.isActive ? 'ban' : 'check'}"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openWorkCenterTypeModal(type = null) {
    if (!workCenterTypeModal || !workCenterTypeForm) return;
    
    workCenterTypeForm.reset();
    workCenterTypeFormError?.classList.add('hidden');
    
    const codeInput = workCenterTypeForm.querySelector('[name="code"]');
    
    if (type) {
        workCenterTypeModalTitle.innerHTML = '<i class="fas fa-tags"></i> Edytuj typ gniazda';
        workCenterTypeSubmitText.textContent = 'Zapisz zmiany';
        workCenterTypeForm.querySelector('[name="id"]').value = type.id;
        codeInput.value = type.code || '';
        codeInput.readOnly = true; // Kod nie może być zmieniany
        codeInput.classList.add('bg-gray-100');
        workCenterTypeForm.querySelector('[name="name"]').value = type.name || '';
        workCenterTypeForm.querySelector('[name="description"]').value = type.description || '';
        workCenterTypeForm.querySelector('[name="isActive"]').checked = type.isActive !== false;
    } else {
        workCenterTypeModalTitle.innerHTML = '<i class="fas fa-tags"></i> Nowy typ gniazda';
        workCenterTypeSubmitText.textContent = 'Utwórz typ';
        workCenterTypeForm.querySelector('[name="id"]').value = '';
        codeInput.readOnly = false;
        codeInput.classList.remove('bg-gray-100');
        workCenterTypeForm.querySelector('[name="isActive"]').checked = true;
    }
    
    workCenterTypeModal.classList.remove('hidden');
    (type ? workCenterTypeForm.querySelector('[name="name"]') : codeInput).focus();
}

function closeWorkCenterTypeModal() {
    workCenterTypeModal?.classList.add('hidden');
}

async function handleWorkCenterTypeSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(workCenterTypeForm);
    const id = formData.get('id');
    const code = formData.get('code')?.trim().toLowerCase();
    const name = formData.get('name')?.trim();
    const description = formData.get('description')?.trim();
    const isActive = formData.get('isActive') === 'on';
    
    if (!code || !name) {
        showWorkCenterTypeError('Kod i nazwa są wymagane');
        return;
    }
    
    if (!/^[a-z0-9_]+$/.test(code)) {
        showWorkCenterTypeError('Kod może zawierać tylko małe litery, cyfry i podkreślenia');
        return;
    }
    
    workCenterTypeFormError?.classList.add('hidden');
    
    const data = { name, description: description || null, isActive };
    if (!id) data.code = code; // Kod tylko przy tworzeniu
    
    try {
        const url = id ? `/api/production/work-center-types/${id}` : '/api/production/work-center-types';
        const method = id ? 'PATCH' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAdminToast(id ? 'Typ gniazda zaktualizowany' : 'Typ gniazda utworzony', 'success');
            closeWorkCenterTypeModal();
            loadWorkCenterTypesView();
        } else {
            showWorkCenterTypeError(result.message || 'Błąd zapisu');
        }
    } catch (error) {
        console.error('Błąd zapisu typu gniazda:', error);
        showWorkCenterTypeError('Błąd połączenia z serwerem');
    }
}

function showWorkCenterTypeError(message) {
    if (workCenterTypeFormError) {
        workCenterTypeFormError.querySelector('span').textContent = message;
        workCenterTypeFormError.classList.remove('hidden');
    }
}

window.editWorkCenterType = function(id) {
    const type = workCenterTypes.find(t => t.id === id);
    if (type) openWorkCenterTypeModal(type);
};

window.toggleWorkCenterTypeActive = async function(id, currentActive) {
    const action = currentActive ? 'dezaktywować' : 'aktywować';
    if (!confirm(`Czy na pewno chcesz ${action} ten typ gniazda?`)) return;
    
    try {
        const response = await fetch(`/api/production/work-center-types/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ isActive: !currentActive })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAdminToast(`Typ gniazda ${currentActive ? 'dezaktywowany' : 'aktywowany'}`, 'success');
            loadWorkCenterTypesView();
        } else {
            showAdminToast(result.message || 'Błąd zmiany statusu', 'error');
        }
    } catch (error) {
        console.error('Błąd zmiany statusu typu:', error);
        showAdminToast('Błąd połączenia z serwerem', 'error');
    }
};

// ============================================
// MODUŁ: TYPY OPERACJI (OperationType)
// ============================================

const operationTypesTbody = document.getElementById('operation-types-tbody');
const operationTypeModal = document.getElementById('operation-type-modal');
const operationTypeForm = document.getElementById('operation-type-form');
const operationTypeModalTitle = document.getElementById('operation-type-modal-title');
const operationTypeSubmitText = document.getElementById('operation-type-submit-text');
const operationTypeFormError = document.getElementById('operation-type-form-error');

// Event listenery dla typów operacji
document.getElementById('new-operation-type-btn')?.addEventListener('click', () => openOperationTypeModal());
document.getElementById('refresh-operation-types-btn')?.addEventListener('click', loadOperationTypesView);
document.getElementById('operation-type-modal-close')?.addEventListener('click', closeOperationTypeModal);
document.getElementById('operation-type-form-cancel')?.addEventListener('click', closeOperationTypeModal);
operationTypeForm?.addEventListener('submit', handleOperationTypeSubmit);
operationTypeModal?.addEventListener('click', (e) => { if (e.target === operationTypeModal) closeOperationTypeModal(); });

async function loadOperationTypesView() {
    if (!operationTypesTbody) return;

    operationTypesTbody.innerHTML = `
        <tr>
            <td colspan="5" class="px-6 py-12 text-center text-gray-400">
                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                <p class="text-lg">Ładowanie typów operacji...</p>
            </td>
        </tr>
    `;

    try {
        const response = await fetch('/api/production/operation-types', { credentials: 'include' });
        const result = await response.json();

        if (result.status === 'success') {
            operationTypes = result.data || [];
            renderOperationTypes();
        } else {
            operationTypesTbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-12 text-center text-red-500">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>${escapeHtml(result.message || 'Błąd ładowania')}</p>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Błąd ładowania typów operacji:', error);
        operationTypesTbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Błąd połączenia z serwerem</p>
                </td>
            </tr>
        `;
    }
}

function renderOperationTypes() {
    if (!operationTypesTbody) return;

    if (!operationTypes || operationTypes.length === 0) {
        operationTypesTbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-gray-400">
                    <i class="fas fa-tasks text-4xl mb-4"></i>
                    <p class="text-lg">Brak typów operacji</p>
                    <p class="text-sm mt-2">Kliknij "Dodaj typ" aby utworzyć pierwszy</p>
                </td>
            </tr>
        `;
        return;
    }

    operationTypesTbody.innerHTML = operationTypes.map(type => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4">
                <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">${escapeHtml(type.code)}</span>
            </td>
            <td class="px-6 py-4 font-medium text-gray-900">${escapeHtml(type.name)}</td>
            <td class="px-6 py-4 text-gray-600 text-sm">${escapeHtml(type.description || '-')}</td>
            <td class="px-6 py-4 text-center">
                ${type.isActive
                    ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aktywny</span>'
                    : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Nieaktywny</span>'
                }
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="editOperationType(${type.id})" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edytuj">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="toggleOperationTypeActive(${type.id}, ${type.isActive})" class="p-2 ${type.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'} rounded-lg transition-colors" title="${type.isActive ? 'Dezaktywuj' : 'Aktywuj'}">
                        <i class="fas fa-${type.isActive ? 'ban' : 'check'}"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openOperationTypeModal(type = null) {
    if (!operationTypeModal || !operationTypeForm) return;

    operationTypeForm.reset();
    operationTypeFormError?.classList.add('hidden');

    const codeInput = operationTypeForm.querySelector('[name="code"]');

    if (type) {
        operationTypeModalTitle.innerHTML = '<i class="fas fa-tasks"></i> Edytuj typ operacji';
        operationTypeSubmitText.textContent = 'Zapisz zmiany';
        operationTypeForm.querySelector('[name="id"]').value = type.id;
        codeInput.value = type.code || '';
        codeInput.readOnly = true;
        codeInput.classList.add('bg-gray-100');
        operationTypeForm.querySelector('[name="name"]').value = type.name || '';
        operationTypeForm.querySelector('[name="description"]').value = type.description || '';
        operationTypeForm.querySelector('[name="isActive"]').checked = type.isActive !== false;
    } else {
        operationTypeModalTitle.innerHTML = '<i class="fas fa-tasks"></i> Nowy typ operacji';
        operationTypeSubmitText.textContent = 'Utwórz typ';
        operationTypeForm.querySelector('[name="id"]').value = '';
        codeInput.readOnly = false;
        codeInput.classList.remove('bg-gray-100');
        operationTypeForm.querySelector('[name="isActive"]').checked = true;
    }

    operationTypeModal.classList.remove('hidden');
    (type ? operationTypeForm.querySelector('[name="name"]') : codeInput).focus();
}

function closeOperationTypeModal() {
    operationTypeModal?.classList.add('hidden');
}

async function handleOperationTypeSubmit(e) {
    e.preventDefault();

    const formData = new FormData(operationTypeForm);
    const id = formData.get('id');
    const code = formData.get('code')?.trim().toLowerCase();
    const name = formData.get('name')?.trim();
    const description = formData.get('description')?.trim();
    const isActive = formData.get('isActive') === 'on';

    if (!code || !name) {
        showOperationTypeError('Kod i nazwa są wymagane');
        return;
    }

    if (!/^[a-z0-9_]+$/.test(code)) {
        showOperationTypeError('Kod może zawierać tylko małe litery, cyfry i podkreślenia');
        return;
    }

    operationTypeFormError?.classList.add('hidden');

    const data = { name, description: description || null, isActive };
    if (!id) data.code = code;

    try {
        const url = id ? `/api/production/operation-types/${id}` : '/api/production/operation-types';
        const method = id ? 'PATCH' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.status === 'success') {
            showAdminToast(id ? 'Typ operacji zaktualizowany' : 'Typ operacji utworzony', 'success');
            closeOperationTypeModal();
            loadOperationTypesView();
        } else {
            showOperationTypeError(result.message || 'Błąd zapisu');
        }
    } catch (error) {
        console.error('Błąd zapisu typu operacji:', error);
        showOperationTypeError('Błąd połączenia z serwerem');
    }
}

function showOperationTypeError(message) {
    if (operationTypeFormError) {
        const span = operationTypeFormError.querySelector('span');
        if (span) span.textContent = message;
        operationTypeFormError.classList.remove('hidden');
    }
}

window.editOperationType = function(id) {
    const type = operationTypes.find(t => t.id === id);
    if (type) openOperationTypeModal(type);
};

window.toggleOperationTypeActive = async function(id, currentActive) {
    const action = currentActive ? 'dezaktywować' : 'aktywować';
    if (!confirm(`Czy na pewno chcesz ${action} ten typ operacji?`)) return;

    try {
        const response = await fetch(`/api/production/operation-types/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ isActive: !currentActive })
        });

        const result = await response.json();

        if (result.status === 'success') {
            showAdminToast(`Typ operacji ${currentActive ? 'dezaktywowany' : 'aktywowany'}`, 'success');
            loadOperationTypesView();
        } else {
            showAdminToast(result.message || 'Błąd zmiany statusu', 'error');
        }
    } catch (error) {
        console.error('Błąd zmiany statusu typu operacji:', error);
        showAdminToast('Błąd połączenia z serwerem', 'error');
    }
};

// Event listenery dla produkcji
document.getElementById('new-production-room-btn')?.addEventListener('click', () => openProductionRoomModal());

document.getElementById('refresh-production-rooms-btn')?.addEventListener('click', loadProductionRooms);
document.getElementById('new-work-center-btn')?.addEventListener('click', () => openWorkCenterModal());
document.getElementById('refresh-work-centers-btn')?.addEventListener('click', loadWorkCenters);
document.getElementById('new-work-station-btn')?.addEventListener('click', () => openWorkStationModal());
document.getElementById('refresh-work-stations-btn')?.addEventListener('click', loadWorkStations);
document.getElementById('work-centers-room-filter')?.addEventListener('change', filterWorkCenters);
document.getElementById('work-stations-center-filter')?.addEventListener('change', filterWorkStations);
document.getElementById('work-stations-status-filter')?.addEventListener('change', filterWorkStations);

// Ładowanie statystyk produkcji
async function loadProductionStats() {
    try {
        const response = await fetch('/api/production/stats', { credentials: 'include' });
        const result = await response.json();
        
        if (result.status === 'success') {
            const stats = result.data;
            document.getElementById('prod-stats-rooms').textContent = stats.rooms || 0;
            document.getElementById('prod-stats-work-centers').textContent = stats.workCenters || 0;
            document.getElementById('prod-stats-work-stations').textContent = stats.workStations || 0;
            document.getElementById('prod-stats-available').textContent = stats.workStationsByStatus?.available || 0;
        }
    } catch (error) {
        console.error('Błąd ładowania statystyk produkcji:', error);
    }
}

// Ładowanie pokoi produkcyjnych
async function loadProductionRooms() {
    const grid = document.getElementById('production-rooms-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center h-64 text-gray-400">
            <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
            <p class="text-lg">Ładowanie pokoi produkcyjnych...</p>
        </div>
    `;
    
    try {
        await loadProductionStats();
        
        const response = await fetch('/api/production/rooms', { credentials: 'include' });
        const result = await response.json();
        
        if (result.status === 'success') {
            productionRooms = result.data || [];
            renderProductionRooms();
            populateRoomFilters();
        } else {
            throw new Error(result.message || 'Błąd pobierania pokoi');
        }
    } catch (error) {
        console.error('Błąd ładowania pokoi:', error);
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center h-64 text-red-400">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p class="text-lg">Błąd ładowania danych</p>
                <p class="text-sm">${error.message}</p>
            </div>
        `;
    }
}

function renderProductionRooms() {
    const grid = document.getElementById('production-rooms-grid');
    if (!grid) return;
    
    if (productionRooms.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center h-64 text-gray-400">
                <i class="fas fa-door-open text-6xl mb-4"></i>
                <p class="text-lg">Brak pokoi produkcyjnych</p>
                <p class="text-sm">Kliknij "Dodaj pokój" aby utworzyć pierwszy</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = productionRooms.map(room => `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div class="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-lg font-bold text-white">${escapeHtml(room.name)}</h3>
                        <p class="text-amber-100 text-sm font-mono">${escapeHtml(room.code)}</p>
                    </div>
                    <span class="bg-white/20 text-white text-xs px-2 py-1 rounded-full">
                        ${room.workCenterCount || 0} gniazd
                    </span>
                </div>
            </div>
            <div class="p-4">
                ${room.area ? `<p class="text-sm text-gray-600 mb-2"><i class="fas fa-ruler-combined mr-2"></i>${room.area} m²</p>` : ''}
                ${room.supervisor ? `<p class="text-sm text-gray-600 mb-2"><i class="fas fa-user-tie mr-2"></i>${escapeHtml(room.supervisor.name)}</p>` : ''}
                ${room.description ? `<p class="text-sm text-gray-500 mb-3">${escapeHtml(room.description)}</p>` : ''}
                
                ${room.workCenters && room.workCenters.length > 0 ? `
                    <div class="border-t pt-3 mt-3">
                        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Gniazda:</p>
                        <div class="flex flex-wrap gap-1">
                            ${room.workCenters.slice(0, 5).map(wc => `
                                <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">${escapeHtml(wc.name)}</span>
                            `).join('')}
                            ${room.workCenters.length > 5 ? `<span class="text-xs text-gray-400">+${room.workCenters.length - 5}</span>` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <div class="flex gap-2 mt-4">
                    <button onclick="editProductionRoom(${room.id})" class="flex-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                        <i class="fas fa-edit mr-1"></i> Edytuj
                    </button>
                    <button onclick="deleteProductionRoom(${room.id})" class="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Ładowanie gniazd produkcyjnych
async function loadWorkCenters() {
    const grid = document.getElementById('work-centers-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center h-64 text-gray-400">
            <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
            <p class="text-lg">Ładowanie gniazd produkcyjnych...</p>
        </div>
    `;
    
    try {
        // Najpierw załaduj pokoje do filtra
        if (productionRooms.length === 0) {
            const roomsResponse = await fetch('/api/production/rooms', { credentials: 'include' });
            const roomsResult = await roomsResponse.json();
            if (roomsResult.status === 'success') {
                productionRooms = roomsResult.data || [];
                populateRoomFilters();
            }
        }
        
        const response = await fetch('/api/production/work-centers', { credentials: 'include' });
        const result = await response.json();
        
        if (result.status === 'success') {
            workCenters = result.data || [];
            renderWorkCenters(workCenters);
        } else {
            throw new Error(result.message || 'Błąd pobierania gniazd');
        }
    } catch (error) {
        console.error('Błąd ładowania gniazd:', error);
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center h-64 text-red-400">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p class="text-lg">Błąd ładowania danych</p>
            </div>
        `;
    }
}

function renderWorkCenters(centers) {
    const grid = document.getElementById('work-centers-grid');
    if (!grid) return;
    
    if (centers.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center h-64 text-gray-400">
                <i class="fas fa-cogs text-6xl mb-4"></i>
                <p class="text-lg">Brak gniazd produkcyjnych</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = centers.map(wc => `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div class="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-lg font-bold text-white">${escapeHtml(wc.name)}</h3>
                        <p class="text-blue-100 text-sm font-mono">${escapeHtml(wc.code)}</p>
                    </div>
                    <span class="bg-white/20 text-white text-xs px-2 py-1 rounded-full">
                        ${wc.workStationCount || 0} maszyn
                    </span>
                </div>
            </div>
            <div class="p-4">
                <p class="text-sm text-gray-600 mb-2">
                    <i class="fas fa-tag mr-2"></i>${getWorkCenterTypeName(wc.type) || wc.type}
                </p>
                ${wc.room ? `<p class="text-sm text-gray-600 mb-2"><i class="fas fa-door-open mr-2"></i>${escapeHtml(wc.room.name)}</p>` : ''}
                ${wc.description ? `<p class="text-sm text-gray-500 mb-3">${escapeHtml(wc.description)}</p>` : ''}
                
                <div class="flex gap-2 mt-4">
                    <button onclick="editWorkCenter(${wc.id})" class="flex-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                        <i class="fas fa-edit mr-1"></i> Edytuj
                    </button>
                    <button onclick="editWorkCenterPaths(${wc.id})" class="flex-1 px-3 py-1.5 text-sm bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors">
                        <i class="fas fa-route mr-1"></i> Ścieżki
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function filterWorkCenters() {
    const roomId = document.getElementById('work-centers-room-filter')?.value;
    let filtered = workCenters;
    
    if (roomId) {
        filtered = workCenters.filter(wc => wc.roomId == roomId);
    }
    
    renderWorkCenters(filtered);
}

// Ładowanie maszyn
async function loadWorkStations() {
    const grid = document.getElementById('work-stations-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center h-64 text-gray-400">
            <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
            <p class="text-lg">Ładowanie maszyn...</p>
        </div>
    `;
    
    try {
        // Załaduj gniazda do filtra
        if (workCenters.length === 0) {
            const centersResponse = await fetch('/api/production/work-centers', { credentials: 'include' });
            const centersResult = await centersResponse.json();
            if (centersResult.status === 'success') {
                workCenters = centersResult.data || [];
                populateWorkCenterFilters();
            }
        }
        
        const response = await fetch('/api/production/work-stations', { credentials: 'include' });
        const result = await response.json();
        
        if (result.status === 'success') {
            workStations = result.data || [];
            renderWorkStations(workStations);
        } else {
            throw new Error(result.message || 'Błąd pobierania maszyn');
        }
    } catch (error) {
        console.error('Błąd ładowania maszyn:', error);
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center h-64 text-red-400">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p class="text-lg">Błąd ładowania danych</p>
            </div>
        `;
    }
}

function renderWorkStations(stations) {
    const grid = document.getElementById('work-stations-grid');
    if (!grid) return;
    
    if (stations.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center h-64 text-gray-400">
                <i class="fas fa-tools text-6xl mb-4"></i>
                <p class="text-lg">Brak maszyn</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = stations.map(ws => {
        const statusInfo = WORK_STATION_STATUS_LABELS[ws.status] || { label: ws.status, color: 'gray', icon: 'question' };
        
        return `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div class="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-gray-800">${escapeHtml(ws.name)}</h3>
                        <p class="text-gray-500 text-xs font-mono">${escapeHtml(ws.code)}</p>
                    </div>
                    <span class="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-${statusInfo.color}-100 text-${statusInfo.color}-700">
                        <i class="fas fa-${statusInfo.icon}"></i>
                        ${statusInfo.label}
                    </span>
                </div>
                <div class="p-4">
                    <p class="text-sm text-gray-600 mb-1">
                        <i class="fas fa-tag mr-2 text-gray-400"></i>${getWorkCenterTypeName(ws.type) || ws.type}
                    </p>
                    ${ws.manufacturer ? `<p class="text-sm text-gray-600 mb-1"><i class="fas fa-industry mr-2 text-gray-400"></i>${escapeHtml(ws.manufacturer)} ${ws.model || ''}</p>` : ''}
                    ${ws.workCenter ? `<p class="text-sm text-gray-600 mb-1"><i class="fas fa-cogs mr-2 text-gray-400"></i>${escapeHtml(ws.workCenter.name)}</p>` : ''}
                    ${ws.currentOperator ? `<p class="text-sm text-amber-600"><i class="fas fa-user mr-2"></i>${escapeHtml(ws.currentOperator.name)}</p>` : ''}
                    
                    <div class="flex gap-2 mt-3">
                        <button onclick="changeWorkStationStatus(${ws.id}, '${ws.status}')" class="flex-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                            <i class="fas fa-exchange-alt mr-1"></i> Status
                        </button>
                        <button onclick="editWorkStation(${ws.id})" class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function filterWorkStations() {
    const centerId = document.getElementById('work-stations-center-filter')?.value;
    const status = document.getElementById('work-stations-status-filter')?.value;
    
    let filtered = workStations;
    
    if (centerId) {
        filtered = filtered.filter(ws => ws.workCenterId == centerId);
    }
    if (status) {
        filtered = filtered.filter(ws => ws.status === status);
    }
    
    renderWorkStations(filtered);
}

// Populowanie filtrów
function populateRoomFilters() {
    const filter = document.getElementById('work-centers-room-filter');
    if (filter) {
        filter.innerHTML = '<option value="">Wszystkie pokoje</option>' +
            productionRooms.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
    }
}

function populateWorkCenterFilters() {
    const filter = document.getElementById('work-stations-center-filter');
    if (filter) {
        filter.innerHTML = '<option value="">Wszystkie gniazda</option>' +
            workCenters.map(wc => `<option value="${wc.id}">${escapeHtml(wc.name)}</option>`).join('');
    }
}

// Placeholder funkcje do edycji (do rozbudowy)
function openProductionRoomModal(room = null) {
    const name = prompt('Nazwa pokoju:', room?.name || '');
    if (!name) return;
    
    const code = prompt('Kod pokoju (np. LASER-1):', room?.code || '');
    if (!code) return;
    
    const area = prompt('Powierzchnia (m²):', room?.area || '');
    
    saveProductionRoom({ id: room?.id, name, code, area: area ? parseFloat(area) : null });
}

async function saveProductionRoom(data) {
    try {
        const method = data.id ? 'PATCH' : 'POST';
        const url = data.id ? `/api/production/rooms/${data.id}` : '/api/production/rooms';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAdminToast(data.id ? 'Pokój zaktualizowany' : 'Pokój utworzony', 'success');
            loadProductionRooms();
        } else {
            showAdminToast(result.message || 'Błąd zapisu', 'error');
        }
    } catch (error) {
        console.error('Błąd zapisu pokoju:', error);
        showAdminToast('Błąd zapisu', 'error');
    }
}

function editProductionRoom(id) {
    const room = productionRooms.find(r => r.id === id);
    if (room) openProductionRoomModal(room);
}

async function deleteProductionRoom(id) {
    if (!confirm('Czy na pewno chcesz dezaktywować ten pokój?')) return;
    
    try {
        const response = await fetch(`/api/production/rooms/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAdminToast('Pokój dezaktywowany', 'success');
            loadProductionRooms();
        } else {
            showAdminToast(result.message || 'Błąd usuwania', 'error');
        }
    } catch (error) {
        console.error('Błąd usuwania pokoju:', error);
        showAdminToast('Błąd usuwania', 'error');
    }
}

function editWorkCenter(id) {
    const wc = workCenters.find(w => w.id === id);
    if (wc) openWorkCenterModal(wc);
}

async function editWorkCenterPaths(id) {
    const wc = workCenters.find(w => w.id === id);
    if (!wc) return;

    try {
        // Równolegle pobierz listę wszystkich ścieżek oraz bieżące mapowania dla gniazda
        const [pathsResp, mappingsResp] = await Promise.all([
            fetch('/api/production/path-codes', { credentials: 'include' }),
            fetch(`/api/production/workcenters/${encodeURIComponent(id)}/path-mappings`, { credentials: 'include' })
        ]);

        const pathsResult = await pathsResp.json();
        const mappingsResult = await mappingsResp.json();

        if (pathsResult.status !== 'success') {
            showAdminToast(pathsResult.message || 'Nie udało się pobrać listy ścieżek', 'error');
            return;
        }

        if (mappingsResult.status !== 'success') {
            showAdminToast(mappingsResult.message || 'Nie udało się pobrać mapowań ścieżek dla gniazda', 'error');
            return;
        }

        const allPathDetails = (pathsResult.data?.paths || []);
        const allCodes = allPathDetails
            .map(p => (p.baseCode || p.code || '').toString().trim())
            .filter(Boolean);
        const uniqueCodes = [...new Set(allCodes)].sort((a, b) => {
            const aNum = parseFloat(a);
            const bNum = parseFloat(b);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.localeCompare(b, 'pl');
        });

        const currentMappings = (mappingsResult.data?.mappings || []);
        const currentCodes = currentMappings
            .map(m => (m.pathCode || m.pathcode || '').toString().trim())
            .filter(Boolean);

        const promptMessage = [
            `Gniazdo: ${wc.name} [${wc.code}]`,
            '',
            `Dostępne proste ścieżki (z produktów): ${uniqueCodes.length ? uniqueCodes.join(', ') : '(brak danych)'}`,
            `Aktualnie przypisane do tego gniazda: ${currentCodes.length ? currentCodes.join(', ') : '(brak)'}`,
            '',
            'Wpisz kody ścieżek, które mają być powiązane z tym gniazdem (rozdzielone przecinkami),',
            'np. 1,3,5. Produkt ze ścieżką złożoną (np. 5%3&2.1) będzie widoczny we wszystkich gniazdach,',
            'dla których wpiszesz odpowiadające mu proste ścieżki (5, 3, 2).'
        ].join('\n');

        const input = prompt(promptMessage, currentCodes.join(', '));
        if (input === null) return; // anulowano

        const newCodes = [...new Set(
            input
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
        )];

        // Oblicz różnice
        const toAdd = newCodes.filter(code => !currentCodes.includes(code));
        const toRemove = currentCodes.filter(code => !newCodes.includes(code));

        // Zapisz dodawane mapowania
        for (const code of toAdd) {
            try {
                const resp = await fetch(`/api/production/workcenters/${encodeURIComponent(id)}/path-mappings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ pathCode: code })
                });
                const result = await resp.json();
                if (result.status !== 'success') {
                    console.warn('Nie udało się dodać mapowania', id, code, result);
                }
            } catch (e) {
                console.error('Błąd dodawania mapowania ścieżki', code, 'dla gniazda', id, e);
            }
        }

        // Dezaktywuj usuwane mapowania
        for (const code of toRemove) {
            try {
                const resp = await fetch(`/api/production/workcenters/${encodeURIComponent(id)}/path-mappings/${encodeURIComponent(code)}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const result = await resp.json();
                if (result.status !== 'success') {
                    console.warn('Nie udało się usunąć mapowania', id, code, result);
                }
            } catch (e) {
                console.error('Błąd usuwania mapowania ścieżki', code, 'dla gniazda', id, e);
            }
        }

        showAdminToast('Ścieżki dla gniazda zostały zaktualizowane', 'success');

    } catch (error) {
        console.error('Błąd edycji ścieżek gniazda:', error);
        showAdminToast('Błąd podczas aktualizacji ścieżek gniazda', 'error');
    }
}

// Alias dla zgodności wstecznej – właściwa implementacja jest w module "MODAL: MASZYNA / STANOWISKO" na dole pliku
function openWorkStationModal(ws = null) {
    if (typeof window.openWorkStationModal === 'function') {
        return window.openWorkStationModal(ws);
    }
}

function editWorkStation(id) {
    const ws = workStations.find(w => w.id === id);
    if (ws) openWorkStationModal(ws);
}

async function changeWorkStationStatus(id, currentStatus) {
    const statuses = Object.entries(WORK_STATION_STATUS_LABELS).map(([k, v]) => `${k}: ${v.label}`).join('\n');
    const newStatus = prompt(`Nowy status:\n${statuses}`, currentStatus);
    
    if (!newStatus || newStatus === currentStatus) return;
    
    try {
        const response = await fetch(`/api/production/work-stations/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: newStatus })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAdminToast('Status zmieniony', 'success');
            loadWorkStations();
        } else {
            showAdminToast(result.message || 'Błąd zmiany statusu', 'error');
        }
    } catch (error) {
        console.error('Błąd zmiany statusu:', error);
        showAdminToast('Błąd zmiany statusu', 'error');
    }
}

// ============================================
// MODUŁ: ŚCIEŻKI PRODUKCYJNE
// ============================================

let productionPaths = [];

const OPERATION_TYPES = {
    'solvent': 'Solvent',
    'laser_co2': 'Laser CO2',
    'laser_fiber': 'Laser Fiber',
    'uv_print': 'Druk UV',
    'sublimation': 'Sublimacja',
    'assembly': 'Montaż',
    'packing': 'Pakowanie',
    'quality_check': 'Kontrola jakości',
    'graphic_design': 'Projekt graficzny',
    'cnc': 'CNC',
    'engraving': 'Grawerowanie',
    'other': 'Inne'
};

const PHASE_LABELS = {
    'PREP': { label: 'Przygotowanie', color: 'blue' },
    'OP': { label: 'Operacja', color: 'amber' },
    'PACK': { label: 'Pakowanie', color: 'green' }
};

// Elementy DOM
const productionPathsTbody = document.getElementById('production-paths-tbody');
const newProductionPathBtn = document.getElementById('new-production-path-btn');
const refreshProductionPathsBtn = document.getElementById('refresh-production-paths-btn');
const productionPathModal = document.getElementById('production-path-modal');
const productionPathModalTitle = document.getElementById('production-path-modal-title');
const productionPathModalClose = document.getElementById('production-path-modal-close');
const productionPathForm = document.getElementById('production-path-form');
const productionPathFormCancel = document.getElementById('production-path-form-cancel');
const productionPathFormError = document.getElementById('production-path-form-error');
const productionPathSubmitText = document.getElementById('production-path-submit-text');
const operationsContainer = document.getElementById('operations-container');
const addOperationBtn = document.getElementById('add-operation-btn');

// Event listenery
if (newProductionPathBtn) newProductionPathBtn.addEventListener('click', () => openProductionPathModal());
if (refreshProductionPathsBtn) refreshProductionPathsBtn.addEventListener('click', loadProductionPaths);
if (productionPathModalClose) productionPathModalClose.addEventListener('click', closeProductionPathModal);
if (productionPathFormCancel) productionPathFormCancel.addEventListener('click', closeProductionPathModal);
if (productionPathForm) productionPathForm.addEventListener('submit', handleProductionPathSubmit);
if (addOperationBtn) addOperationBtn.addEventListener('click', () => addOperationRow());
if (productionPathsTbody) productionPathsTbody.addEventListener('click', handleProductionPathsTableClick);

async function loadProductionPaths() {
    if (!productionPathsTbody) return;
    
    productionPathsTbody.innerHTML = `
        <tr>
            <td colspan="5" class="px-6 py-12 text-center text-gray-400">
                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                <p class="text-lg">Ładowanie ścieżek...</p>
            </td>
        </tr>
    `;
    
    try {
        const response = await fetch('/api/production/paths', { credentials: 'include' });
        const result = await response.json();
        
        if (result.status === 'success') {
            productionPaths = result.data || [];
            renderProductionPaths();
        } else {
            productionPathsTbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-12 text-center text-red-500">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>${escapeHtml(result.message || 'Błąd ładowania')}</p>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Błąd ładowania ścieżek:', error);
        productionPathsTbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Błąd połączenia z serwerem</p>
                </td>
            </tr>
        `;
    }
}

function renderProductionPaths() {
    if (!productionPathsTbody) return;
    
    if (productionPaths.length === 0) {
        productionPathsTbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-gray-400">
                    <i class="fas fa-route text-4xl mb-4"></i>
                    <p class="text-lg">Brak zdefiniowanych ścieżek</p>
                    <p class="text-sm mt-2">Kliknij "Dodaj ścieżkę" aby utworzyć pierwszą</p>
                </td>
            </tr>
        `;
        return;
    }
    
    productionPathsTbody.innerHTML = productionPaths.map(path => {
        const operations = path.operations || [];
        const operationsHtml = operations.slice(0, 4).map(op => {
            const phase = PHASE_LABELS[op.phase] || PHASE_LABELS['OP'];
            const typeName = getOperationTypeName(op.operationType);
            return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-${phase.color}-100 text-${phase.color}-700">${escapeHtml(typeName)}</span>`;
        }).join(' → ');
        
        const moreOps = operations.length > 4 ? `<span class="text-gray-400 text-xs ml-1">+${operations.length - 4}</span>` : '';
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4">
                    <span class="font-mono font-bold text-amber-600">${escapeHtml(path.code)}</span>
                </td>
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${escapeHtml(path.name)}</div>
                    ${path.description ? `<div class="text-sm text-gray-500 truncate max-w-xs">${escapeHtml(path.description)}</div>` : ''}
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-wrap items-center gap-1">
                        ${operationsHtml}${moreOps}
                    </div>
                    <div class="text-xs text-gray-400 mt-1">${operations.length} ${operations.length === 1 ? 'operacja' : operations.length < 5 ? 'operacje' : 'operacji'}</div>
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${path.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        ${path.isActive !== false ? 'Aktywna' : 'Nieaktywna'}
                    </span>
                </td>
                <td class="px-6 py-4 text-right">
                    <button class="text-blue-600 hover:text-blue-800 mr-3" data-action="edit" data-id="${path.id}" title="Edytuj">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-600 hover:text-red-800" data-action="delete" data-id="${path.id}" title="Dezaktywuj">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function handleProductionPathsTableClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const id = parseInt(btn.dataset.id, 10);
    
    if (action === 'edit') {
        editProductionPath(id);
    } else if (action === 'delete') {
        deleteProductionPath(id);
    }
}

async function openProductionPathModal(path = null) {
    if (!productionPathModal || !productionPathForm) return;
    
    productionPathForm.reset();
    productionPathFormError?.classList.add('hidden');

    // Upewnij się, że słownik typów operacji jest załadowany przed zbudowaniem formularza
    await loadOperationTypes();
    
    if (path) {
        productionPathModalTitle.textContent = 'Edytuj ścieżkę';
        productionPathSubmitText.textContent = 'Zapisz zmiany';
        productionPathForm.querySelector('[name="id"]').value = path.id;
        productionPathForm.querySelector('[name="code"]').value = path.code || '';
        productionPathForm.querySelector('[name="name"]').value = path.name || '';
        productionPathForm.querySelector('[name="description"]').value = path.description || '';
        
        // Wypełnij operacje
        operationsContainer.innerHTML = '';
        const operations = path.operations || [];
        operations.forEach((op, index) => addOperationRow(op, index + 1));
        
        if (operations.length === 0) {
            addOperationRow(null, 1);
        }
    } else {
        productionPathModalTitle.textContent = 'Nowa ścieżka produkcyjna';
        productionPathSubmitText.textContent = 'Utwórz ścieżkę';
        productionPathForm.querySelector('[name="id"]').value = '';
        
        // Dodaj jedną pustą operację
        operationsContainer.innerHTML = '';
        addOperationRow(null, 1);
    }
    
    productionPathModal.classList.remove('hidden');
}

function closeProductionPathModal() {
    productionPathModal?.classList.add('hidden');
}

function addOperationRow(operation = null, step = null) {

    if (!operationsContainer) return;
    
    const existingRows = operationsContainer.querySelectorAll('.operation-row');
    const stepNum = step || existingRows.length + 1;
    
    const phaseOptions = Object.entries(PHASE_LABELS).map(([key, val]) => 
        `<option value="${key}" ${operation?.phase === key ? 'selected' : ''}>${val.label}</option>`
    ).join('');

    let typeOptions = '';
    const opTypeValue = operation?.operationType || '';

    // Jeśli nie mamy jeszcze danych z API, spróbuj je pobrać w tle
    if (!operationTypes || operationTypes.length === 0) {
        loadOperationTypes();
    }

    const activeTypes = (operationTypes || []).filter(t => t.isActive !== false);

    if (activeTypes.length > 0) {
        typeOptions = activeTypes.map(t => 
            `<option value="${t.code}" ${opTypeValue === t.code ? 'selected' : ''}>${escapeHtml(t.name)}</option>`
        ).join('');
    }

    // Fallback: jeśli z jakiegoś powodu nie ma danych z API, użyj stałej OPERATION_TYPES
    if (!typeOptions) {
        typeOptions = Object.entries(OPERATION_TYPES).map(([key, val]) => 
            `<option value="${key}" ${opTypeValue === key ? 'selected' : ''}>${val}</option>`
        ).join('');
    }

    // Jeżeli edytujemy ścieżkę z typem, który nie jest już aktywny / nie istnieje w słowniku,
    // dodaj go jako opcję awaryjną, żeby nie zgubić danych
    if (opTypeValue) {
        const hasValue = typeOptions.includes(`value="${opTypeValue}"`);
        if (!hasValue) {
            const fallbackName = getOperationTypeName(opTypeValue);
            typeOptions += `<option value="${opTypeValue}" selected>${escapeHtml(fallbackName)} (nieaktywny)</option>`;
        }
    }
    
    const row = document.createElement('div');
    row.className = 'operation-row p-4 bg-gray-50 rounded-lg border border-gray-200 mb-3';
    row.innerHTML = `
        <div class="flex items-start gap-4">
            <span class="w-10 h-10 flex items-center justify-center bg-amber-100 text-amber-700 rounded-full font-bold text-lg flex-shrink-0">${stepNum}</span>
            <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Faza</label>
                    <select name="op_phase" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                        ${phaseOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Typ operacji <span class="text-red-500">*</span></label>
                    <select name="op_type" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium">
                        ${typeOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Czas (min)</label>
                    <input type="number" name="op_time" placeholder="np. 15" value="${operation?.estimatedTimeMin || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" min="0">
                </div>
            </div>
            <div class="flex flex-col gap-1 flex-shrink-0">
                <button type="button" class="move-operation-up-btn text-gray-400 hover:text-gray-700 p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Przenieś operację w górę">
                    <i class="fas fa-chevron-up"></i>
                </button>
                <button type="button" class="move-operation-down-btn text-gray-400 hover:text-gray-700 p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Przenieś operację w dół">
                    <i class="fas fa-chevron-down"></i>
                </button>
                <button type="button" class="remove-operation-btn text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Usuń operację">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    const removeBtn = row.querySelector('.remove-operation-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            row.remove();
            renumberOperations();
        });
    }

    const moveUpBtn = row.querySelector('.move-operation-up-btn');
    if (moveUpBtn) {
        moveUpBtn.addEventListener('click', () => moveOperationRow(row, -1));
    }

    const moveDownBtn = row.querySelector('.move-operation-down-btn');
    if (moveDownBtn) {
        moveDownBtn.addEventListener('click', () => moveOperationRow(row, 1));
    }
    
    operationsContainer.appendChild(row);
}

function moveOperationRow(row, direction) {
    if (!operationsContainer || !row) return;

    if (direction < 0) {
        const prev = row.previousElementSibling;
        if (!prev || !prev.classList.contains('operation-row')) return;
        operationsContainer.insertBefore(row, prev);
    } else if (direction > 0) {
        const next = row.nextElementSibling;
        if (!next || !next.classList.contains('operation-row')) return;
        operationsContainer.insertBefore(next, row);
    }

    renumberOperations();
}

function renumberOperations() {

    const rows = operationsContainer?.querySelectorAll('.operation-row');
    rows?.forEach((row, index) => {
        const stepBadge = row.querySelector('span');
        if (stepBadge) stepBadge.textContent = index + 1;
    });
}

function collectOperations() {
    const operations = [];
    const rows = operationsContainer?.querySelectorAll('.operation-row');
    
    rows?.forEach((row, index) => {
        const phase = row.querySelector('[name="op_phase"]')?.value;
        const operationType = row.querySelector('[name="op_type"]')?.value;
        const estimatedTimeMin = parseInt(row.querySelector('[name="op_time"]')?.value, 10) || null;
        
        if (phase && operationType) {
            operations.push({
                step: index + 1,
                phase,
                operationType,
                estimatedTimeMin
            });
        }
    });
    
    return operations;
}

async function handleProductionPathSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(productionPathForm);
    const id = formData.get('id');
    const code = formData.get('code')?.trim();
    const name = formData.get('name')?.trim();
    const description = formData.get('description')?.trim();
    const operations = collectOperations();
    
    if (!code || !name) {
        productionPathFormError.textContent = 'Kod i nazwa są wymagane';
        productionPathFormError.classList.remove('hidden');
        return;
    }
    
    if (operations.length === 0) {
        productionPathFormError.textContent = 'Dodaj przynajmniej jedną operację';
        productionPathFormError.classList.remove('hidden');
        return;
    }
    
    productionPathFormError?.classList.add('hidden');
    
    const data = { code, name, description, operations };
    
    try {
        const url = id ? `/api/production/paths/${id}` : '/api/production/paths';
        const method = id ? 'PATCH' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAdminToast(id ? 'Ścieżka zaktualizowana' : 'Ścieżka utworzona', 'success');
            closeProductionPathModal();
            loadProductionPaths();
        } else {
            productionPathFormError.textContent = result.message || 'Błąd zapisu';
            productionPathFormError.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Błąd zapisu ścieżki:', error);
        productionPathFormError.textContent = 'Błąd połączenia z serwerem';
        productionPathFormError.classList.remove('hidden');
    }
}

function editProductionPath(id) {
    const path = productionPaths.find(p => p.id === id);
    if (path) openProductionPathModal(path);
}

async function deleteProductionPath(id) {
    const path = productionPaths.find(p => p.id === id);
    if (!path) return;
    
    if (!confirm(`Czy na pewno chcesz dezaktywować ścieżkę "${path.code} - ${path.name}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/production/paths/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAdminToast('Ścieżka dezaktywowana', 'success');
            loadProductionPaths();
        } else {
            showAdminToast(result.message || 'Błąd dezaktywacji', 'error');
        }
    } catch (error) {
        console.error('Błąd dezaktywacji ścieżki:', error);
        showAdminToast('Błąd połączenia', 'error');
    }
}

// ============================================
// MODUŁ: ZLECENIA PRODUKCYJNE
// ============================================

let productionOrdersData = [];
let filteredProductionOrders = [];

const PROD_ORDER_STATUS_LABELS = {
    planned: 'Zaplanowane',
    approved: 'Zatwierdzone',
    in_progress: 'W realizacji',
    completed: 'Zakończone',
    cancelled: 'Anulowane'
};

const PROD_ORDER_STATUS_CLASSES = {
    planned: 'bg-blue-100 text-blue-800',
    approved: 'bg-indigo-100 text-indigo-800',
    in_progress: 'bg-amber-100 text-amber-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800'
};

const PRIORITY_LABELS = {
    1: 'Pilne',
    2: 'Wysokie',
    3: 'Normalne',
    4: 'Niskie',
    5: 'Bardzo niskie'
};

const PRIORITY_CLASSES = {
    1: 'bg-red-100 text-red-800',
    2: 'bg-orange-100 text-orange-800',
    3: 'bg-gray-100 text-gray-800',
    4: 'bg-blue-100 text-blue-800',
    5: 'bg-gray-50 text-gray-500'
};

// Elementy DOM
const productionOrdersTbody = document.getElementById('production-orders-tbody');
const refreshProductionOrdersBtn = document.getElementById('refresh-production-orders-btn');
const prodOrdersSearch = document.getElementById('prod-orders-search');
const prodOrdersStatusFilter = document.getElementById('prod-orders-status-filter');
const prodOrdersPriorityFilter = document.getElementById('prod-orders-priority-filter');

// Statystyki
const statTotal = document.getElementById('prod-orders-stat-total');
const statPlanned = document.getElementById('prod-orders-stat-planned');
const statInProgress = document.getElementById('prod-orders-stat-in-progress');
const statCompleted = document.getElementById('prod-orders-stat-completed');
const statCancelled = document.getElementById('prod-orders-stat-cancelled');

// Event listenery
if (refreshProductionOrdersBtn) refreshProductionOrdersBtn.addEventListener('click', loadProductionOrders);
if (prodOrdersSearch) prodOrdersSearch.addEventListener('input', filterProductionOrders);
if (prodOrdersStatusFilter) prodOrdersStatusFilter.addEventListener('change', filterProductionOrders);
if (prodOrdersPriorityFilter) prodOrdersPriorityFilter.addEventListener('change', filterProductionOrders);

async function loadProductionOrders() {
    if (!productionOrdersTbody) return;
    
    productionOrdersTbody.innerHTML = `
        <tr>
            <td colspan="8" class="px-6 py-12 text-center text-gray-400">
                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                <p class="text-lg">Ładowanie zleceń...</p>
            </td>
        </tr>
    `;
    
    try {
        const response = await fetch('/api/production/orders?limit=200', { credentials: 'include' });
        const result = await response.json();
        
        if (result.status === 'success') {
            productionOrdersData = result.data || [];
            updateProductionOrdersStats();
            filterProductionOrders();
        } else {
            productionOrdersTbody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-6 py-12 text-center text-red-500">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>${result.message || 'Błąd ładowania zleceń'}</p>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Błąd ładowania zleceń produkcyjnych:', error);
        productionOrdersTbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-12 text-center text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Błąd połączenia z serwerem</p>
                </td>
            </tr>
        `;
    }
}

function updateProductionOrdersStats() {
    const stats = {
        total: productionOrdersData.length,
        planned: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0
    };
    
    productionOrdersData.forEach(order => {
        if (order.status === 'planned' || order.status === 'approved') stats.planned++;
        else if (order.status === 'in_progress') stats.in_progress++;
        else if (order.status === 'completed') stats.completed++;
        else if (order.status === 'cancelled') stats.cancelled++;
    });
    
    if (statTotal) statTotal.textContent = stats.total;
    if (statPlanned) statPlanned.textContent = stats.planned;
    if (statInProgress) statInProgress.textContent = stats.in_progress;
    if (statCompleted) statCompleted.textContent = stats.completed;
    if (statCancelled) statCancelled.textContent = stats.cancelled;
}

function filterProductionOrders() {
    const searchTerm = (prodOrdersSearch?.value || '').toLowerCase();
    const statusFilter = prodOrdersStatusFilter?.value || '';
    const priorityFilter = prodOrdersPriorityFilter?.value || '';
    
    filteredProductionOrders = productionOrdersData.filter(order => {
        // Filtr wyszukiwania
        const orderNum = (order.ordernumber || '').toLowerCase();
        const sourceOrderNum = (order.sourceOrder?.orderNumber || order.sourceOrder?.ordernumber || '').toLowerCase();
        const productName = (order.product?.name || order.product?.identifier || '').toLowerCase();
        const matchesSearch = !searchTerm || 
            orderNum.includes(searchTerm) || 
            sourceOrderNum.includes(searchTerm) ||
            productName.includes(searchTerm);
        
        // Filtr statusu
        const matchesStatus = !statusFilter || order.status === statusFilter;
        
        // Filtr priorytetu
        const matchesPriority = !priorityFilter || order.priority === parseInt(priorityFilter, 10);
        
        return matchesSearch && matchesStatus && matchesPriority;
    });
    
    renderProductionOrders();
}

function renderProductionOrders() {
    if (!productionOrdersTbody) return;
    
    if (filteredProductionOrders.length === 0) {
        productionOrdersTbody.innerHTML = `
            <tr>
                <td colspan="10" class="px-6 py-12 text-center text-gray-400">
                    <i class="fas fa-clipboard-list text-4xl mb-4"></i>
                    <p class="text-lg">Brak zleceń produkcyjnych</p>
                    <p class="text-sm mt-1">Zlecenia pojawią się automatycznie po zatwierdzeniu zamówień</p>
                </td>
            </tr>
        `;
        return;
    }
    
    productionOrdersTbody.innerHTML = filteredProductionOrders.map(order => {
        const orderNumber = order.ordernumber || '-';
        const sourceOrderNumber = order.sourceOrder?.orderNumber || order.sourceOrder?.ordernumber || '-';
        const productName = order.product?.identifier || order.product?.name || order.product?.code || '-';
        const quantity = order.quantity || 0;
        const status = order.status || 'planned';
        const progress = order.progress || { completed: 0, total: 0, percent: 0, label: '0/0' };
        const createdAt = order.createdat ? new Date(order.createdat).toLocaleDateString('pl-PL') : '-';
        
        // Ścieżka (czytelna nazwa)
        const pathNames = order.pathNames || order.productionpathexpression || '-';
        
        // Aktualny etap
        const currentStep = order.currentStep;
        let currentStepHtml = '<span class="text-gray-400 text-xs">-</span>';
        if (currentStep) {
            if (currentStep.phase === 'DONE') {
                currentStepHtml = '<span class="text-green-600 text-xs font-medium"><i class="fas fa-check mr-1"></i>Zakończone</span>';
            } else {
                const stepLabel = escapeHtml(currentStep.label || currentStep.operationType || currentStep.phase || '-');
                const stepStatusClass = currentStep.status === 'active' ? 'text-amber-600' : 'text-blue-600';
                currentStepHtml = `<span class="${stepStatusClass} text-xs font-medium">${stepLabel}</span>`;
            }
        }
        
        const statusLabel = PROD_ORDER_STATUS_LABELS[status] || status;
        const statusClass = PROD_ORDER_STATUS_CLASSES[status] || 'bg-gray-100 text-gray-800';
        
        // Pasek postępu
        const progressBarColor = status === 'completed' ? 'bg-green-500' : 
                                 status === 'cancelled' ? 'bg-red-300' : 
                                 progress.percent > 0 ? 'bg-amber-500' : 'bg-blue-500';
        
        const progressHtml = `
            <div class="flex items-center gap-2">
                <div class="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
                    <div class="${progressBarColor} h-2 rounded-full transition-all" style="width: ${progress.percent}%"></div>
                </div>
                <span class="text-xs font-medium text-gray-600 whitespace-nowrap">${progress.label}</span>
            </div>
        `;
        
        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3">
                    <div class="font-medium text-gray-900">${escapeHtml(orderNumber)}</div>
                    ${order.branchcode ? `<div class="text-xs text-gray-500">Gałąź ${order.branchcode}</div>` : ''}
                </td>
                <td class="px-4 py-3">
                    <div class="text-sm text-gray-700">${escapeHtml(sourceOrderNumber)}</div>
                    ${order.sourceOrder?.customer?.name ? `<div class="text-xs text-gray-500">${escapeHtml(order.sourceOrder.customer.name)}</div>` : ''}
                </td>
                <td class="px-4 py-3">
                    <div class="text-sm text-gray-900 max-w-[180px] truncate" title="${escapeHtml(productName)}">${escapeHtml(productName)}</div>
                </td>
                <td class="px-4 py-3">
                    <div class="text-sm text-purple-700 max-w-[160px] truncate" title="${escapeHtml(pathNames)}">${escapeHtml(pathNames)}</div>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="font-medium text-gray-900">${quantity}</span>
                </td>
                <td class="px-4 py-3">
                    ${currentStepHtml}
                </td>
                <td class="px-4 py-3 min-w-[120px]">
                    ${progressHtml}
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="px-2 py-1 rounded text-xs font-medium ${statusClass}">${statusLabel}</span>
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-500">
                    ${createdAt}
                </td>
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="changeProductionOrderStatus('${order.id}', '${status}')" 
                                class="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Zmień status">
                            <i class="fas fa-exchange-alt text-xs"></i>
                        </button>
                        <button onclick="deleteProductionOrder('${order.id}', '${escapeHtml(orderNumber)}', '${status}')" 
                                class="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Usuń zlecenie">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Zmiana statusu zlecenia produkcyjnego
async function changeProductionOrderStatus(orderId, currentStatus) {
    const statusOptions = [
        { value: 'planned', label: 'Zaplanowane' },
        { value: 'approved', label: 'Zatwierdzone' },
        { value: 'in_progress', label: 'W realizacji' },
        { value: 'paused', label: 'Wstrzymane' },
        { value: 'completed', label: 'Zakończone' },
        { value: 'cancelled', label: 'Anulowane' }
    ];
    
    const optionsHtml = statusOptions.map(opt => 
        `${opt.value === currentStatus ? '→ ' : ''}${opt.label} (${opt.value})`
    ).join('\n');
    
    const newStatus = prompt(`Zmień status zlecenia.\nObecny: ${currentStatus}\n\nDostępne statusy:\n${optionsHtml}\n\nWpisz nowy status:`);
    
    if (!newStatus || newStatus === currentStatus) return;
    
    if (!statusOptions.find(s => s.value === newStatus)) {
        showAdminToast('Nieprawidłowy status', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/production/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: newStatus })
        });
        
        const result = await response.json();
        if (result.status === 'success') {
            showAdminToast('Status zlecenia zmieniony', 'success');
            loadProductionOrders();
        } else {
            showAdminToast(result.message || 'Nie udało się zmienić statusu', 'error');
        }
    } catch (error) {
        console.error('Błąd zmiany statusu:', error);
        showAdminToast('Błąd połączenia z serwerem', 'error');
    }
}

// Usuwanie zlecenia produkcyjnego
async function deleteProductionOrder(orderId, orderNumber, status) {
    if (status === 'in_progress') {
        if (!confirm(`Zlecenie ${orderNumber} jest W REALIZACJI!\n\nCzy na pewno chcesz je usunąć?`)) {
            return;
        }
    } else {
        if (!confirm(`Czy na pewno chcesz usunąć zlecenie ${orderNumber}?`)) {
            return;
        }
    }
    
    try {
        const response = await fetch(`/api/production/orders/${orderId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const result = await response.json();
        if (result.status === 'success') {
            showAdminToast('Zlecenie produkcyjne usunięte', 'success');
            loadProductionOrders();
        } else {
            showAdminToast(result.message || 'Nie udało się usunąć zlecenia', 'error');
        }
    } catch (error) {
        console.error('Błąd usuwania zlecenia:', error);
        showAdminToast('Błąd połączenia z serwerem', 'error');
    }
}

// ============================================
// MODUŁ: ZARZĄDZANIE DZIAŁAMI
// ============================================

// Elementy DOM dla widoku działów
const navDepartments = document.getElementById('nav-departments');
const viewDepartments = document.getElementById('view-departments');
const newDepartmentBtn = document.getElementById('new-department-btn');
const refreshDepartmentsBtn = document.getElementById('refresh-departments-btn');
const departmentsTableBody = document.getElementById('departments-table-body');

let allDepartmentsList = [];

// Inicjalizacja widoku działów
if (navDepartments) {
    navDepartments.addEventListener('click', (e) => {
        e.preventDefault();
        // Ukryj inne widoki
        document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
        // Pokaż widok działów
        if (viewDepartments) viewDepartments.classList.remove('hidden');
        // Aktualizuj aktywny element menu
        document.querySelectorAll('aside a').forEach(a => a.classList.remove('bg-blue-50', 'text-blue-600'));
        navDepartments.classList.add('bg-blue-50', 'text-blue-600');
        // Załaduj dane
        fetchDepartmentsList();
    });
}

if (refreshDepartmentsBtn) refreshDepartmentsBtn.addEventListener('click', fetchDepartmentsList);
if (newDepartmentBtn) newDepartmentBtn.addEventListener('click', () => openDepartmentModal());

// Pobieranie listy działów
async function fetchDepartmentsList() {
    if (!departmentsTableBody) return;
    
    departmentsTableBody.innerHTML = `
        <tr>
            <td colspan="5" class="p-8 text-center text-gray-500">
                <div class="flex flex-col items-center gap-2">
                    <i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
                    <span>Ładowanie działów...</span>
                </div>
            </td>
        </tr>
    `;
    
    try {
        const res = await fetch('/api/admin/departments', { credentials: 'include' });
        const json = await res.json();
        
        if (json.status === 'success') {
            allDepartmentsList = json.data || [];
            renderDepartmentsTable();
            updateDepartmentsStats();
        } else {
            departmentsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-8 text-center text-red-500">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>Błąd ładowania działów: ${escapeHtml(json.message)}</p>
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error('Błąd podczas pobierania działów:', err);
        departmentsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-8 text-center text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Błąd połączenia z serwerem</p>
                </td>
            </tr>
        `;
    }
}

// Renderowanie tabeli działów
function renderDepartmentsTable() {
    if (!departmentsTableBody) return;
    
    if (allDepartmentsList.length === 0) {
        departmentsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-8 text-center text-gray-500">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fas fa-building text-4xl mb-2"></i>
                        <p>Brak działów w systemie</p>
                        <button onclick="openDepartmentModal()" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <i class="fas fa-plus mr-2"></i>Dodaj pierwszy dział
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    departmentsTableBody.innerHTML = allDepartmentsList.map(dept => `
        <tr class="hover:bg-gray-50">
            <td class="p-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-building text-blue-600"></i>
                    </div>
                    <div>
                        <div class="font-medium text-gray-900">${escapeHtml(dept.name)}</div>
                        <div class="text-xs text-gray-500">ID: ${escapeHtml(dept.id)}</div>
                    </div>
                </div>
            </td>
            <td class="p-4 text-center">
                ${dept.isActive 
                    ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aktywny</span>'
                    : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Nieaktywny</span>'
                }
            </td>
            <td class="p-4 text-center">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${dept.userCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}">
                    ${dept.userCount || 0}
                </span>
            </td>
            <td class="p-4 text-gray-600">
                ${new Date(dept.createdAt).toLocaleDateString('pl-PL')}
            </td>
            <td class="p-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="editDepartment('${dept.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edytuj">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${dept.isActive 
                        ? `<button onclick="deleteDepartment('${dept.id}', '${escapeHtml(dept.name)}')" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Usuń">
                            <i class="fas fa-trash"></i>
                          </button>`
                        : `<button onclick="restoreDepartment('${dept.id}', '${escapeHtml(dept.name)}')" class="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Przywróć">
                            <i class="fas fa-undo"></i>
                          </button>`
                    }
                </div>
            </td>
        </tr>
    `).join('');
}

// Aktualizacja statystyk działów
function updateDepartmentsStats() {
    const total = allDepartmentsList.length;
    const active = allDepartmentsList.filter(d => d.isActive).length;
    const totalUsers = allDepartmentsList.reduce((sum, dept) => sum + (dept.userCount || 0), 0);
    
    const statTotal = document.getElementById('dept-stats-total');
    const statActive = document.getElementById('dept-stats-active');
    const statUsers = document.getElementById('dept-stats-users');
    
    if (statTotal) statTotal.textContent = total;
    if (statActive) statActive.textContent = active;
    if (statUsers) statUsers.textContent = totalUsers;
}

// Otwieranie modala działu (dodawanie/edycja)
function openDepartmentModal(dept = null) {
    const name = prompt('Nazwa działu:', dept?.name || '');
    if (!name || !name.trim()) return;

    const deptData = { name: name.trim() };

    if (dept) {
        deptData.isActive = dept.isActive;
        saveDepartment(dept.id, deptData);
    } else {
        saveDepartment(null, deptData);
    }
}

// Edycja działu
function editDepartment(id) {
    const dept = allDepartmentsList.find(d => d.id === id);
    if (dept) {
        openDepartmentModal(dept);
    }
}

// Zapis działu (tworzenie lub aktualizacja)
async function saveDepartment(id, data) {
    try {
        const method = id ? 'PATCH' : 'POST';
        const url = id ? `/api/admin/departments/${id}` : '/api/admin/departments';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.status === 'success') {
            fetchDepartmentsList();
            showAdminToast(id ? 'Dział zaktualizowany' : 'Dział utworzony', 'success');
        } else {
            showAdminToast(result.message || 'Błąd podczas zapisu działu', 'error');
        }
    } catch (err) {
        console.error('Błąd podczas zapisu działu:', err);
        showAdminToast('Błąd połączenia z serwerem', 'error');
    }
}

// Usuwanie działu
async function deleteDepartment(id, name) {
    const dept = allDepartmentsList.find(d => d.id === id);
    const userCount = dept?.userCount || 0;
    
    if (userCount > 0) {
        showAdminToast(`Nie można usunąć działu "${name}". Przypisanych jest ${userCount} użytkowników.`, 'error');
        return;
    }

    if (!confirm(`Czy na pewno chcesz usunąć dział "${name}"?`)) return;

    try {
        const response = await fetch(`/api/admin/departments/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const result = await response.json();

        if (result.status === 'success') {
            fetchDepartmentsList();
            showAdminToast('Dział usunięty', 'success');
        } else {
            showAdminToast(result.message || 'Błąd podczas usuwania działu', 'error');
        }
    } catch (err) {
        console.error('Błąd podczas usuwania działu:', err);
        showAdminToast('Błąd połączenia z serwerem', 'error');
    }
}

// Przywracanie działu
async function restoreDepartment(id, name) {
    if (!confirm(`Czy na pewno chcesz przywrócić dział "${name}"?`)) return;

    try {
        const response = await fetch(`/api/admin/departments/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, isActive: true })
        });

        const result = await response.json();

        if (result.status === 'success') {
            fetchDepartmentsList();
            showAdminToast('Dział przywrócony', 'success');
        } else {
            showAdminToast(result.message || 'Błąd podczas przywracania działu', 'error');
        }
    } catch (err) {
        console.error('Błąd podczas przywracania działu:', err);
        showAdminToast('Błąd połączenia z serwerem', 'error');
    }
}

// ============================================
// MODALE PRODUKCYJNE - POKOJE, GNIAZDA, MASZYNY
// (Nadpisują stare funkcje oparte na prompt())
// ============================================

(function initProductionModals() {
    // Elementy DOM dla modali
    const productionRoomModal = document.getElementById('production-room-modal');
    const productionRoomForm = document.getElementById('production-room-form');
    const productionRoomModalTitle = document.getElementById('production-room-modal-title');
    const productionRoomSubmitText = document.getElementById('production-room-submit-text');
    const productionRoomFormError = document.getElementById('production-room-form-error');

    const workCenterModal = document.getElementById('work-center-modal');
    const workCenterForm = document.getElementById('work-center-form');
    const workCenterModalTitle = document.getElementById('work-center-modal-title');
    const workCenterSubmitText = document.getElementById('work-center-submit-text');
    const workCenterFormError = document.getElementById('work-center-form-error');

    const workStationModal = document.getElementById('work-station-modal');
    const workStationForm = document.getElementById('work-station-form');
    const workStationModalTitle = document.getElementById('work-station-modal-title');
    const workStationSubmitText = document.getElementById('work-station-submit-text');
    const workStationFormError = document.getElementById('work-station-form-error');

    // Event listenery dla modali
    document.getElementById('production-room-modal-close')?.addEventListener('click', closeProductionRoomModal);
    document.getElementById('production-room-form-cancel')?.addEventListener('click', closeProductionRoomModal);
    productionRoomForm?.addEventListener('submit', handleProductionRoomSubmit);

    document.getElementById('work-center-modal-close')?.addEventListener('click', closeWorkCenterModal);
    document.getElementById('work-center-form-cancel')?.addEventListener('click', closeWorkCenterModal);
    workCenterForm?.addEventListener('submit', handleWorkCenterSubmit);

    document.getElementById('work-station-modal-close')?.addEventListener('click', closeWorkStationModal);
    document.getElementById('work-station-form-cancel')?.addEventListener('click', closeWorkStationModal);
    workStationForm?.addEventListener('submit', handleWorkStationSubmit);

    // Zamykanie modali przy kliknięciu w tło
    productionRoomModal?.addEventListener('click', (e) => { if (e.target === productionRoomModal) closeProductionRoomModal(); });
    workCenterModal?.addEventListener('click', (e) => { if (e.target === workCenterModal) closeWorkCenterModal(); });
    workStationModal?.addEventListener('click', (e) => { if (e.target === workStationModal) closeWorkStationModal(); });

    // ============================================
    // MODAL: POKÓJ PRODUKCYJNY
    // ============================================

    window.openProductionRoomModal = function(room = null) {
        if (!productionRoomModal || !productionRoomForm) return;
        
        productionRoomForm.reset();
        productionRoomFormError?.classList.add('hidden');
        
        // Załaduj selecty z użytkownikami
        populateSupervisorSelect();
        populateRoomManagerSelect();
        
        // Sekcja operatorów - ukryj domyślnie
        const operatorsSection = document.getElementById('room-operators-section');
        operatorsSection?.classList.add('hidden');
        
        if (room) {
            productionRoomModalTitle.innerHTML = '<i class="fas fa-door-open"></i> Edytuj pokój produkcyjny';
            productionRoomSubmitText.textContent = 'Zapisz zmiany';
            productionRoomForm.querySelector('[name="id"]').value = room.id;
            productionRoomForm.querySelector('[name="name"]').value = room.name || '';
            productionRoomForm.querySelector('[name="area"]').value = room.area || '';
            productionRoomForm.querySelector('[name="description"]').value = room.description || '';
            
            // Ustaw supervisorId i roomManagerUserId po załadowaniu selectów
            setTimeout(() => {
                if (room.supervisorId) {
                    productionRoomForm.querySelector('[name="supervisorId"]').value = room.supervisorId;
                }
                if (room.roomManagerUserId) {
                    productionRoomForm.querySelector('[name="roomManagerUserId"]').value = room.roomManagerUserId;
                }
            }, 100);
            
            // Pokaż sekcję operatorów w trybie edycji
            if (operatorsSection) {
                operatorsSection.classList.remove('hidden');
                renderRoomOperators(room.operators || []);
            }
        } else {
            productionRoomModalTitle.innerHTML = '<i class="fas fa-door-open"></i> Nowy pokój produkcyjny';
            productionRoomSubmitText.textContent = 'Utwórz pokój';
            productionRoomForm.querySelector('[name="id"]').value = '';
        }
        
        productionRoomModal.classList.remove('hidden');
        productionRoomForm.querySelector('[name="name"]').focus();
    };

    function closeProductionRoomModal() {
        productionRoomModal?.classList.add('hidden');
    }

    /**
     * Renderuje listę operatorów przypisanych do pokoju
     */
    function renderRoomOperators(operators) {
        const container = document.getElementById('room-operators-list');
        if (!container) return;
        
        if (!operators || operators.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm italic">Brak przypisanych operatorów</p>';
            return;
        }
        
        container.innerHTML = operators.map(op => `
            <div class="flex items-center gap-2 py-1 border-b border-gray-200 last:border-0">
                <i class="fas fa-user text-gray-400"></i>
                <span class="text-sm font-medium">${op.name || op.email}</span>
                <span class="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">${op.role}</span>
            </div>
        `).join('');
    }

    /**
     * Ładuje listę użytkowników do selecta menedżera pokoju (MES-compliant)
     */
    async function populateRoomManagerSelect() {
        const select = productionRoomForm?.querySelector('[name="roomManagerUserId"]');
        if (!select) return;
        
        const currentVal = select.value;
        select.innerHTML = '<option value="">Brak (tylko ADMIN może zarządzać)</option>';
        
        try {
            // Pobierz użytkowników z rolami produkcyjnymi (PRODUCTION_MANAGER, PRODUCTION)
            const response = await fetch('/api/admin/users', { credentials: 'include' });
            const result = await response.json();
            
            if (result.status === 'success') {
                const productionUsers = (result.data || []).filter(user => 
                    ['PRODUCTION_MANAGER', 'PRODUCTION', 'ADMIN'].includes(user.role)
                );
                productionUsers.forEach(user => {
                    const opt = document.createElement('option');
                    opt.value = user.id;
                    opt.textContent = `${user.name || user.email} (${user.role})`;
                    select.appendChild(opt);
                });
            }
            
            if (currentVal) select.value = currentVal;
        } catch (error) {
            console.error('Błąd ładowania menedżerów pokoju:', error);
        }
    }

    async function populateSupervisorSelect() {
        const select = productionRoomForm?.querySelector('[name="supervisorId"]');
        if (!select) return;
        
        const currentVal = select.value;
        select.innerHTML = '<option value="">Brak</option>';
        
        try {
            const response = await fetch('/api/admin/users?role=PRODUCTION', { credentials: 'include' });
            const result = await response.json();
            
            if (result.status === 'success') {
                (result.data || []).forEach(user => {
                    const opt = document.createElement('option');
                    opt.value = user.id;
                    opt.textContent = user.name || user.email;
                    select.appendChild(opt);
                });
            }
            
            if (currentVal) select.value = currentVal;
        } catch (error) {
            console.error('Błąd ładowania nadzorców:', error);
        }
    }

    async function handleProductionRoomSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(productionRoomForm);
        const id = formData.get('id');
        const name = formData.get('name')?.trim();
        const area = formData.get('area');
        const description = formData.get('description')?.trim();
        const supervisorId = formData.get('supervisorId');
        const roomManagerUserId = formData.get('roomManagerUserId');
        
        if (!name) {
            showProductionRoomError('Nazwa pokoju jest wymagana');
            return;
        }
        
        productionRoomFormError?.classList.add('hidden');
        
        const data = {
            name,
            area: area ? parseFloat(area) : null,
            description: description || null,
            supervisorId: supervisorId || null,
            roomManagerUserId: roomManagerUserId || null  // MES-compliant room manager
        };
        
        try {
            const url = id ? `/api/production/rooms/${id}` : '/api/production/rooms';
            const method = id ? 'PATCH' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                showAdminToast(id ? 'Pokój zaktualizowany' : 'Pokój utworzony', 'success');
                closeProductionRoomModal();
                loadProductionRooms();
            } else {
                showProductionRoomError(result.message || 'Błąd zapisu');
            }
        } catch (error) {
            console.error('Błąd zapisu pokoju:', error);
            showProductionRoomError('Błąd połączenia z serwerem');
        }
    }

    function showProductionRoomError(message) {
        if (productionRoomFormError) {
            productionRoomFormError.querySelector('span').textContent = message;
            productionRoomFormError.classList.remove('hidden');
        }
    }

    // ============================================
    // MODAL: GNIAZDO PRODUKCYJNE
    // ============================================

    window.openWorkCenterModal = async function(wc = null) {
        if (!workCenterModal || !workCenterForm) return;
        
        workCenterForm.reset();
        workCenterFormError?.classList.add('hidden');
        
        await populateWorkCenterTypeSelect();
        await populateRoomSelectForWorkCenter();
        
        if (wc) {
            workCenterModalTitle.innerHTML = '<i class="fas fa-cogs"></i> Edytuj gniazdo produkcyjne';
            workCenterSubmitText.textContent = 'Zapisz zmiany';
            workCenterForm.querySelector('[name="id"]').value = wc.id;
            workCenterForm.querySelector('[name="name"]').value = wc.name || '';
            workCenterForm.querySelector('[name="workCenterTypeId"]').value = wc.workCenterTypeId || '';
            workCenterForm.querySelector('[name="description"]').value = wc.description || '';
            if (wc.roomId) {
                workCenterForm.querySelector('[name="roomId"]').value = wc.roomId;
            }
        } else {
            workCenterModalTitle.innerHTML = '<i class="fas fa-cogs"></i> Nowe gniazdo produkcyjne';
            workCenterSubmitText.textContent = 'Utwórz gniazdo';
            workCenterForm.querySelector('[name="id"]').value = '';
        }
        
        workCenterModal.classList.remove('hidden');
        workCenterForm.querySelector('[name="name"]').focus();
    };

    function closeWorkCenterModal() {
        workCenterModal?.classList.add('hidden');
    }

    async function populateWorkCenterTypeSelect() {
        const select = workCenterForm?.querySelector('[name="workCenterTypeId"]');
        if (!select) return;
        
        const currentVal = select.value;
        select.innerHTML = '<option value="">Wybierz typ...</option>';
        
        // Załaduj typy jeśli jeszcze nie załadowane
        if (workCenterTypes.length === 0) {
            await loadWorkCenterTypes();
        }
        
        workCenterTypes.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type.id;
            opt.textContent = type.name;
            select.appendChild(opt);
        });
        
        if (currentVal) select.value = currentVal;
    }

    async function populateRoomSelectForWorkCenter() {
        const select = workCenterForm?.querySelector('[name="roomId"]');
        if (!select) return;
        
        const currentVal = select.value;
        select.innerHTML = '<option value="">Brak przypisania</option>';
        
        if (productionRooms.length === 0) {
            try {
                const response = await fetch('/api/production/rooms', { credentials: 'include' });
                const result = await response.json();
                if (result.status === 'success') {
                    productionRooms = result.data || [];
                }
            } catch (error) {
                console.error('Błąd ładowania pokoi:', error);
            }
        }
        
        productionRooms.forEach(room => {
            const opt = document.createElement('option');
            opt.value = room.id;
            opt.textContent = `${room.name} [${room.code}]`;
            select.appendChild(opt);
        });
        
        if (currentVal) select.value = currentVal;
    }

    async function handleWorkCenterSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(workCenterForm);
        const id = formData.get('id');
        const name = formData.get('name')?.trim();
        const workCenterTypeId = formData.get('workCenterTypeId');
        const roomId = formData.get('roomId');
        const description = formData.get('description')?.trim();
        
        if (!name || !workCenterTypeId) {
            showWorkCenterError('Nazwa i typ gniazda są wymagane');
            return;
        }
        
        workCenterFormError?.classList.add('hidden');
        
        const data = {
            name,
            workCenterTypeId,
            roomId: roomId || null,
            description: description || null
        };
        
        try {
            const url = id ? `/api/production/work-centers/${id}` : '/api/production/work-centers';
            const method = id ? 'PATCH' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                showAdminToast(id ? 'Gniazdo zaktualizowane' : 'Gniazdo utworzone', 'success');
                closeWorkCenterModal();
                loadWorkCenters();
            } else {
                showWorkCenterError(result.message || 'Błąd zapisu');
            }
        } catch (error) {
            console.error('Błąd zapisu gniazda:', error);
            showWorkCenterError('Błąd połączenia z serwerem');
        }
    }

    function showWorkCenterError(message) {
        if (workCenterFormError) {
            workCenterFormError.querySelector('span').textContent = message;
            workCenterFormError.classList.remove('hidden');
        }
    }

    // ============================================
    // MODAL: MASZYNA / STANOWISKO
    // ============================================

    window.openWorkStationModal = async function(ws = null) {
        if (!workStationModal || !workStationForm) return;
        
        workStationForm.reset();
        workStationFormError?.classList.add('hidden');

        const currentType = ws?.type || '';
        
        await Promise.all([
            populateWorkStationTypeSelect(currentType),
            populateWorkCenterSelectForWorkStation()
        ]);
        
        if (ws) {
            workStationModalTitle.innerHTML = '<i class="fas fa-tools"></i> Edytuj maszynę';
            workStationSubmitText.textContent = 'Zapisz zmiany';
            workStationForm.querySelector('[name="id"]').value = ws.id;
            workStationForm.querySelector('[name="name"]').value = ws.name || '';
            workStationForm.querySelector('[name="manufacturer"]').value = ws.manufacturer || '';
            workStationForm.querySelector('[name="model"]').value = ws.model || '';
            if (ws.workCenterId) {
                workStationForm.querySelector('[name="workCenterId"]').value = ws.workCenterId;
            }
        } else {
            workStationModalTitle.innerHTML = '<i class="fas fa-tools"></i> Nowa maszyna';
            workStationSubmitText.textContent = 'Utwórz maszynę';
            workStationForm.querySelector('[name="id"]').value = '';
        }
        
        workStationModal.classList.remove('hidden');
        workStationForm.querySelector('[name="name"]').focus();
    };

    function closeWorkStationModal() {
        workStationModal?.classList.add('hidden');
    }

    async function populateWorkStationTypeSelect(currentType = '') {
        const select = workStationForm?.querySelector('[name="type"]');
        if (!select) return;

        const previousVal = select.value;
        select.innerHTML = '<option value="">Wybierz typ...</option>';
        
        // Załaduj typy z API jeśli jeszcze nie są w pamięci
        if (workCenterTypes.length === 0) {
            await loadWorkCenterTypes();
        }

        if (workCenterTypes.length > 0) {
            workCenterTypes
                .filter(t => t.isActive !== false)
                .forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.code;
                    opt.textContent = t.name;
                    select.appendChild(opt);
                });
        } else {
            // Fallback: jeśli API zwróci pustą listę, użyj stałych etykiet
            Object.entries(WORK_CENTER_TYPE_LABELS).forEach(([code, label]) => {
                const opt = document.createElement('option');
                opt.value = code;
                opt.textContent = label;
                select.appendChild(opt);
            });
        }

        const targetValue = currentType || previousVal;
        if (targetValue) {
            // Jeśli typ z maszyny nie istnieje na liście (np. stary nieaktywny), dodaj go
            const hasValue = Array.from(select.options).some(opt => opt.value === targetValue);
            if (!hasValue) {
                const opt = document.createElement('option');
                opt.value = targetValue;
                opt.textContent = getWorkCenterTypeName(targetValue);
                select.appendChild(opt);
            }
            select.value = targetValue;
        }
    }

    async function populateWorkCenterSelectForWorkStation() {
        const select = workStationForm?.querySelector('[name="workCenterId"]');
        if (!select) return;
        
        const currentVal = select.value;
        select.innerHTML = '<option value="">Brak przypisania</option>';
        
        if (workCenters.length === 0) {
            try {
                const response = await fetch('/api/production/work-centers', { credentials: 'include' });
                const result = await response.json();
                if (result.status === 'success') {
                    workCenters = result.data || [];
                }
            } catch (error) {
                console.error('Błąd ładowania gniazd:', error);
            }
        }
        
        workCenters.forEach(wc => {
            const opt = document.createElement('option');
            opt.value = wc.id;
            opt.textContent = `${wc.name} [${wc.code}]`;
            select.appendChild(opt);
        });
        
        if (currentVal) select.value = currentVal;
    }

    async function handleWorkStationSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(workStationForm);
        const id = formData.get('id');
        const name = formData.get('name')?.trim();
        const type = formData.get('type');
        const workCenterId = formData.get('workCenterId');
        const manufacturer = formData.get('manufacturer')?.trim();
        const model = formData.get('model')?.trim();
        
        if (!name || !type) {
            showWorkStationError('Nazwa i typ maszyny są wymagane');
            return;
        }
        
        workStationFormError?.classList.add('hidden');
        
        const data = {
            name,
            type,
            workCenterId: workCenterId || null,
            manufacturer: manufacturer || null,
            model: model || null
        };
        
        try {
            const url = id ? `/api/production/work-stations/${id}` : '/api/production/work-stations';
            const method = id ? 'PATCH' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                showAdminToast(id ? 'Maszyna zaktualizowana' : 'Maszyna utworzona', 'success');
                closeWorkStationModal();
                loadWorkStations();
            } else {
                showWorkStationError(result.message || 'Błąd zapisu');
            }
        } catch (error) {
            console.error('Błąd zapisu maszyny:', error);
            showWorkStationError('Błąd połączenia z serwerem');
        }
    }

    function showWorkStationError(message) {
        if (workStationFormError) {
            workStationFormError.querySelector('span').textContent = message;
            workStationFormError.classList.remove('hidden');
        }
    }
})();
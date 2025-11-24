document.addEventListener('DOMContentLoaded', () => {
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
});

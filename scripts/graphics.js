// Graphics Panel - Main JavaScript
// Panel Grafika - obsługa zadań graficznych i rozkładania projektów na produkcję

// ==========================================
// State Management
// ==========================================
const state = {
    currentMode: 'orders', // 'orders' | 'production'
    currentView: 'kanban', // 'kanban' | 'list'
    currentFilter: 'all',
    tasks: [],
    productionOrders: [],
    selectedTask: null,
    selectedProductionOrder: null,
    user: null,
    isLoading: false
};

// Przypięte zlecenia (zapisane lokalnie)
let pinnedOrders = JSON.parse(localStorage.getItem('pinnedOrders') || '[]');

// Product Image Modal elements (will be initialized after DOM loads)
let productImageModal = null;
let productImageClose = null;
let productImageContent = null;
let productImageTitle = null;
let productImageDetails = null;
let productImageDownload = null;
let productImageZoom = null;

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadTasks();
    setupDragAndDrop();
    setupKeyboardShortcuts();
    setupProductImageModal();
});

// Setup product image modal event listeners
function setupProductImageModal() {
    // Initialize modal elements after DOM is ready
    productImageModal = document.getElementById('product-image-modal');
    productImageClose = document.getElementById('product-image-close');
    productImageContent = document.getElementById('product-image-content');
    productImageTitle = document.getElementById('product-image-title');
    productImageDetails = document.getElementById('product-image-details');
    productImageDownload = document.getElementById('product-image-download');
    productImageZoom = document.getElementById('product-image-zoom');
    
    // Debug: Check if elements were found
    console.log('[setupProductImageModal] Modal elements:', {
        modal: !!productImageModal,
        close: !!productImageClose,
        content: !!productImageContent,
        title: !!productImageTitle,
        details: !!productImageDetails,
        download: !!productImageDownload,
        zoom: !!productImageZoom
    });
    
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

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }
        const data = await response.json();
        
        if (data.status === 'success') {
            state.user = data;
        } else {
            // Fallback dla starszego formatu lub błędu
            state.user = data.user || data;
        }
        
        // Update UI with user info
        document.getElementById('userName').textContent = state.user.name || state.user.email || 'Grafik';
        document.getElementById('userAvatar').textContent = getInitials(state.user.name || state.user.email);
        
        // Check role
        // Debug log
        console.log('User role:', state.user.role);
        
        if (!state.user.role || !['GRAPHICS', 'ADMIN', 'PRODUCTION_MANAGER', 'PRODUCTION', 'SALES_DEPT'].includes(state.user.role)) {
            console.error('Role mismatch:', state.user.role);
            showNotification('Brak uprawnień do panelu grafika', 'error');
            setTimeout(() => window.location.href = '/index.html', 2000);
            return;
        }
        
        // Setup navigation based on role
        setupGraphicsNavigation(state.user.role);
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
    }
}

// Get initials from name
function getInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Setup navigation based on role
function setupGraphicsNavigation(role) {
    const ordersLink = document.getElementById('nav-orders-link');
    const productionLink = document.getElementById('nav-production-link');
    
    // Zamówienia - dla ADMIN, SALES_DEPT, PRODUCTION_MANAGER
    if (ordersLink && ['ADMIN', 'SALES_DEPT', 'PRODUCTION_MANAGER'].includes(role)) {
        ordersLink.style.display = 'flex';
    }
    
    // Produkcja - dla ADMIN, SALES_DEPT, PRODUCTION_MANAGER
    if (productionLink && ['ADMIN', 'SALES_DEPT', 'PRODUCTION_MANAGER'].includes(role)) {
        productionLink.style.display = 'flex';
    }
}

// ==========================================
// Data Loading
// ==========================================
async function loadTasks() {
    state.isLoading = true;
    showLoading();
    
    try {
        const params = new URLSearchParams();
        
        // Apply filters
        if (state.currentFilter === 'mine') {
            params.append('mine', 'true');
        } else if (state.currentFilter === 'unassigned') {
            params.append('assignedTo', 'null');
        } else if (['todo', 'in_progress', 'waiting_approval', 'ready_for_production', 'rejected'].includes(state.currentFilter)) {
            params.append('status', state.currentFilter);
        }
        
        const response = await fetch(`/api/graphics/tasks?${params}`, { credentials: 'include' });
        const data = await response.json();
        
        if (data.status === 'success') {
            state.tasks = data.data || [];
            
            // Apply additional client-side filters
            let filteredTasks = state.tasks;
            if (state.currentFilter === 'urgent') {
                filteredTasks = state.tasks.filter(t => t.priority <= 2);
            } else if (state.currentFilter === 'unassigned') {
                filteredTasks = state.tasks.filter(t => !t.assignedTo);
            }
            
            renderTasks(filteredTasks);
            updateStats();
            updateCounts();
        } else {
            showNotification('Błąd ładowania zadań', 'error');
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        showNotification('Błąd połączenia z serwerem', 'error');
    } finally {
        state.isLoading = false;
        hideLoading();
    }
}

async function loadProductionOrders() {
    try {
        const response = await fetch('/api/production/orders?status=pending,in_progress', { credentials: 'include' });
        const data = await response.json();
        
        if (data.status === 'success') {
            state.productionOrders = data.data || [];
            renderProductionList();
        }
    } catch (error) {
        console.error('Error loading production orders:', error);
    }
}

// ==========================================
// Rendering
// ==========================================
function renderTasks(tasks = state.tasks) {
    if (state.currentView === 'kanban') {
        renderKanban(tasks);
    } else {
        renderList(tasks);
    }
}

function renderKanban(tasks) {
    const columns = {
        todo: document.getElementById('columnTodo'),
        in_progress: document.getElementById('columnInProgress'),
        waiting_approval: document.getElementById('columnWaiting'),
        ready_for_production: document.getElementById('columnReady'),
        rejected: document.getElementById('columnRejected')
    };
    
    // Clear columns
    Object.values(columns).forEach(col => col.innerHTML = '');
    
    // Group tasks by status
    const grouped = {
        todo: [],
        in_progress: [],
        waiting_approval: [],
        ready_for_production: [],
        rejected: []
    };
    
    tasks.forEach(task => {
        if (grouped[task.status]) {
            grouped[task.status].push(task);
        }
    });
    
    // Render each column
    Object.entries(grouped).forEach(([status, statusTasks]) => {
        const column = columns[status];
        if (!column) return;
        
        if (statusTasks.length === 0) {
            column.innerHTML = `
                <div class="empty-state" style="padding: 2rem 1rem;">
                    <i class="fas fa-inbox" style="font-size: 2rem;"></i>
                    <p style="margin-top: 0.5rem; font-size: 0.8rem;">Brak zadań</p>
                </div>
            `;
        } else {
            statusTasks.forEach(task => {
                column.appendChild(createTaskCard(task));
            });
        }
        
        // Update count
        const countEl = document.getElementById(`count${capitalizeStatus(status)}`);
        if (countEl) countEl.textContent = statusTasks.length;
    });
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.taskId = task.id;
    card.draggable = true;
    
    const orderNumber = task.Order?.orderNumber || `#${task.orderId?.slice(-6)}`;
    const productName =
        task.OrderItem?.Product?.name ||
        task.OrderItem?.Product?.identifier ||
        task.OrderItem?.productName ||
        'Produkt';
    const assigneeName = task.Assignee?.name || null;
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const isOverdue = dueDate && dueDate < new Date();
    const isSoon = dueDate && !isOverdue && (dueDate - new Date()) < 2 * 24 * 60 * 60 * 1000;
    
    card.innerHTML = `
        <div class="task-header">
            <span class="task-order">${orderNumber}</span>
            <span class="task-priority priority-${task.priority}" title="Priorytet ${task.priority}">
                P${task.priority}
            </span>
        </div>
        <div class="task-product">${productName}</div>
        <div class="task-meta">
            ${task.OrderItem?.quantity ? `
                <span class="task-tag">
                    <i class="fas fa-cubes"></i> ${task.OrderItem.quantity} szt.
                </span>
            ` : ''}
            ${task.Order?.orderType === 'PROJECTS_ONLY' ? `
                <span class="task-tag" style="background: #fef3c7; color: #b45309;">
                    <i class="fas fa-palette"></i> Tylko projekt
                </span>
            ` : ''}
            ${task.approvalRequired ? `
                <span class="task-tag" style="background: #dbeafe; color: #1d4ed8;">
                    <i class="fas fa-user-check"></i> Wymaga akceptacji
                </span>
            ` : ''}
        </div>
        <div class="task-footer">
            <div class="task-assignee">
                ${assigneeName ? `
                    <div class="assignee-avatar">${getInitials(assigneeName)}</div>
                    <span class="assignee-name">${assigneeName}</span>
                ` : `
                    <div class="assignee-avatar unassigned"><i class="fas fa-user-plus"></i></div>
                    <span class="assignee-name">Nieprzypisane</span>
                `}
            </div>
            ${dueDate ? `
                <span class="task-due ${isOverdue ? 'overdue' : ''} ${isSoon ? 'soon' : ''}">
                    <i class="fas fa-calendar"></i>
                    ${formatDate(dueDate)}
                </span>
            ` : ''}
        </div>
    `;
    
    card.addEventListener('click', () => openTaskDetail(task));
    
    // Drag events
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    
    return card;
}

function renderList(tasks) {
    const tbody = document.getElementById('taskTableBody');
    tbody.innerHTML = '';
    
    if (tasks.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 3rem;">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>Brak zadań</h3>
                        <p>Nie znaleziono zadań spełniających kryteria</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tasks.forEach(task => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.onclick = () => openTaskDetail(task);
        
        const orderNumber = task.Order?.orderNumber || `#${task.orderId?.slice(-6)}`;
        const productName =
            task.OrderItem?.Product?.name ||
            task.OrderItem?.Product?.identifier ||
            task.OrderItem?.productName ||
            'Produkt';
        const assigneeName = task.Assignee?.name || 'Nieprzypisane';
        const dueDate = task.dueDate ? formatDate(new Date(task.dueDate)) : '-';
        
        row.innerHTML = `
            <td><strong>${orderNumber}</strong></td>
            <td>${productName}</td>
            <td><span class="status-badge ${task.status}">${getStatusLabel(task.status)}</span></td>
            <td><span class="task-priority priority-${task.priority}">P${task.priority}</span></td>
            <td>${assigneeName}</td>
            <td>${dueDate}</td>
            <td>
                <button class="btn btn-secondary btn-icon" onclick="event.stopPropagation(); openTaskDetail(${JSON.stringify(task).replace(/"/g, '&quot;')})">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function renderProductionList() {
    const container = document.getElementById('productionList');
    container.innerHTML = '';
    
    if (state.productionOrders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>Brak zleceń</h3>
                <p>Nie ma zleceń produkcyjnych do obsługi</p>
            </div>
        `;
        return;
    }
    
    state.productionOrders.forEach(order => {
        const item = document.createElement('div');
        item.className = 'production-item';
        item.dataset.orderId = order.id;
        
        item.innerHTML = `
            <div class="production-item-header">
                <span class="production-item-order">${order.orderNumber || '#' + order.id.slice(-6)}</span>
                <span class="production-item-status status-badge ${order.status}">${order.status}</span>
            </div>
            <div class="production-item-product">${order.productName || 'Produkt'}</div>
        `;
        
        item.addEventListener('click', () => selectProductionOrder(order));
        container.appendChild(item);
    });
}

// ==========================================
// Task Detail Panel
// ==========================================
function openTaskDetail(task) {
    state.selectedTask = task;
    
    const panel = document.getElementById('detailPanel');
    const overlay = document.getElementById('overlay');
    const body = document.getElementById('detailBody');
    
    document.getElementById('detailTitle').textContent = task.Order?.orderNumber || 'Zadanie';
    
    const checklist = task.checklist || {};
    const checklistItems = [
        { key: 'dataVerified', label: 'Dane zweryfikowane' },
        { key: 'quantitiesVerified', label: 'Ilości sprawdzone' },
        { key: 'layersOk', label: 'Warstwy poprawne' },
        { key: 'namingOk', label: 'Nazewnictwo OK' }
    ];
        body.innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">Informacje o zamówieniu</div>
            <div class="detail-field">
                <div class="detail-label">Numer zamówienia</div>
                <div class="detail-value">${task.Order?.orderNumber || '-'}</div>
            </div>
            <div class="detail-field">
                <div class="detail-label">Klient</div>
                <div class="detail-value">${task.Order?.Customer?.name || '-'}</div>
            </div>
            <div class="detail-field">
                <div class="detail-label">Produkt</div>
                <div class="detail-value">
                    ${
                        task.OrderItem?.Product?.name ||
                        task.OrderItem?.Product?.identifier ||
                        task.OrderItem?.productName ||
                        '-'
                    }
                </div>
            </div>
            <div class="detail-field">
                <div class="detail-label">Ilość</div>
                <div class="detail-value">${task.OrderItem?.quantity || '-'} szt.</div>
            </div>
            <div class="detail-field">
                <div class="detail-label">Uwagi handlowca</div>
                <div class="detail-value" id="salesNotesValue"></div>
            </div>
            <div class="detail-field">
                <div class="detail-label">Widok projektów</div>
                <div class="detail-value" id="projectViewUrlValue"></div>
            </div>
            <div class="detail-field">
                <div class="detail-label">Typ zamówienia</div>
                <div class="detail-value">${getOrderTypeLabel(task.Order?.orderType)}</div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title">Status zadania</div>
            <div class="detail-field">
                <div class="detail-label">Aktualny status</div>
                <select id="taskStatus" class="form-select" style="width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--gray-300);">
                    <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>Do zrobienia</option>
                    <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>W trakcie</option>
                    <option value="waiting_approval" ${task.status === 'waiting_approval' ? 'selected' : ''}>Czeka na akceptację</option>
                    <option value="ready_for_production" ${task.status === 'ready_for_production' ? 'selected' : ''}>Gotowe do produkcji</option>
                </select>
            </div>
            <div class="detail-field">
                <div class="detail-label">Priorytet</div>
                <select id="taskPriority" class="form-select" style="width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--gray-300);">
                    <option value="1" ${task.priority === 1 ? 'selected' : ''}>1 - Pilne</option>
                    <option value="2" ${task.priority === 2 ? 'selected' : ''}>2 - Wysokie</option>
                    <option value="3" ${task.priority === 3 ? 'selected' : ''}>3 - Normalne</option>
                    <option value="4" ${task.priority === 4 ? 'selected' : ''}>4 - Niskie</option>
                </select>
            </div>
            <div class="detail-field">
                <div class="detail-label">Przypisany do</div>
                <div style="display: flex; gap: 0.5rem;">
                    <span style="flex: 1; padding: 0.5rem; background: var(--gray-100); border-radius: 0.375rem;">
                        ${task.Assignee?.name || 'Nieprzypisane'}
                    </span>
                    ${!task.assignedTo ? `
                        <button class="btn btn-primary" onclick="assignToMe()">
                            <i class="fas fa-hand-paper"></i> Weź zadanie
                        </button>
                    ` : task.assignedTo === state.user?.id ? `
                        <button class="btn btn-secondary" onclick="unassignTask()">
                            <i class="fas fa-times"></i> Oddaj
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title">Checklista</div>
            <div class="checklist" id="taskChecklist">
                ${checklistItems.map(item => `
                    <div class="checklist-item ${checklist[item.key] ? 'checked' : ''}" data-key="${item.key}" onclick="toggleChecklistItem('${item.key}')">
                        <div class="checklist-checkbox">
                            <i class="fas fa-check"></i>
                        </div>
                        <span class="checklist-text">${item.label}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title">Pliki i projekty</div>
            <div class="detail-field">
                <div class="detail-label">Lokalizacja plików</div>
                <input type="text" id="filesLocation" value="${task.filesLocation || ''}" 
                    placeholder="np. //QNAP/Projekty/2025/ZAM-001"
                    style="width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--gray-300);">
            </div>
            <div class="detail-field">
                <div class="detail-label">Numery projektów (JSON)</div>
                <textarea id="projectNumbers" rows="3" 
                    placeholder='{"front": "PM-ZAK-001", "back": "PM-ZAK-001-B"}'
                    style="width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--gray-300); font-family: monospace; font-size: 0.8rem;">${JSON.stringify(task.projectNumbers || {}, null, 2)}</textarea>
            </div>
        </div>
        
        ${task.approvalRequired ? `
            <div class="detail-section">
                <div class="detail-section-title">Akceptacja projektu</div>
                <div class="detail-field">
                    <div class="detail-label">Status akceptacji</div>
                    <div class="detail-value">
                        <span class="status-badge ${task.approvalStatus}">${getApprovalStatusLabel(task.approvalStatus)}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="requireApproval" ${task.approvalRequired ? 'checked' : ''}>
                        Wymaga akceptacji handlowca
                    </label>
                </div>
            </div>
        ` : `
            <div class="detail-section">
                <div style="display: flex; gap: 0.5rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="requireApproval" ${task.approvalRequired ? 'checked' : ''}>
                        Wymaga akceptacji handlowca
                    </label>
                </div>
            </div>
        `}
    `;
    
    const salesNotesEl = document.getElementById('salesNotesValue');
    if (salesNotesEl) {
        salesNotesEl.textContent = task.OrderItem?.productionNotes || '-';
    }

    // Display project view URL if available
    const projectViewUrlEl = document.getElementById('projectViewUrlValue');
    if (projectViewUrlEl) {
        const url = task.OrderItem?.projectviewurl;
        if (url && url !== 'http://localhost:3001/') {
            const productName = task.OrderItem?.productName || '';
            const productIdentifier = task.OrderItem?.Product?.identifier || '';
            const locationName = task.OrderItem?.locationName || '';
            projectViewUrlEl.innerHTML = `<button onclick="showProductImage('${url}', '${productName}', '${productIdentifier}', '${locationName}')" class="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105" title="Pokaż podgląd produktu"><i class="fas fa-image text-sm"></i></button>`;
        } else {
            projectViewUrlEl.textContent = '-';
        }
    }

    // Setup save button
    document.getElementById('detailSaveBtn').onclick = saveTaskChanges;
    
    // Setup print button
    const printBtn = document.getElementById('detailPrintBtn');
    if (printBtn) {
        printBtn.onclick = () => printGraphicsTask(task.id);
    }
    
    panel.classList.add('open');
    overlay.classList.add('active');
}

function closeDetailPanel() {
    document.getElementById('detailPanel').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
    state.selectedTask = null;
}

async function saveTaskChanges() {
    if (!state.selectedTask) return;
    
    const updates = {
        status: document.getElementById('taskStatus').value,
        priority: parseInt(document.getElementById('taskPriority').value),
        filesLocation: document.getElementById('filesLocation').value,
        approvalRequired: document.getElementById('requireApproval')?.checked || false
    };
    
    // Parse project numbers
    try {
        const projectNumbersText = document.getElementById('projectNumbers').value;
        if (projectNumbersText.trim()) {
            updates.projectNumbers = JSON.parse(projectNumbersText);
        }
    } catch (e) {
        showNotification('Błędny format numerów projektów (JSON)', 'error');
        return;
    }
    
    // Get checklist state
    const checklistItems = document.querySelectorAll('#taskChecklist .checklist-item');
    const checklist = {};
    checklistItems.forEach(item => {
        checklist[item.dataset.key] = item.classList.contains('checked');
    });
    updates.checklist = checklist;
    
    try {
        const response = await fetch(`/api/graphics/tasks/${state.selectedTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updates)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showNotification('Zadanie zaktualizowane', 'success');
            closeDetailPanel();
            await loadTasks();
        } else {
            showNotification(data.message || 'Błąd zapisu', 'error');
        }
    } catch (error) {
        console.error('Error saving task:', error);
        showNotification('Błąd połączenia', 'error');
    }
}

async function assignToMe() {
    if (!state.selectedTask || !state.user) return;
    
    try {
        const response = await fetch(`/api/graphics/tasks/${state.selectedTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                assignedTo: state.user.id,
                status: state.selectedTask.status === 'todo' ? 'in_progress' : state.selectedTask.status
            })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showNotification('Zadanie przypisane do Ciebie', 'success');
            closeDetailPanel();
            await loadTasks();
        } else {
            showNotification(data.message || 'Błąd przypisania', 'error');
        }
    } catch (error) {
        console.error('Error assigning task:', error);
        showNotification('Błąd połączenia', 'error');
    }
}

async function unassignTask() {
    if (!state.selectedTask) return;
    
    try {
        const response = await fetch(`/api/graphics/tasks/${state.selectedTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                assignedTo: null,
                status: 'todo'
            })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showNotification('Zadanie oddane do puli', 'success');
            closeDetailPanel();
            await loadTasks();
        } else {
            showNotification(data.message || 'Błąd', 'error');
        }
    } catch (error) {
        console.error('Error unassigning task:', error);
        showNotification('Błąd połączenia', 'error');
    }
}

function toggleChecklistItem(key) {
    const item = document.querySelector(`#taskChecklist .checklist-item[data-key="${key}"]`);
    if (item) {
        item.classList.toggle('checked');
    }
}

// ==========================================
// Mode & View Switching
// ==========================================
function switchMode(mode) {
    state.currentMode = mode;
    
    // Update buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Update navigation
    document.getElementById('ordersNav').style.display = mode === 'orders' ? 'block' : 'none';
    document.getElementById('ordersNav2').style.display = mode === 'orders' ? 'block' : 'none';
    document.getElementById('productionNav').style.display = mode === 'production' ? 'block' : 'none';
    
    // Update content
    document.getElementById('kanbanBoard').classList.toggle('hidden', mode !== 'orders' || state.currentView !== 'kanban');
    document.getElementById('listView').classList.toggle('active', mode === 'orders' && state.currentView === 'list');
    document.getElementById('productionView').classList.toggle('active', mode === 'production');
    
    // Update header
    document.getElementById('pageTitle').textContent = mode === 'orders' ? 'Zadania graficzne' : 'Rozkładanie na produkcję';
    document.getElementById('headerStats').style.display = mode === 'orders' ? 'flex' : 'none';
    
    // Load data
    if (mode === 'production') {
        loadProductionOrders();
    }
}

function switchView(view) {
    state.currentView = view;
    
    // Update tabs
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === view);
    });
    
    // Update content
    if (state.currentMode === 'orders') {
        document.getElementById('kanbanBoard').classList.toggle('hidden', view !== 'kanban');
        document.getElementById('listView').classList.toggle('active', view === 'list');
    }
    
    renderTasks();
}

function filterTasks(filter) {
    state.currentFilter = filter;
    
    // Update nav items
    document.querySelectorAll('.nav-item[data-filter]').forEach(item => {
        item.classList.toggle('active', item.dataset.filter === filter);
    });
    
    loadTasks();
}

// ==========================================
// Drag & Drop
// ==========================================
function setupDragAndDrop() {
    const columns = document.querySelectorAll('.column-cards');
    
    columns.forEach(column => {
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('drop', handleDrop);
        column.addEventListener('dragleave', handleDragLeave);
    });
}

let draggedTask = null;

function handleDragStart(e) {
    draggedTask = state.tasks.find(t => t.id == e.target.dataset.taskId);
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.column-cards').forEach(col => {
        col.style.background = '';
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
}

function handleDragLeave(e) {
    e.currentTarget.style.background = '';
}

async function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.style.background = '';
    
    if (!draggedTask) return;
    
    const column = e.currentTarget.closest('.kanban-column');
    const newStatus = column.dataset.status;
    
    if (newStatus === draggedTask.status) return;
    
    // Check if user can change to this status
    if (newStatus === 'ready_for_production' && draggedTask.approvalRequired && draggedTask.approvalStatus !== 'approved') {
        showNotification('To zadanie wymaga akceptacji handlowca', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/graphics/tasks/${draggedTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showNotification(`Status zmieniony na: ${getStatusLabel(newStatus)}`, 'success');
            await loadTasks();
        } else {
            showNotification(data.message || 'Błąd zmiany statusu', 'error');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Błąd połączenia', 'error');
    }
    
    draggedTask = null;
}

// ==========================================
// Production Mode
// ==========================================
function selectProductionOrder(order) {
    state.selectedProductionOrder = order;
    
    // Update selection
    document.querySelectorAll('.production-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.orderId === order.id);
    });
    
    // Update workspace
    document.getElementById('workspaceTitle').textContent = order.orderNumber || 'Zlecenie #' + order.id.slice(-6);
    document.getElementById('saveProductionBtn').disabled = false;
    
    renderProductionWorkspace(order);
}

function renderProductionWorkspace(order) {
    const workspace = document.getElementById('workspaceBody');
    
    // Mock operations for now - in real app, fetch from API
    const operations = order.operations || [
        { id: 1, name: 'Cięcie laserowe', type: 'LASER', sequence: 1 },
        { id: 2, name: 'Druk UV', type: 'UV_PRINT', sequence: 2 },
        { id: 3, name: 'Pakowanie', type: 'PACKING', sequence: 3 }
    ];
    
    workspace.innerHTML = `
        <div class="path-selector">
            <label>Ścieżka produkcyjna</label>
            <select id="productionPath">
                <option value="">Wybierz ścieżkę...</option>
                <option value="laser-uv">Laser + UV</option>
                <option value="sublimation">Sublimacja</option>
                <option value="custom">Własna ścieżka</option>
            </select>
        </div>
        
        <div class="detail-section-title">Operacje</div>
        <div class="operations-list">
            ${operations.map(op => `
                <div class="operation-card" data-operation-id="${op.id}">
                    <div class="operation-number">${op.sequence}</div>
                    <div class="operation-info">
                        <div class="operation-name">${op.name}</div>
                        <div class="operation-details">${op.type}</div>
                    </div>
                    <div class="operation-files">
                        <button class="file-btn" onclick="attachFile(${op.id}, 'main')">
                            <i class="fas fa-file-image"></i> Plik główny
                        </button>
                        <button class="file-btn" onclick="attachFile(${op.id}, 'template')">
                            <i class="fas fa-file-alt"></i> Szablon
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div style="margin-top: 1.5rem;">
            <div class="detail-section-title">Notatki produkcyjne</div>
            <textarea id="productionNotes" rows="4" placeholder="Dodatkowe instrukcje dla produkcji..."
                style="width: 100%; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--gray-300);"></textarea>
        </div>
    `;
}

function attachFile(operationId, fileType) {
    // In real app, open file picker or gallery browser
    showNotification(`Wybierz plik dla operacji ${operationId} (${fileType})`, 'info');
    
    // Mock attachment
    const btn = event.target.closest('.file-btn');
    btn.classList.add('attached');
    btn.innerHTML = `<i class="fas fa-check"></i> Załączono`;
}

// ==========================================
// Stats & Counts
// ==========================================
function updateStats() {
    const stats = {
        todo: state.tasks.filter(t => t.status === 'todo').length,
        in_progress: state.tasks.filter(t => t.status === 'in_progress').length,
        waiting_approval: state.tasks.filter(t => t.status === 'waiting_approval').length,
        ready_for_production: state.tasks.filter(t => t.status === 'ready_for_production').length
    };
    
    document.getElementById('statTodo').textContent = stats.todo;
    document.getElementById('statProgress').textContent = stats.in_progress;
    document.getElementById('statWaiting').textContent = stats.waiting_approval;
    document.getElementById('statReady').textContent = stats.ready_for_production;
}

function updateCounts() {
    const counts = {
        all: state.tasks.length,
        mine: state.tasks.filter(t => t.assignedTo === state.user?.id).length,
        unassigned: state.tasks.filter(t => !t.assignedTo).length,
        urgent: state.tasks.filter(t => t.priority <= 2).length
    };
    
    document.getElementById('countAll').textContent = counts.all;
    document.getElementById('countMine').textContent = counts.mine;
    document.getElementById('countUnassigned').textContent = counts.unassigned;
    document.getElementById('countUrgent').textContent = counts.urgent;
}

// ==========================================
// Utilities
// ==========================================
function capitalizeStatus(status) {
    const map = {
        'todo': 'Todo',
        'in_progress': 'InProgress',
        'waiting_approval': 'Waiting',
        'ready_for_production': 'Ready',
        'rejected': 'Rejected'
    };
    return map[status] || status;
}

function getStatusLabel(status) {
    const labels = {
        'todo': 'Do zrobienia',
        'in_progress': 'W trakcie',
        'waiting_approval': 'Czeka na akceptację',
        'ready_for_production': 'Gotowe do produkcji',
        'rejected': 'Odrzucone',
        'archived': 'Zarchiwizowane'
    };
    return labels[status] || status;
}

function getApprovalStatusLabel(status) {
    const labels = {
        'not_required': 'Nie wymagana',
        'pending': 'Oczekuje',
        'approved': 'Zaakceptowane',
        'rejected': 'Odrzucone'
    };
    return labels[status] || status;
}

function getOrderTypeLabel(type) {
    const labels = {
        'PRODUCTS_ONLY': 'Tylko produkty',
        'PRODUCTS_AND_PROJECTS': 'Produkty + projekty',
        'PROJECTS_ONLY': 'Tylko projekty'
    };
    return labels[type] || type || '-';
}

function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}`;
}

function showLoading() {
    // Could add a loading overlay
}

function hideLoading() {
    // Remove loading overlay
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const text = document.getElementById('notificationText');
    
    notification.className = `notification ${type}`;
    text.textContent = message;
    
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function refreshTasks() {
    loadTasks();
    showNotification('Lista odświeżona', 'success');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ==========================================
// Keyboard Shortcuts
// ==========================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Escape - close panel
        if (e.key === 'Escape') {
            closeDetailPanel();
        }
        
        // R - refresh
        if (e.key === 'r' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            refreshTasks();
        }
        
        // 1-4 - switch filters
        if (['1', '2', '3', '4'].includes(e.key) && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            const filters = ['all', 'mine', 'unassigned', 'urgent'];
            filterTasks(filters[parseInt(e.key) - 1]);
        }
    });
}

// Drukuj zlecenie na projekty (PDF z backendu)
function printGraphicsTask(taskId) {
    if (!taskId) {
        showNotification('Brak ID zadania', 'error');
        return;
    }
    
    showNotification('Generowanie zlecenia na projekty...', 'info');
    
    // Otwórz PDF w nowym oknie
    const printUrl = `/api/graphics/tasks/${taskId}/print`;
    window.open(printUrl, '_blank');
}

// Make functions globally available
window.switchMode = switchMode;
window.switchView = switchView;
window.filterTasks = filterTasks;
window.openTaskDetail = openTaskDetail;
window.closeDetailPanel = closeDetailPanel;
window.printGraphicsTask = printGraphicsTask;

// ==========================================
// Product Image Modal Functions
// ==========================================

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
    
    // Debug: Check if modal elements exist
    console.log('[showProductImage] Modal elements available:', {
        modal: !!productImageModal,
        title: !!productImageTitle,
        details: !!productImageDetails,
        content: !!productImageContent
    });
    
    if (!normalizedUrl) {
        console.log('[showProductImage] No URL provided');
        showNotification('Brak podglądu produktu', 'info');
        return;
    }
    
    if (!productImageModal) {
        console.error('[showProductImage] Modal element not found!');
        showNotification('Błąd: element modalu nie został znaleziony', 'error');
        return;
    }
    
    // Set product info in header
    const title = productName || 'Podgląd produktu';
    const details = [];
    if (productIdentifier) details.push(`ID: ${productIdentifier}`);
    if (locationName) details.push(`Lokalizacja: ${locationName}`);
    
    productImageTitle.textContent = title;
    productImageDetails.textContent = details.join(' | ') || '';
    
    console.log('[showProductImage] Setting image src to:', normalizedUrl);
    
    // Clear previous handlers and set new ones with addEventListener
    const newImage = new Image();
    
    newImage.addEventListener('load', function() {
        console.log('[showProductImage] Image loaded successfully');
        productImageContent.src = normalizedUrl;
        console.log('[showProductImage] Setting modal display to flex');
        productImageModal.style.display = 'flex';
        console.log('[showProductImage] Modal display set to:', productImageModal.style.display);
    }, { once: true });
    
    newImage.addEventListener('error', function() {
        console.error('[showProductImage] Failed to load image:', normalizedUrl);
        showNotification('Błąd ładowania obrazka produktu', 'error');
    }, { once: true });
    
    // Start loading the image
    newImage.src = normalizedUrl;
    
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
    productImageModal.style.display = 'none';
    productImageContent.src = '';
}

// Export modal functions
window.showProductImage = showProductImage;
window.assignToMe = assignToMe;
window.unassignTask = unassignTask;
window.toggleChecklistItem = toggleChecklistItem;
window.refreshTasks = refreshTasks;
window.toggleSidebar = toggleSidebar;
window.attachFile = attachFile;

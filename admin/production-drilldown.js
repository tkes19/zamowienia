// Drill-down nawigacja dla panelu produkcji
// Ten plik dodaje funkcjonalność klikania w kafelki pokoi/gniazd

(function() {
    'use strict';

    // Drill-down z pokoju do gniazd
    window.drillDownToWorkCenters = function(roomId) {
        var navLink = document.querySelector('[data-view="production-work-centers"]');
        if (navLink) navLink.click();
        setTimeout(function() {
            var filter = document.getElementById('work-centers-room-filter');
            if (filter) { 
                filter.value = roomId; 
                if (typeof filterWorkCenters === 'function') filterWorkCenters(); 
            }
        }, 300);
    };

    // Drill-down z gniazda do maszyn
    window.drillDownToWorkStations = function(workCenterId) {
        var navLink = document.querySelector('[data-view="production-work-stations"]');
        if (navLink) navLink.click();
        setTimeout(function() {
            var filter = document.getElementById('work-stations-center-filter');
            if (filter) { 
                filter.value = workCenterId; 
                if (typeof filterWorkStations === 'function') filterWorkStations(); 
            }
        }, 300);
    };

    // Dodaj maszynę do gniazda
    window.addWorkStationToCenter = function(workCenterId) {
        window.drillDownToWorkStations(workCenterId);
    };
    
    // C1: Szybka zmiana statusu maszyny bez modala
    window.quickChangeStatus = async function(workStationId, newStatus) {
        var statusLabels = {
            available: 'Dostępna',
            in_use: 'W użyciu',
            maintenance: 'Konserwacja',
            breakdown: 'Awaria'
        };
        
        try {
            var response = await fetch('/api/production/work-stations/' + workStationId + '/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
            });
            
            if (!response.ok) {
                throw new Error('Status HTTP ' + response.status);
            }

            var result = await response.json();
            
            if (result.status === 'success') {
                if (typeof showAdminToast === 'function') {
                    showAdminToast('Status zmieniony na: ' + statusLabels[newStatus], 'success');
                }
                // Odśwież listę maszyn
                if (typeof loadWorkStations === 'function') {
                    loadWorkStations();
                }
            } else {
                if (typeof showAdminToast === 'function') {
                    showAdminToast(result.message || 'Błąd zmiany statusu', 'error');
                }
            }
        } catch (error) {
            console.error('Błąd zmiany statusu:', error);
            if (typeof showAdminToast === 'function') {
                showAdminToast('Błąd połączenia z serwerem', 'error');
            }
        }
    };

    // Nadpisanie renderProductionRooms po załadowaniu strony
    document.addEventListener('DOMContentLoaded', function() {
        // Poczekaj aż admin.js się załaduje
        setTimeout(function() {
            if (typeof window.originalRenderProductionRooms === 'undefined' && typeof renderProductionRooms === 'function') {
                window.originalRenderProductionRooms = renderProductionRooms;
                
                window.renderProductionRooms = function() {
                    var grid = document.getElementById('production-rooms-grid');
                    if (!grid) return;
                    
                    if (typeof productionRooms === 'undefined' || productionRooms.length === 0) {
                        grid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center h-64 text-gray-400"><i class="fas fa-door-open text-6xl mb-4"></i><p class="text-lg">Brak pokoi produkcyjnych</p><p class="text-sm">Kliknij "Dodaj pokój" aby utworzyć pierwszy</p></div>';
                        return;
                    }
                    
                    grid.innerHTML = productionRooms.map(function(room) {
                        var operators = room.operators || [];
                        var operatorCount = typeof room.operatorCount === 'number'
                            ? room.operatorCount
                            : operators.length;
                        var hasManager = room.roomManager && room.roomManager.id;
                        var managerBadge = hasManager 
                            ? '<span class="bg-green-500/30 text-white text-xs px-2 py-0.5 rounded-full"><i class="fas fa-user-check mr-1"></i>Menedżer</span>'
                            : '<span class="bg-red-500/30 text-white text-xs px-2 py-0.5 rounded-full"><i class="fas fa-user-times mr-1"></i>Brak</span>';
                        var operatorsHtml = '';
                        if (operators.length > 0) {
                            var operatorTags = operators.slice(0, 4).map(function(op) {
                                return '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">' + escapeHtml(op.user?.name || op.user?.email || 'Nieznany') + '</span>';
                            }).join('');
                            var moreOperators = operators.length > 4 ? '<span class="text-xs text-gray-400">+' + (operators.length - 4) + '</span>' : '';
                            operatorsHtml = '<div class="border-t pt-3 mt-3"><p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Przypisane osoby:</p><div class="flex flex-wrap gap-1">' + operatorTags + moreOperators + '</div></div>';
                        } else {
                            operatorsHtml = '<div class="border-t pt-3 mt-3"><p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Przypisane osoby:</p><p class="text-xs text-gray-400 italic">Brak przypisanych użytkowników</p></div>';
                        }
                        
                        var workCentersHtml = '';
                        if (room.workCenters && room.workCenters.length > 0) {
                            var wcItems = room.workCenters.slice(0, 5).map(function(wc) {
                                return '<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-200" onclick="event.stopPropagation(); drillDownToWorkStations(' + wc.id + ')">' + escapeHtml(wc.name) + '</span>';
                            }).join('');
                            var moreWc = room.workCenters.length > 5 ? '<span class="text-xs text-gray-400">+' + (room.workCenters.length - 5) + '</span>' : '';
                            workCentersHtml = '<div class="border-t pt-3 mt-3"><p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Gniazda:</p><div class="flex flex-wrap gap-1">' + wcItems + moreWc + '</div></div>';
                        }
                        
                        return '<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onclick="drillDownToWorkCenters(' + room.id + ')">' +
                            '<div class="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 relative">' +
                                '<div class="absolute top-2 right-2 flex gap-1">' +
                                    '<button onclick="event.stopPropagation(); editProductionRoom(' + room.id + ')" class="p-1.5 bg-white/20 hover:bg-white/40 rounded text-white" title="Edytuj"><i class="fas fa-edit text-xs"></i></button>' +
                                    '<button onclick="event.stopPropagation(); deleteProductionRoom(' + room.id + ')" class="p-1.5 bg-white/20 hover:bg-red-500/60 rounded text-white" title="Usuń"><i class="fas fa-trash text-xs"></i></button>' +
                                '</div>' +
                                '<div class="pr-16">' +
                                    '<h3 class="text-lg font-bold text-white">' + escapeHtml(room.name) + '</h3>' +
                                    '<p class="text-amber-100 text-sm font-mono">' + escapeHtml(room.code) + '</p>' +
                                '</div>' +
                                '<div class="flex flex-wrap gap-1 mt-2">' +
                                    '<span class="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full"><i class="fas fa-cogs mr-1"></i>' + (room.workCenters ? room.workCenters.length : 0) + ' gniazd</span>' +
                                    '<span class="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full"><i class="fas fa-users mr-1"></i>' + operatorCount + ' osób</span>' +
                                    managerBadge +
                                '</div>' +
                            '</div>' +
                            '<div class="p-4">' +
                                (room.area ? '<p class="text-sm text-gray-600 mb-2"><i class="fas fa-ruler-combined mr-2"></i>' + room.area + ' m²</p>' : '') +
                                (room.supervisor ? '<p class="text-sm text-gray-600 mb-2"><i class="fas fa-user-tie mr-2"></i>' + escapeHtml(room.supervisor.name) + '</p>' : '') +
                                (room.description ? '<p class="text-sm text-gray-500 mb-3">' + escapeHtml(room.description) + '</p>' : '') +
                                workCentersHtml +
                                operatorsHtml +
                            '</div>' +
                        '</div>';
                    }).join('');
                };
            }
            
            // Nadpisanie renderWorkCenters
            if (typeof window.originalRenderWorkCenters === 'undefined' && typeof renderWorkCenters === 'function') {
                window.originalRenderWorkCenters = renderWorkCenters;
                
                window.renderWorkCenters = function(centers) {
                    var grid = document.getElementById('work-centers-grid');
                    if (!grid) return;
                    
                    if (!centers || centers.length === 0) {
                        grid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center h-64 text-gray-400"><i class="fas fa-cogs text-6xl mb-4"></i><p class="text-lg">Brak gniazd produkcyjnych</p></div>';
                        return;
                    }
                    
                    grid.innerHTML = centers.map(function(wc) {
                        var stationCount = (wc.workStations && wc.workStations.length) || 0;
                        var typeName = (typeof getWorkCenterTypeName === 'function' ? getWorkCenterTypeName(wc.type?.name || wc.type) : wc.type?.name || wc.type) || wc.type?.name || wc.type;
                        var stats = wc.workStationsByStatus || {};
                        var available = stats.available || 0;
                        var inUse = stats.in_use || 0;
                        var maintenance = stats.maintenance || 0;
                        var breakdown = stats.breakdown || 0;
                        
                        var statusBadges = '';
                        if (stationCount > 0) {
                            statusBadges = '<div class="flex flex-wrap gap-1 mt-2">' +
                                (available > 0 ? '<span class="bg-green-500/30 text-white text-xs px-2 py-0.5 rounded-full"><i class="fas fa-check-circle mr-1"></i>' + available + '</span>' : '') +
                                (inUse > 0 ? '<span class="bg-amber-500/30 text-white text-xs px-2 py-0.5 rounded-full"><i class="fas fa-play-circle mr-1"></i>' + inUse + '</span>' : '') +
                                (maintenance > 0 ? '<span class="bg-blue-300/30 text-white text-xs px-2 py-0.5 rounded-full"><i class="fas fa-wrench mr-1"></i>' + maintenance + '</span>' : '') +
                                (breakdown > 0 ? '<span class="bg-red-500/30 text-white text-xs px-2 py-0.5 rounded-full"><i class="fas fa-exclamation-triangle mr-1"></i>' + breakdown + '</span>' : '') +
                            '</div>';
                        }
                        
                        return '<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onclick="drillDownToWorkStations(' + wc.id + ')">' +
                            '<div class="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 relative">' +
                                '<div class="absolute top-2 right-2 flex gap-1">' +
                                    '<button onclick="event.stopPropagation(); editWorkCenter(' + wc.id + ')" class="p-1.5 bg-white/20 hover:bg-white/40 rounded text-white" title="Edytuj"><i class="fas fa-edit text-xs"></i></button>' +
                                    '<button onclick="event.stopPropagation(); editWorkCenterPaths(' + wc.id + ')" class="p-1.5 bg-white/20 hover:bg-white/40 rounded text-white" title="Ścieżki"><i class="fas fa-route text-xs"></i></button>' +
                                '</div>' +
                                '<div class="pr-16">' +
                                    '<h3 class="text-lg font-bold text-white">' + escapeHtml(wc.name) + '</h3>' +
                                    '<p class="text-blue-100 text-sm font-mono">' + escapeHtml(wc.code) + '</p>' +
                                '</div>' +
                                '<div class="flex flex-wrap gap-1 mt-2">' +
                                    '<span class="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full"><i class="fas fa-tools mr-1"></i>' + stationCount + ' maszyn</span>' +
                                '</div>' +
                                statusBadges +
                            '</div>' +
                            '<div class="p-4">' +
                                '<p class="text-sm text-gray-600 mb-2"><i class="fas fa-tag mr-2"></i>' + typeName + '</p>' +
                                (wc.room ? '<p class="text-sm text-gray-600 mb-2"><i class="fas fa-door-open mr-2"></i>' + escapeHtml(wc.room.name) + '</p>' : '') +
                                (wc.description ? '<p class="text-sm text-gray-500 mb-3">' + escapeHtml(wc.description) + '</p>' : '') +
                                '<div class="flex gap-2 mt-4">' +
                                    '<button onclick="event.stopPropagation(); addWorkStationToCenter(' + wc.id + ')" class="flex-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"><i class="fas fa-plus mr-1"></i> Dodaj maszynę</button>' +
                                '</div>' +
                            '</div>' +
                        '</div>';
                    }).join('');
                };
            }
            
            // B3: Nadpisanie renderWorkStations z ulepszonym pill statusu i ostatnią aktywnością
            if (typeof window.originalRenderWorkStations === 'undefined' && typeof renderWorkStations === 'function') {
                window.originalRenderWorkStations = renderWorkStations;
                
                window.renderWorkStations = function(stations) {
                    var grid = document.getElementById('work-stations-grid');
                    if (!grid) return;
                    
                    if (!stations || stations.length === 0) {
                        grid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center h-64 text-gray-400"><i class="fas fa-tools text-6xl mb-4"></i><p class="text-lg">Brak maszyn</p></div>';
                        return;
                    }
                    
                    var STATUS_CONFIG = {
                        available: { label: 'Dostępna', bg: 'bg-green-500', icon: 'fa-check-circle' },
                        in_use: { label: 'W użyciu', bg: 'bg-amber-500', icon: 'fa-play-circle' },
                        maintenance: { label: 'Konserwacja', bg: 'bg-blue-500', icon: 'fa-wrench' },
                        breakdown: { label: 'Awaria', bg: 'bg-red-500', icon: 'fa-exclamation-triangle' }
                    };
                    
                    function formatTimeAgo(dateStr) {
                        if (!dateStr) return '';
                        var date = new Date(dateStr);
                        var now = new Date();
                        var diffMs = now - date;
                        var diffMins = Math.floor(diffMs / 60000);
                        var diffHours = Math.floor(diffMs / 3600000);
                        var diffDays = Math.floor(diffMs / 86400000);
                        
                        if (diffMins < 1) return 'przed chwilą';
                        if (diffMins < 60) return diffMins + ' min temu';
                        if (diffHours < 24) return diffHours + ' godz. temu';
                        if (diffDays < 7) return diffDays + ' dni temu';
                        return date.toLocaleDateString('pl-PL');
                    }
                    
                    grid.innerHTML = stations.map(function(ws) {
                        var statusCfg = STATUS_CONFIG[ws.status] || { label: ws.status, bg: 'bg-gray-500', icon: 'fa-question' };
                        var typeName = (typeof getWorkCenterTypeName === 'function' ? getWorkCenterTypeName(ws.type) : ws.type) || ws.type;
                        var lastActivity = formatTimeAgo(ws.updatedAt);
                        
                        return '<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">' +
                            '<div class="px-4 py-3 border-b border-gray-100">' +
                                '<div class="flex justify-between items-start">' +
                                    '<div>' +
                                        '<h3 class="font-bold text-gray-800">' + escapeHtml(ws.name) + '</h3>' +
                                        '<p class="text-gray-500 text-xs font-mono">' + escapeHtml(ws.code) + '</p>' +
                                    '</div>' +
                                    '<span class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full text-white ' + statusCfg.bg + '">' +
                                        '<i class="fas ' + statusCfg.icon + '"></i>' +
                                        statusCfg.label +
                                    '</span>' +
                                '</div>' +
                                (lastActivity ? '<p class="text-xs text-gray-400 mt-1"><i class="fas fa-clock mr-1"></i>Ostatnia zmiana: ' + lastActivity + '</p>' : '') +
                            '</div>' +
                            '<div class="p-4">' +
                                '<p class="text-sm text-gray-600 mb-1"><i class="fas fa-tag mr-2 text-gray-400"></i>' + typeName + '</p>' +
                                (ws.manufacturer ? '<p class="text-sm text-gray-600 mb-1"><i class="fas fa-industry mr-2 text-gray-400"></i>' + escapeHtml(ws.manufacturer) + ' ' + (ws.model || '') + '</p>' : '') +
                                (ws.workCenter ? '<p class="text-sm text-gray-600 mb-1"><i class="fas fa-sitemap mr-2 text-gray-400"></i>' + (ws.workCenter.room ? '<span class="text-amber-600 cursor-pointer hover:underline" onclick="drillDownToWorkCenters(' + ws.workCenter.room.id + ')">' + escapeHtml(ws.workCenter.room.name) + '</span> → ' : '') + '<span class="text-blue-600 cursor-pointer hover:underline" onclick="drillDownToWorkStations(' + ws.workCenter.id + ')">' + escapeHtml(ws.workCenter.name) + '</span></p>' : '') +
                                (ws.workCenter?.room && !ws.workCenter.room.name ? '<p class="text-sm text-red-600 mb-1"><i class="fas fa-exclamation-triangle mr-2"></i>Błąd: Pokój nie ma nazwy (ID: ' + ws.workCenter.room.id + ')</p>' : '') +
                                (ws.currentOperator ? '<p class="text-sm text-amber-600"><i class="fas fa-user mr-2"></i>' + escapeHtml(ws.currentOperator.name) + '</p>' : '') +
                                '<div class="flex flex-wrap gap-1 mt-3">' +
                                    (ws.status !== 'available' ? '<button onclick="quickChangeStatus(' + ws.id + ', \'available\')" class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200" title="Dostępna"><i class="fas fa-check-circle"></i></button>' : '') +
                                    (ws.status !== 'in_use' ? '<button onclick="quickChangeStatus(' + ws.id + ', \'in_use\')" class="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200" title="W użyciu"><i class="fas fa-play-circle"></i></button>' : '') +
                                    (ws.status !== 'maintenance' ? '<button onclick="quickChangeStatus(' + ws.id + ', \'maintenance\')" class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Konserwacja"><i class="fas fa-wrench"></i></button>' : '') +
                                    (ws.status !== 'breakdown' ? '<button onclick="quickChangeStatus(' + ws.id + ', \'breakdown\')" class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200" title="Awaria"><i class="fas fa-exclamation-triangle"></i></button>' : '') +
                                    '<button onclick="editWorkStation(' + ws.id + ')" class="ml-auto px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200" title="Edytuj"><i class="fas fa-edit"></i></button>' +
                                '</div>' +
                            '</div>' +
                        '</div>';
                    }).join('');
                };
            }
        }, 500);
    });
    // A4: Obsługa localStorage dla filtrów
    var STORAGE_KEY = 'production_filters';
    
    function saveFiltersToStorage() {
        var filters = {
            rooms: {
                search: document.getElementById('rooms-search')?.value || '',
                manager: document.getElementById('rooms-manager-filter')?.value || ''
            },
            workCenters: {
                search: document.getElementById('work-centers-search')?.value || '',
                room: document.getElementById('work-centers-room-filter')?.value || ''
            },
            workStations: {
                search: document.getElementById('work-stations-search')?.value || '',
                center: document.getElementById('work-stations-center-filter')?.value || '',
                status: document.getElementById('work-stations-status-filter')?.value || ''
            }
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch (e) { /* ignore */ }
    }
    
    function loadFiltersFromStorage() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return null;
            return JSON.parse(stored);
        } catch (e) {
            return null;
        }
    }
    
    function restoreFilters() {
        var filters = loadFiltersFromStorage();
        if (!filters) return;
        
        // Pokoje
        var roomsSearch = document.getElementById('rooms-search');
        var roomsManager = document.getElementById('rooms-manager-filter');
        if (roomsSearch && filters.rooms?.search) roomsSearch.value = filters.rooms.search;
        if (roomsManager && filters.rooms?.manager) roomsManager.value = filters.rooms.manager;
        
        // Gniazda
        var wcSearch = document.getElementById('work-centers-search');
        var wcRoom = document.getElementById('work-centers-room-filter');
        if (wcSearch && filters.workCenters?.search) wcSearch.value = filters.workCenters.search;
        if (wcRoom && filters.workCenters?.room) wcRoom.value = filters.workCenters.room;
        
        // Maszyny
        var wsSearch = document.getElementById('work-stations-search');
        var wsCenter = document.getElementById('work-stations-center-filter');
        var wsStatus = document.getElementById('work-stations-status-filter');
        if (wsSearch && filters.workStations?.search) wsSearch.value = filters.workStations.search;
        if (wsCenter && filters.workStations?.center) wsCenter.value = filters.workStations.center;
        if (wsStatus && filters.workStations?.status) wsStatus.value = filters.workStations.status;
    }

    // A3: Obsługa wyszukiwarek i filtrów
    function setupSearchAndFilters() {
        // Pokoje - wyszukiwarka
        var roomsSearch = document.getElementById('rooms-search');
        var roomsManagerFilter = document.getElementById('rooms-manager-filter');
        var roomsClearBtn = document.getElementById('rooms-clear-filters');
        
        if (roomsSearch) {
            roomsSearch.addEventListener('input', function() { filterRooms(); saveFiltersToStorage(); });
        }
        if (roomsManagerFilter) {
            roomsManagerFilter.addEventListener('change', function() { filterRooms(); saveFiltersToStorage(); });
        }
        if (roomsClearBtn) {
            roomsClearBtn.addEventListener('click', function() {
                if (roomsSearch) roomsSearch.value = '';
                if (roomsManagerFilter) roomsManagerFilter.value = '';
                filterRooms();
                saveFiltersToStorage();
            });
        }
        
        // Gniazda - wyszukiwarka
        var wcSearch = document.getElementById('work-centers-search');
        var wcClearBtn = document.getElementById('work-centers-clear-filters');
        
        if (wcSearch) {
            wcSearch.addEventListener('input', function() {
                if (typeof filterWorkCenters === 'function') filterWorkCenters();
                saveFiltersToStorage();
            });
        }
        if (wcClearBtn) {
            wcClearBtn.addEventListener('click', function() {
                if (wcSearch) wcSearch.value = '';
                var wcRoomFilter = document.getElementById('work-centers-room-filter');
                if (wcRoomFilter) wcRoomFilter.value = '';
                if (typeof filterWorkCenters === 'function') filterWorkCenters();
                saveFiltersToStorage();
            });
        }
        
        // Maszyny - wyszukiwarka
        var wsSearch = document.getElementById('work-stations-search');
        var wsClearBtn = document.getElementById('work-stations-clear-filters');
        
        if (wsSearch) {
            wsSearch.addEventListener('input', function() {
                if (typeof filterWorkStations === 'function') filterWorkStations();
                saveFiltersToStorage();
            });
        }
        if (wsClearBtn) {
            wsClearBtn.addEventListener('click', function() {
                if (wsSearch) wsSearch.value = '';
                var wsCenterFilter = document.getElementById('work-stations-center-filter');
                var wsStatusFilter = document.getElementById('work-stations-status-filter');
                if (wsCenterFilter) wsCenterFilter.value = '';
                if (wsStatusFilter) wsStatusFilter.value = '';
                if (typeof filterWorkStations === 'function') filterWorkStations();
                saveFiltersToStorage();
            });
        }
        
        // Dodaj listener dla zmiany filtra pokoju w gniazda (select)
        var wcRoomFilter = document.getElementById('work-centers-room-filter');
        if (wcRoomFilter) {
            wcRoomFilter.addEventListener('change', function() {
                saveFiltersToStorage();
            });
        }
        
        // Dodaj listener dla zmiany filtrów w maszynach (select)
        var wsCenterFilter = document.getElementById('work-stations-center-filter');
        var wsStatusFilter = document.getElementById('work-stations-status-filter');
        if (wsCenterFilter) {
            wsCenterFilter.addEventListener('change', function() {
                saveFiltersToStorage();
            });
        }
        if (wsStatusFilter) {
            wsStatusFilter.addEventListener('change', function() {
                saveFiltersToStorage();
            });
        }
    }
    
    // Filtrowanie pokoi
    window.filterRooms = function() {
        var searchVal = (document.getElementById('rooms-search')?.value || '').toLowerCase();
        var managerVal = document.getElementById('rooms-manager-filter')?.value || '';
        
        if (typeof productionRooms === 'undefined') return;
        
        var filtered = productionRooms.filter(function(room) {
            // Filtr tekstowy
            var matchesSearch = !searchVal || 
                (room.name || '').toLowerCase().includes(searchVal) ||
                (room.code || '').toLowerCase().includes(searchVal) ||
                (room.description || '').toLowerCase().includes(searchVal);
            
            // Filtr menedżera
            var hasManager = room.roomManager && room.roomManager.id;
            var matchesManager = !managerVal ||
                (managerVal === 'has' && hasManager) ||
                (managerVal === 'none' && !hasManager);
            
            return matchesSearch && matchesManager;
        });
        
        // Renderuj przefiltrowane
        if (typeof window.renderProductionRooms === 'function') {
            var originalRooms = productionRooms;
            productionRooms = filtered;
            window.renderProductionRooms();
            productionRooms = originalRooms;
        }
    };
    
    // Nadpisanie filterWorkCenters z obsługą wyszukiwarki
    var originalFilterWorkCenters = null;
    function enhanceFilterWorkCenters() {
        if (typeof filterWorkCenters === 'function' && !originalFilterWorkCenters) {
            originalFilterWorkCenters = filterWorkCenters;
            window.filterWorkCenters = function() {
                var roomId = document.getElementById('work-centers-room-filter')?.value;
                var searchVal = (document.getElementById('work-centers-search')?.value || '').toLowerCase();
                
                if (typeof workCenters === 'undefined') return;
                
                var filtered = workCenters.filter(function(wc) {
                    var matchesRoom = !roomId || wc.roomId == roomId;
                    var matchesSearch = !searchVal ||
                        (wc.name || '').toLowerCase().includes(searchVal) ||
                        (wc.code || '').toLowerCase().includes(searchVal) ||
                        (wc.description || '').toLowerCase().includes(searchVal);
                    return matchesRoom && matchesSearch;
                });
                
                if (typeof renderWorkCenters === 'function') {
                    renderWorkCenters(filtered);
                }
            };
        }
    }
    
    // Nadpisanie filterWorkStations z obsługą wyszukiwarki
    var originalFilterWorkStations = null;
    function enhanceFilterWorkStations() {
        if (typeof filterWorkStations === 'function' && !originalFilterWorkStations) {
            originalFilterWorkStations = filterWorkStations;
            window.filterWorkStations = function() {
                var centerId = document.getElementById('work-stations-center-filter')?.value;
                var status = document.getElementById('work-stations-status-filter')?.value;
                var searchVal = (document.getElementById('work-stations-search')?.value || '').toLowerCase();
                
                if (typeof workStations === 'undefined') return;
                
                var filtered = workStations.filter(function(ws) {
                    var matchesCenter = !centerId || ws.workCenterId == centerId;
                    var matchesStatus = !status || ws.status === status;
                    var matchesSearch = !searchVal ||
                        (ws.name || '').toLowerCase().includes(searchVal) ||
                        (ws.code || '').toLowerCase().includes(searchVal) ||
                        (ws.manufacturer || '').toLowerCase().includes(searchVal) ||
                        (ws.model || '').toLowerCase().includes(searchVal);
                    return matchesCenter && matchesStatus && matchesSearch;
                });
                
                if (typeof renderWorkStations === 'function') {
                    renderWorkStations(filtered);
                }
            };
        }
    }
    
    // Inicjalizacja po załadowaniu
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            setupSearchAndFilters();
            enhanceFilterWorkCenters();
            enhanceFilterWorkStations();
            restoreFilters();
        }, 600);
    });
})();

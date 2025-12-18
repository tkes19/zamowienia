// Admin Panel Fixes - naprawy i poprawki
// Ten plik ładowany jest po admin.js i naprawia znane problemy

(function() {
    'use strict';

    // Fix: Przycisk edycji użytkownika - dodatkowy listener z capture phase
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            var usersTable = document.getElementById('users-table-body');
            if (usersTable) {
                // Dodaj listener z capture phase dla pewności
                usersTable.addEventListener('click', function(e) {
                    // Znajdź najbliższy element z data-action
                    var target = e.target;
                    var button = null;
                    
                    // Szukaj przycisku w górę drzewa DOM (max 5 poziomów)
                    for (var i = 0; i < 5 && target && target !== usersTable; i++) {
                        if (target.dataset && target.dataset.action) {
                            button = target;
                            break;
                        }
                        target = target.parentElement;
                    }
                    
                    if (!button) return;
                    
                    var action = button.dataset.action;
                    var userId = button.dataset.userId;
                    
                    if (!userId) return;
                    
                    // Użyj wyeksportowanej funkcji getAllUsers
                    var allUsers = typeof window.getAllUsers === 'function' ? window.getAllUsers() : [];
                    
                    var user = null;
                    for (var j = 0; j < allUsers.length; j++) {
                        if (allUsers[j].id === userId) {
                            user = allUsers[j];
                            break;
                        }
                    }
                    
                    if (!user) {
                        console.error('[admin-fixes] Nie znaleziono użytkownika:', userId);
                        return;
                    }
                    
                    if (action === 'edit-user') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof window.openUserForm === 'function') {
                            window.openUserForm(user);
                        } else {
                            console.error('[admin-fixes] openUserForm nie jest dostępne');
                        }
                    } else if (action === 'delete-user') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof window.handleDeleteUser === 'function') {
                            window.handleDeleteUser(user);
                        }
                    }
                }, true); // Capture phase - przechwytuje przed bubble
            }
            
            // Sprawdź czy funkcje są wyeksportowane
            if (typeof window.openUserForm !== 'function') {
                console.warn('[admin-fixes] openUserForm nie jest dostępne - sprawdź admin.js');
            }
            if (typeof window.getAllUsers !== 'function') {
                console.warn('[admin-fixes] getAllUsers nie jest dostępne - sprawdź admin.js');
            }
        }, 500);
    });
})();

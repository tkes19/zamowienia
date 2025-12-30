/**
 * Router dla endpointów admin
 * Zarządzanie produktami, użytkownikami, rolami i uprawnieniami
 */

const express = require('express');
const { requireRole } = require('../modules/auth');
const bcrypt = require('bcrypt');

const router = express.Router();

// Helper function to sync productionroomid with UserProductionRoom
async function upsertUserProductionRoom(supabase, userId, roomId) {
    if (!userId || !roomId) return;
    
    try {
        // Check if assignment already exists
        const { data: existing } = await supabase
            .from('UserProductionRoom')
            .select('id, isPrimary')
            .eq('userId', userId)
            .eq('roomId', roomId)
            .single();
            
        if (existing) {
            // Update existing assignment to primary
            await supabase
                .from('UserProductionRoom')
                .update({ isPrimary: true })
                .eq('id', existing.id);
        } else {
            // Insert new assignment as primary
            await supabase
                .from('UserProductionRoom')
                .insert({
                    userId,
                    roomId,
                    isPrimary: true,
                    createdAt: new Date().toISOString()
                });
        }
    } catch (error) {
        console.error('Error in upsertUserProductionRoom:', error);
        throw error;
    }
}

// Middleware do sprawdzania konfiguracji Supabase
router.use((req, res, next) => {
    if (!req.app.locals.supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }
    next();
});

// ============================================
// Produkty z magazynem
// ============================================

router.get('/products-with-stock', requireRole(['ADMIN', 'SALES_REP', 'WAREHOUSE', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { data, error } = await supabase
            .from('Product')
            .select(`
                *,
                Inventory (
                    stock,
                    stockOptimal,
                    stockOrdered,
                    stockReserved,
                    location
                )
            `)
            .order('name', { ascending: true });

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd pobierania produktów:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się pobrać produktów', 
            details: err.message 
        });
    }
});

// ============================================
// Zarządzanie produktami
// ============================================

router.get('/products/:id', requireRole(['ADMIN', 'SALES_REP', 'WAREHOUSE', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('Product')
            .select(`
                *,
                Inventory (*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd pobierania produktu:', err);
        return res.status(404).json({ 
            status: 'error', 
            message: 'Produkt nie znaleziony', 
            details: err.message 
        });
    }
});

router.post('/products', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { name, identifier, index, description, unit, price, category, isActive } = req.body;

    if (!name || !identifier) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Nazwa i identyfikator są wymagane' 
        });
    }

    try {
        const { data, error } = await supabase
            .from('Product')
            .insert([{
                name,
                identifier,
                index,
                description,
                unit,
                price,
                category,
                isActive: isActive !== undefined ? isActive : true,
                createdAt: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        // Utwórz rekord stanu magazynowego
        await supabase
            .from('Inventory')
            .insert([{
                id: require('crypto').randomUUID(),
                productId: data.id,
                stock: 0,
                stockOptimal: 0,
                stockOrdered: 0,
                stockReserved: 0,
                location: 'MAIN',
                updatedAt: new Date().toISOString()
            }]);

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd tworzenia produktu:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się utworzyć produktu', 
            details: err.message 
        });
    }
});

router.patch('/products/:id', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const updates = req.body;

    try {
        updates.updatedAt = new Date().toISOString();

        const { data, error } = await supabase
            .from('Product')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd aktualizacji produktu:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się zaktualizować produktu', 
            details: err.message 
        });
    }
});

router.delete('/products/:id', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        // Usuń stan magazynowy
        await supabase
            .from('Inventory')
            .delete()
            .eq('productId', id);

        // Usuń produkt
        const { error } = await supabase
            .from('Product')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return res.json({ 
            status: 'success', 
            message: 'Produkt usunięty' 
        });
    } catch (err) {
        console.error('Błąd usuwania produktu:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się usunąć produktu', 
            details: err.message 
        });
    }
});

router.patch('/products/:id/inventory', requireRole(['ADMIN', 'WAREHOUSE', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { quantity, location, notes } = req.body;

    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Ilość jest wymagana i nie może być ujemna' 
        });
    }

    try {
        const { data, error } = await supabase
            .from('Inventory')
            .update({
                stock: quantity,
                stockOptimal: quantity,
                stockOrdered: 0,
                stockReserved: 0,
                location: location || 'MAIN',
                updatedAt: new Date().toISOString()
            })
            .eq('productId', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd aktualizacji stanu magazynowego:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się zaktualizować stanu', 
            details: err.message 
        });
    }
});

// ============================================
// Zarządzanie działami
// ============================================

router.get('/departments', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { data, error } = await supabase
            .from('Department')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd pobierania działów:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się pobrać działów', 
            details: err.message 
        });
    }
});

router.post('/departments', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Nazwa działu jest wymagana' 
        });
    }

    try {
        const { data, error } = await supabase
            .from('Department')
            .insert([{
                name,
                description,
                createdAt: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd tworzenia działu:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się utworzyć działu', 
            details: err.message 
        });
    }
});

router.patch('/departments/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const updates = req.body;

    try {
        updates.updatedAt = new Date().toISOString();

        const { data, error } = await supabase
            .from('Department')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd aktualizacji działu:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się zaktualizować działu', 
            details: err.message 
        });
    }
});

router.delete('/departments/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        // Sprawdź czy dział nie ma przypisanych użytkowników
        const { data: users } = await supabase
            .from('User')
            .select('id')
            .eq('departmentId', id)
            .limit(1);

        if (users && users.length > 0) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Nie można usunąć działu z przypisanymi użytkownikami' 
            });
        }

        const { error } = await supabase
            .from('Department')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return res.json({ 
            status: 'success', 
            message: 'Dział usunięty' 
        });
    } catch (err) {
        console.error('Błąd usuwania działu:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się usunąć działu', 
            details: err.message 
        });
    }
});

// ============================================
// Użytkownicy
// ============================================

router.get('/users', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { data, error } = await supabase
            .from('User')
            .select(`
                *,
                Department (name),
                productionRoom:ProductionRoom!User_productionroomid_fkey(id, name, code)
            `)
            .order('createdAt', { ascending: false });

        // Fetch multiroom assignments separately
        if (!error && data) {
            const userIds = data.map(u => u.id);
            const { data: rooms, error: roomsError } = await supabase
                .from('UserProductionRoom')
                .select(`
                    id,
                    userId,
                    roomId,
                    isPrimary
                `)
                .in('userId', userIds);
            
            // Fetch room details separately
            const roomIds = [...new Set(rooms?.map(r => r.roomId) || [])];
            let roomDetails = [];
            if (roomIds.length > 0) {
                const { data: roomData } = await supabase
                    .from('ProductionRoom')
                    .select('id, name, code')
                    .in('id', roomIds);
                roomDetails = roomData || [];
            }
            
            // Merge room details into assignments
            if (rooms) {
                rooms.forEach(r => {
                    r.room = roomDetails.find(rd => rd.id === r.roomId);
                });
            }
            
            if (!roomsError && rooms) {
                // Merge rooms into user data
                data.forEach(user => {
                    user.productionRooms = rooms.filter(r => r.userId === user.id);
                });
            }
        }

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd pobierania użytkowników:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się pobrać użytkowników', 
            details: err.message 
        });
    }
});

router.post('/users', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    let { name, email, password, role, departmentId, productionroomid } = req.body;
    
    // Debug logging
    console.log('POST /users request body:', { name, email, password: password ? '***' : undefined, role, departmentId, productionroomid });
    
    // Email is optional for kiosk-eligible roles
    const kioskEligibleRoles = ['OPERATOR', 'PRODUCTION', 'PRODUCTION_MANAGER'];
    const isKioskRole = kioskEligibleRoles.includes(role);
    
    // Jeśli brak hasła lub za krótkie – generujemy (dla wszystkich, żeby nie blokować)
    if (!password || password.length < 6) {
        password = Math.random().toString(36).slice(-8) + 'Aa1!';
        console.log('Generated password server-side');
    }
    
    console.log('Role validation:', { role, isKioskRole, email });
    
    if (!name || !role) {
        console.log('Validation failed: missing name/role');
        return res.status(400).json({ status: 'error', message: 'Brak wymaganych pól' });
    }
    
    if (!isKioskRole && !email) {
        console.log('Validation failed: email required for non-kiosk role');
        return res.status(400).json({ status: 'error', message: 'Email jest wymagany dla tej roli' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('User')
            .insert([{
                name,
                email: email || null, // Ensure null if not provided
                password: hashedPassword,
                role,
                departmentId,
                productionroomid,
                isActive: true,
                createdAt: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        if (productionroomid) {
            await upsertUserProductionRoom(supabase, data.id, productionroomid);
        }

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd tworzenia użytkownika:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się utworzyć użytkownika', 
            details: err.message 
        });
    }
});

router.patch('/users/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const updates = req.body;

    // Normalizuj departmentId: puste stringi -> null
    if (updates && updates.departmentId === '') {
        updates.departmentId = null;
    }

    try {
        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        } else {
            delete updates.password;
        }

        if (updates.kioskPin) {
            updates.kioskPin = await bcrypt.hash(updates.kioskPin, 10);
        }

        updates.updatedAt = new Date().toISOString();

        const { data, error } = await supabase
            .from('User')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (updates.productionroomid) {
            await upsertUserProductionRoom(supabase, id, updates.productionroomid);
        }

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd aktualizacji użytkownika:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się zaktualizować użytkownika', 
            details: err.message 
        });
    }
});

// Endpoint do sprawdzania powiązań użytkownika
router.get('/users/:id/dependencies', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        const dependencies = {};

        // Sprawdź zamówienia (Order.userId - RESTRICT)
        const { count: ordersCount } = await supabase
            .from('Order')
            .select('*', { count: 'exact', head: true })
            .eq('userId', id);
        if (ordersCount > 0) dependencies.orders = ordersCount;

        // Sprawdź klientów (Customer.salesRepId - SET NULL)
        const { count: customersCount } = await supabase
            .from('Customer')
            .select('*', { count: 'exact', head: true })
            .eq('salesRepId', id);
        if (customersCount > 0) dependencies.customers = customersCount;

        // Sprawdź UserFolderAccess (userId - CASCADE, assignedBy - SET NULL)
        const { count: folderAccessCount } = await supabase
            .from('UserFolderAccess')
            .select('*', { count: 'exact', head: true })
            .eq('userId', id);
        if (folderAccessCount > 0) dependencies.folderAccess = folderAccessCount;

        // Sprawdź order_drafts (user_id - CASCADE)
        const { count: draftsCount } = await supabase
            .from('order_drafts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', id);
        if (draftsCount > 0) dependencies.orderDrafts = draftsCount;

        const canDelete = Object.keys(dependencies).length === 0 || 
                         (dependencies.orders === undefined); // Orders blokują hard delete

        return res.json({ 
            status: 'success', 
            canDelete,
            dependencies,
            blockers: dependencies.orders ? ['orders'] : []
        });
    } catch (err) {
        console.error('Błąd sprawdzania powiązań użytkownika:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się sprawdzić powiązań użytkownika', 
            details: err.message 
        });
    }
});

router.delete('/users/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        const hardDelete = req.query && req.query.hard === 'true';

        if (hardDelete) {
            // Sprawdź blokujące powiązania przed hard delete
            const { count: ordersCount } = await supabase
                .from('Order')
                .select('*', { count: 'exact', head: true })
                .eq('userId', id);

            if (ordersCount > 0) {
                return res.status(400).json({ 
                    status: 'blocked', 
                    message: `Nie można usunąć użytkownika. Ma przypisane ${ordersCount} zamówień.`,
                    dependencies: { orders: ordersCount },
                    blockers: ['orders']
                });
            }

            const { error } = await supabase
                .from('User')
                .delete()
                .eq('id', id);

            if (error) throw error;

            return res.json({ status: 'success', message: 'Użytkownik usunięty na stałe' });
        }

        // Soft delete – mark user as inactive to preserve foreign key references
        const { data, error } = await supabase
            .from('User')
            .update({ isActive: false, updatedAt: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({ status: 'success', message: 'Użytkownik zdezaktywowany', data });
    } catch (err) {
        console.error('Błąd usuwania użytkownika:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się usunąć użytkownika', 
            details: err.message 
        });
    }
});

// ============================================
// Role użytkowników
// ============================================

router.get('/user-role-assignments', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ status: 'error', message: 'Brak userId' });
    }

    try {
        const { data, error } = await supabase
            .from('UserRoleAssignment')
            .select('*')
            .eq('userId', userId);

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd pobierania ról użytkownika:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się pobrać ról', 
            details: err.message 
        });
    }
});

router.post('/user-role-assignments', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId, role } = req.body;

    if (!userId || !role) {
        return res.status(400).json({ status: 'error', message: 'Brak userId lub role' });
    }

    try {
        const { data: existing, error: existingError } = await supabase
            .from('UserRoleAssignment')
            .select('id')
            .eq('userId', userId)
            .eq('role', role)
            .maybeSingle();

        if (existingError) throw existingError;
        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Rola już przypisana' });
        }

        const { data, error: insertError } = await supabase
            .from('UserRoleAssignment')
            .insert({
                userId,
                role,
                assignedAt: new Date().toISOString()
            });

        if (insertError) throw insertError;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd dodawania roli:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się dodać roli', 
            details: err.message 
        });
    }
});

router.delete('/user-role-assignments/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('UserRoleAssignment')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return res.json({ status: 'success', message: 'Przypisanie usunięte' });
    } catch (err) {
        console.error('Błąd usuwania przypisania roli:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się usunąć przypisania', 
            details: err.message 
        });
    }
});

router.put('/user-role-assignments/sync/:userId', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId } = req.params;
    const { roles } = req.body;

    if (!Array.isArray(roles)) {
        return res.status(400).json({ status: 'error', message: 'Roles musi być tablicą' });
    }

    try {
        // Usuń istniejące przypisania
        await supabase
            .from('UserRoleAssignment')
            .delete()
            .eq('userId', userId);

        // Dodaj nowe przypisania
        if (roles.length > 0) {
            const newAssignments = roles.map(role => ({
                userId,
                role,
                assignedAt: new Date().toISOString(),
                assignedBy: req.user.id
            }));

            const { error } = await supabase
                .from('UserRoleAssignment')
                .insert(newAssignments);

            if (error) throw error;
        }

        return res.json({ status: 'success', message: 'Role zsynchronizowane' });
    } catch (err) {
        console.error('Błąd synchronizacji ról:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się zsynchronizować ról', 
            details: err.message 
        });
    }
});

module.exports = router;

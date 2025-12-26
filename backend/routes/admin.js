/**
 * Router dla endpointów admin
 * Zarządzanie produktami, użytkownikami, rolami i uprawnieniami
 */

const express = require('express');
const { requireRole } = require('../modules/auth');
const bcrypt = require('bcrypt');

const router = express.Router();

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
                Department (name)
            `)
            .order('createdAt', { ascending: false });

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
    const { name, email, password, role, departmentId, productionroomid } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ status: 'error', message: 'Brak wymaganych pól' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('User')
            .insert([{
                name,
                email,
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

    try {
        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
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

router.delete('/users/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('User')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return res.json({ status: 'success', message: 'Użytkownik usunięty' });
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
            .from('UserRole')
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
        return res.status(400).json({ status: 'error', message: 'Brak wymaganych pól' });
    }

    try {
        const { data, error } = await supabase
            .from('UserRole')
            .insert([{
                userId,
                role,
                assignedAt: new Date().toISOString(),
                assignedBy: req.user.id
            }])
            .select()
            .single();

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd przypisywania roli:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się przypisać roli', 
            details: err.message 
        });
    }
});

router.delete('/user-role-assignments/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('UserRole')
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
            .from('UserRole')
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
                .from('UserRole')
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

// ============================================
// Sync z zewnętrznego API
// ============================================

router.post('/sync-from-external-api', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { type } = req.body;

    try {
        let results = [];

        switch (type) {
            case 'cities':
                const citiesResponse = await fetch('https://polskieszlaki.pl/panel/api/cities');
                const cities = await citiesResponse.json();
                
                for (const city of cities) {
                    const { error } = await supabase
                        .from('City')
                        .upsert([{
                            name: city,
                            isActive: true
                        }], { onConflict: 'name' });
                    
                    if (!error) results.push(city);
                }
                break;

            case 'salespeople':
                const salesResponse = await fetch('https://polskieszlaki.pl/panel/api/salespeople');
                const salespeople = await salesResponse.json();
                
                for (const person of salespeople) {
                    const { error } = await supabase
                        .from('Salesperson')
                        .upsert([{
                            name: person.name,
                            email: person.email || null,
                            phone: person.phone || null,
                            isActive: true
                        }], { onConflict: 'email' });
                    
                    if (!error) results.push(person);
                }
                break;

            default:
                return res.status(400).json({
                    status: 'error',
                    message: 'Nieznany typ synchronizacji'
                });
        }

        return res.json({
            status: 'success',
            message: `Synchronizacja zakończona. Zaktualizowano ${results.length} rekordów.`,
            data: {
                syncedCount: results.length,
                type
            }
        });

    } catch (err) {
        console.error('Błąd synchronizacji:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd synchronizacji', 
            details: err.message 
        });
    }
});


// ============================================
// UNASSIGNED CITIES - Nieprzypisane miejscowości
// ============================================

router.get('/unassigned-cities', requireRole(['GRAPHICS', 'GRAPHIC_DESIGNER', 'ADMIN', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const config = req.app.locals.config;
    
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const GALLERY_BASE = config?.GALLERY_BASE || process.env.GALLERY_BASE;
        
        console.log('[unassigned-cities] Pobieranie z:', `${GALLERY_BASE}/list_cities.php`);
        const galleryResponse = await fetch(`${GALLERY_BASE}/list_cities.php`);
        if (!galleryResponse.ok) {
            console.error('[unassigned-cities] Błąd odpowiedzi galerii:', galleryResponse.status);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać listy miejscowości z galerii' });
        }
        
        const galleryData = await galleryResponse.json();
        console.log('[unassigned-cities] Pobrano miejscowości:', galleryData.cities?.length || 0);
        const allCities = Array.isArray(galleryData.cities) ? galleryData.cities : [];
        
        const realCities = allCities.filter(city => !/^\d+\./.test((city ?? '').trim()));
        
        const { data: assignments, error: assignmentsError } = await supabase
            .from('UserCityAccess')
            .select('cityName, isActive');
        
        if (assignmentsError) {
            console.error('Błąd pobierania przypisań:', assignmentsError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać przypisań', details: assignmentsError.message });
        }
        
        const assignedCities = new Set();
        (assignments || []).forEach(assignment => {
            if (assignment.isActive && assignment.cityName) {
                assignedCities.add(assignment.cityName);
            }
        });
        
        const unassignedCities = realCities.filter(city => !assignedCities.has(city));
        
        return res.json({
            status: 'success',
            data: {
                allCities: realCities,
                assignedCities: Array.from(assignedCities),
                unassignedCities: unassignedCities,
                stats: {
                    total: realCities.length,
                    assigned: assignedCities.size,
                    unassigned: unassignedCities.length
                }
            }
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/unassigned-cities:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// ============================================
// GALLERY PROJECTS - Projekty galerii
// ============================================

router.get('/gallery-projects', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { search } = req.query || {};

    try {
        let query = supabase
            .from('GalleryProject')
            .select(`
                id,
                slug,
                displayName,
                createdAt,
                GalleryProjectProduct:GalleryProjectProduct(productId)
            `)
            .order('displayName', { ascending: true });

        if (search && typeof search === 'string' && search.trim()) {
            const term = `%${search.trim()}%`;
            query = query.or(`displayName.ilike.${term},slug.ilike.${term}`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Błąd pobierania projektów galerii:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać projektów galerii', details: error.message });
        }

        const projects = (data || []).map((row) => ({
            id: row.id,
            slug: row.slug,
            displayName: row.displayName,
            createdAt: row.createdAt,
            productCount: Array.isArray(row.GalleryProjectProduct) ? row.GalleryProjectProduct.length : 0,
        }));

        return res.json({
            status: 'success',
            data: projects,
            count: projects.length,
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/gallery-projects:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

router.post('/gallery-projects', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { slug, displayName } = req.body || {};

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
        return res.status(400).json({ status: 'error', message: 'Slug jest wymagany' });
    }

    const normalizedSlug = slug.trim();
    const name = (displayName && displayName.trim()) || normalizedSlug.replace(/_/g, ' ').toUpperCase();

    try {
        const { data, error } = await supabase
            .from('GalleryProject')
            .insert({
                slug: normalizedSlug,
                displayName: name,
                createdAt: new Date().toISOString(),
            })
            .select('*')
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ status: 'error', message: 'Projekt o takim slugu już istnieje' });
            }
            console.error('Błąd tworzenia projektu galerii:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć projektu galerii', details: error.message });
        }

        return res.status(201).json({ status: 'success', data, message: 'Projekt galerii utworzony' });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/gallery-projects:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

router.patch('/gallery-projects/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const { slug, displayName } = req.body || {};

    if (!id) {
        return res.status(400).json({ status: 'error', message: 'Brak id projektu' });
    }

    const updateData = {};
    if (slug !== undefined) {
        if (!slug || !slug.trim()) {
            return res.status(400).json({ status: 'error', message: 'Slug nie może być pusty' });
        }
        updateData.slug = slug.trim();
    }
    if (displayName !== undefined) {
        updateData.displayName = displayName.trim();
    }

    if (!Object.keys(updateData).length) {
        return res.status(400).json({ status: 'error', message: 'Brak danych do aktualizacji' });
    }

    try {
        const { data, error } = await supabase
            .from('GalleryProject')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ status: 'error', message: 'Projekt o takim slugu już istnieje' });
            }
            console.error('Błąd aktualizacji projektu galerii:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować projektu galerii', details: error.message });
        }

        return res.json({ status: 'success', data, message: 'Projekt galerii zaktualizowany' });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/gallery-projects/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

router.delete('/gallery-projects/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('GalleryProject')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania projektu galerii:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć projektu galerii', details: error.message });
        }

        return res.json({ status: 'success', message: 'Projekt galerii został usunięty' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/gallery-projects/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

router.get('/gallery-projects/:id/products', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('GalleryProjectProduct')
            .select('productId')
            .eq('projectId', id);

        if (error) {
            console.error('Błąd pobierania produktów projektu galerii:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać produktów projektu galerii', details: error.message });
        }

        const productIds = (data || []).map((row) => row.productId).filter(Boolean);
        let items = [];

        if (productIds.length) {
            const { data: products, error: productsError } = await supabase
                .from('Product')
                .select('id, identifier, index')
                .in('id', productIds);

            if (productsError) {
                console.error('Błąd pobierania szczegółów produktów:', productsError);
            } else {
                items = (products || []).map((p) => ({
                    productId: p.id,
                    identifier: p.identifier || null,
                    index: p.index || null,
                }));
            }
        }

        return res.json({ status: 'success', data: items });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/gallery-projects/:id/products:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

router.post('/gallery-projects/:id/products', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const { productId } = req.body || {};

    if (!productId) {
        return res.status(400).json({ status: 'error', message: 'productId jest wymagane' });
    }

    try {
        const { data: project, error: projectError } = await supabase
            .from('GalleryProject')
            .select('id')
            .eq('id', id)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ status: 'error', message: 'Projekt galerii nie istnieje' });
        }

        const { data: product, error: productError } = await supabase
            .from('Product')
            .select('id, identifier, index')
            .eq('id', productId)
            .single();

        if (productError || !product) {
            return res.status(404).json({ status: 'error', message: 'Produkt nie istnieje' });
        }

        const { data, error } = await supabase
            .from('GalleryProjectProduct')
            .insert({
                projectId: project.id,
                productId: product.id,
                createdAt: new Date().toISOString(),
            })
            .select('projectId, productId')
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ status: 'error', message: 'Produkt jest już przypisany do tego projektu' });
            }
            console.error('Błąd przypisywania produktu do projektu galerii:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się przypisać produktu do projektu', details: error.message });
        }

        return res.status(201).json({
            status: 'success',
            data: {
                projectId: data.projectId,
                productId: data.productId,
                identifier: product.identifier,
                index: product.index,
            },
            message: 'Produkt przypisany do projektu',
        });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/gallery-projects/:id/products:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

router.delete('/gallery-projects/:id/products/:productId', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id, productId } = req.params;

    try {
        const { error } = await supabase
            .from('GalleryProjectProduct')
            .delete()
            .eq('projectId', id)
            .eq('productId', productId);

        if (error) {
            console.error('Błąd usuwania przypisania produktu do projektu:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć przypisania produktu', details: error.message });
        }

        return res.json({ status: 'success', message: 'Przypisanie produktu zostało usunięte' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/gallery-projects/:id/products/:productId:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// ============================================
// ADMIN ORDERS - Lista zamówień w panelu admina
// ============================================

router.get('/orders', async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { getAuthContext } = require('../modules/auth');
    
    try {
        const { userId, role } = await getAuthContext(req);

        console.log('[GET /api/admin/orders] start', { userId, role });
        
        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        if (!['SALES_REP', 'ADMIN', 'SALES_DEPT', 'WAREHOUSE'].includes(role)) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do tego zasobu' });
        }

        const { status, userId: filterUserId, customerId, dateFrom, dateTo } = req.query;

        let query = supabase
            .from('Order')
            .select(`
                id,
                orderNumber,
                customerId,
                userId,
                status,
                total,
                notes,
                createdAt,
                updatedAt,
                Customer:customerId(id, name),
                User:userId(id, name, shortCode)
            `)
            .order('createdAt', { ascending: false });

        if (role === 'SALES_REP') {
            query = query.eq('userId', userId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (filterUserId) {
            query = query.eq('userId', filterUserId);
        }

        if (customerId) {
            query = query.eq('customerId', customerId);
        }

        if (dateFrom) {
            query = query.gte('createdAt', dateFrom);
        }

        if (dateTo) {
            query = query.lte('createdAt', dateTo);
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('Błąd Supabase w GET /api/admin/orders:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania zamówień' });
        }

        const orderIds = (orders || []).map(o => o.id);
        let productionProgressMap = {};

        if (orderIds.length > 0) {
            const { data: prodOrders, error: prodError } = await supabase
                .from('ProductionOrder')
                .select('id, sourceorderid, status')
                .in('sourceorderid', orderIds);

            if (!prodError && prodOrders && prodOrders.length > 0) {
                const prodOrderIds = prodOrders.map(po => po.id);
                const { data: operations, error: opsError } = await supabase
                    .from('ProductionOperation')
                    .select('id, productionorderid, status')
                    .in('productionorderid', prodOrderIds);

                prodOrders.forEach(po => {
                    const sourceId = po.sourceorderid;
                    if (!productionProgressMap[sourceId]) {
                        productionProgressMap[sourceId] = {
                            totalOrders: 0,
                            completedOrders: 0,
                            totalOps: 0,
                            completedOps: 0
                        };
                    }
                    productionProgressMap[sourceId].totalOrders++;
                    if (po.status === 'completed') {
                        productionProgressMap[sourceId].completedOrders++;
                    }
                });

                if (!opsError && operations) {
                    operations.forEach(op => {
                        const prodOrder = prodOrders.find(po => po.id === op.productionorderid);
                        if (prodOrder) {
                            const sourceId = prodOrder.sourceorderid;
                            if (productionProgressMap[sourceId]) {
                                productionProgressMap[sourceId].totalOps++;
                                if (op.status === 'completed') {
                                    productionProgressMap[sourceId].completedOps++;
                                }
                            }
                        }
                    });
                }
            }
        }

        const ordersWithProgress = (orders || []).map(order => {
            const progress = productionProgressMap[order.id];
            if (progress) {
                const percent = progress.totalOps > 0 
                    ? Math.round((progress.completedOps / progress.totalOps) * 100) 
                    : 0;
                return {
                    ...order,
                    productionProgress: {
                        totalOrders: progress.totalOrders,
                        completedOrders: progress.completedOrders,
                        totalOps: progress.totalOps,
                        completedOps: progress.completedOps,
                        percent,
                        label: `${progress.completedOps}/${progress.totalOps}`
                    }
                };
            }
            return {
                ...order,
                productionProgress: null
            };
        });

        console.log('[GET /api/admin/orders] returning', { count: ordersWithProgress.length });

        return res.json({
            status: 'success',
            data: ordersWithProgress
        });
    } catch (error) {
        console.error('Błąd w GET /api/admin/orders:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// Zarządzanie presetami terminów dostawy
// ============================================

/**
 * GET /api/admin/order-delivery-presets
 * Pobiera wszystkie presety terminów dostawy
 */
router.get('/order-delivery-presets', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { data, error } = await supabase
            .from('OrderDeliveryPreset')
            .select('id, label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder, createdAt, updatedAt')
            .order('sortOrder', { ascending: true })
            .order('offsetDays', { ascending: true });

        if (error) {
            console.error('Błąd pobierania OrderDeliveryPreset (admin):', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać presetów terminów dostawy', details: error.message });
        }

        return res.json({
            status: 'success',
            data: data || [],
            count: data?.length || 0,
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/order-delivery-presets:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

/**
 * POST /api/admin/order-delivery-presets
 * Tworzy nowy preset terminu dostawy
 */
router.post('/order-delivery-presets', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder } = req.body || {};

    if (!label || typeof label !== 'string' || !label.trim()) {
        return res.status(400).json({ status: 'error', message: 'label jest wymagane' });
    }

    // Tryb: OFFSET (domyślny) lub FIXED_DATE
    const normalizedMode = (typeof mode === 'string' && mode.trim()) ? mode.trim().toUpperCase() : 'OFFSET';
    const finalMode = ['OFFSET', 'FIXED_DATE'].includes(normalizedMode) ? normalizedMode : 'OFFSET';

    let normalizedOffset = 0;
    let normalizedFixedDate = null;

    if (finalMode === 'OFFSET') {
        normalizedOffset = Number(offsetDays);
        if (!Number.isFinite(normalizedOffset)) {
            normalizedOffset = 0;
        }
    } else {
        // FIXED_DATE - walidacja daty
        if (fixedDate && typeof fixedDate === 'string' && fixedDate.trim()) {
            const dateObj = new Date(fixedDate);
            if (!isNaN(dateObj.getTime())) {
                normalizedFixedDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
            }
        }
    }

    const newPreset = {
        id: require('crypto').randomUUID(),
        label: label.trim(),
        offsetDays: normalizedOffset,
        mode: finalMode,
        fixedDate: normalizedFixedDate,
        isDefault: Boolean(isDefault),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        sortOrder: Number(sortOrder) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('OrderDeliveryPreset')
            .insert([newPreset])
            .select()
            .single();

        if (error) {
            console.error('Błąd tworzenia OrderDeliveryPreset:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć presetu terminu dostawy', details: error.message });
        }

        return res.json({
            status: 'success',
            message: 'Preset terminu dostawy utworzony',
            data
        });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/order-delivery-presets:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

/**
 * PATCH /api/admin/order-delivery-presets/:id
 * Aktualizuje preset terminu dostawy
 */
router.patch('/order-delivery-presets/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const { label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder } = req.body || {};

    if (!id) {
        return res.status(400).json({ status: 'error', message: 'ID jest wymagane' });
    }

    const updates = {};

    if (label !== undefined) {
        if (typeof label !== 'string' || !label.trim()) {
            return res.status(400).json({ status: 'error', message: 'label jest wymagane' });
        }
        updates.label = label.trim();
    }

    if (mode !== undefined) {
        const normalizedMode = (typeof mode === 'string' && mode.trim()) ? mode.trim().toUpperCase() : 'OFFSET';
        updates.mode = ['OFFSET', 'FIXED_DATE'].includes(normalizedMode) ? normalizedMode : 'OFFSET';
    }

    if (offsetDays !== undefined && updates.mode !== 'FIXED_DATE') {
        const normalizedOffset = Number(offsetDays);
        if (!Number.isFinite(normalizedOffset)) {
            return res.status(400).json({ status: 'error', message: 'offsetDays musi być liczbą' });
        }
        updates.offsetDays = normalizedOffset;
    }

    if (fixedDate !== undefined) {
        if (fixedDate && typeof fixedDate === 'string' && fixedDate.trim()) {
            const dateObj = new Date(fixedDate);
            if (!isNaN(dateObj.getTime())) {
                updates.fixedDate = dateObj.toISOString().split('T')[0];
            }
        } else {
            updates.fixedDate = null;
        }
    }

    if (isDefault !== undefined) updates.isDefault = Boolean(isDefault);
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder) || 0;

    updates.updatedAt = new Date().toISOString();

    try {
        const { data, error } = await supabase
            .from('OrderDeliveryPreset')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Błąd aktualizacji OrderDeliveryPreset:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować presetu terminu dostawy', details: error.message });
        }

        if (!data) {
            return res.status(404).json({ status: 'error', message: 'Preset terminu dostawy nie znaleziony' });
        }

        return res.json({
            status: 'success',
            message: 'Preset terminu dostawy zaktualizowany',
            data
        });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/order-delivery-presets/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

/**
 * DELETE /api/admin/order-delivery-presets/:id
 * Usuwa preset terminu dostawy
 */
router.delete('/order-delivery-presets/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ status: 'error', message: 'ID jest wymagane' });
    }

    try {
        const { error } = await supabase
            .from('OrderDeliveryPreset')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania OrderDeliveryPreset:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć presetu terminu dostawy', details: error.message });
        }

        return res.json({
            status: 'success',
            message: 'Preset terminu dostawy usunięty'
        });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/order-delivery-presets/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

/**
 * PATCH /api/admin/products/:id/inventory
 * Aktualizuje stany magazynowe produktu
 */
router.patch('/products/:id/inventory', requireRole(['ADMIN', 'WAREHOUSE', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { stock = 0, stockOptimal = 0, stockOrdered = 0, stockReserved = 0 } = req.body || {};

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        // Upewnij się, że produkt istnieje
        const { data: product, error: productError } = await supabase
            .from('Product')
            .select('id')
            .eq('id', id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ status: 'error', message: 'Produkt nie znaleziony' });
        }

        // Sprawdź, czy istnieje rekord Inventory dla location MAIN
        const { data: existingInv } = await supabase
            .from('Inventory')
            .select('id')
            .eq('productId', id)
            .eq('location', 'MAIN')
            .single();

        const inventoryData = {
            stock: Number(stock) || 0,
            stockOptimal: Number(stockOptimal) || 0,
            stockOrdered: Number(stockOrdered) || 0,
            stockReserved: Number(stockReserved) || 0,
            updatedAt: new Date().toISOString(),
        };

        if (existingInv) {
            const { error: updateErr } = await supabase
                .from('Inventory')
                .update(inventoryData)
                .eq('id', existingInv.id);

            if (updateErr) {
                console.error('Błąd aktualizacji Inventory:', updateErr);
                return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować stanów magazynowych', details: updateErr.message });
            }
        } else {
            const newInventory = {
                id: require('crypto').randomUUID(),
                productId: id,
                location: 'MAIN',
                reorderPoint: 0,
                ...inventoryData,
            };

            const { error: insertErr } = await supabase
                .from('Inventory')
                .insert(newInventory);

            if (insertErr) {
                console.error('Błąd tworzenia Inventory:', insertErr);
                return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć stanów magazynowych', details: insertErr.message });
            }
        }

        return res.json({ status: 'success', message: 'Stany magazynowe zapisane' });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/products/:id/inventory:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas zapisu stanów magazynowych', details: err.message });
    }
});

module.exports = router;

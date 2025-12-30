/**
 * Moduł zarządzania stanami magazynowymi materiałów
 * Endpointy: GET/POST /api/production/materials
 */

const express = require('express');
const router = express.Router();
const { requireRole } = require('../../modules/auth');

// ============================================
// GET /api/production/materials/stock
// Pobierz stany magazynowe wszystkich materiałów
// ============================================
router.get('/stock', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'WAREHOUSE']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { search, belowThreshold, isActive = 'true' } = req.query;
        
        let query = supabase
            .from('MaterialStock')
            .select('*');
        
        if (isActive === 'true') {
            query = query.eq('isActive', true);
        }
        
        if (search) {
            query = query.or(`materialCode.ilike.%${search}%,name.ilike.%${search}%`);
        }
        
        if (belowThreshold === 'true') {
            query = query.lt('quantity', supabase.raw('"minThreshold"'));
        }
        
        const { data, error } = await query.order('name');
        
        if (error) throw error;
        
        // Dodaj flagę braku dla każdego materiału
        const dataWithFlags = (data || []).map(m => ({
            ...m,
            isShortage: m.quantity < m.minThreshold,
            shortageAmount: Math.max(0, m.minThreshold - m.quantity)
        }));
        
        res.json({
            success: true,
            data: dataWithFlags,
            count: dataWithFlags.length,
            shortageCount: dataWithFlags.filter(m => m.isShortage).length
        });
        
    } catch (error) {
        console.error('Błąd pobierania stanów magazynowych:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd pobierania stanów magazynowych',
            details: error.message
        });
    }
});

// ============================================
// GET /api/production/materials/shortages
// Pobierz listę braków materiałowych
// ============================================
router.get('/shortages', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'WAREHOUSE']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        // Użyj widoku MaterialShortages
        const { data, error } = await supabase
            .from('MaterialShortages')
            .select('*');
        
        if (error) throw error;
        
        res.json({
            success: true,
            data: data || [],
            count: data?.length || 0
        });
        
    } catch (error) {
        console.error('Błąd pobierania braków materiałowych:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd pobierania braków materiałowych',
            details: error.message
        });
    }
});

// ============================================
// GET /api/production/materials/:id
// Pobierz szczegóły materiału wraz z historią
// ============================================
router.get('/:id', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'WAREHOUSE']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    
    try {
        // Pobierz materiał
        const { data: material, error: materialError } = await supabase
            .from('MaterialStock')
            .select('*')
            .eq('id', id)
            .single();
        
        if (materialError || !material) {
            return res.status(404).json({
                success: false,
                error: 'Materiał nie znaleziony'
            });
        }
        
        // Pobierz historię zmian (ostatnie 20)
        const { data: history, error: historyError } = await supabase
            .from('MaterialStockLog')
            .select(`
                *,
                changedByUser:User!changedBy(id, name)
            `)
            .eq('materialId', id)
            .order('createdAt', { ascending: false })
            .limit(20);
        
        // Pobierz powiązane produkty
        const { data: products, error: productsError } = await supabase
            .from('ProductMaterial')
            .select('productId, quantityPerUnit, notes')
            .eq('materialId', id);
        
        res.json({
            success: true,
            data: {
                ...material,
                isShortage: material.quantity < material.minThreshold,
                shortageAmount: Math.max(0, material.minThreshold - material.quantity),
                history: history || [],
                linkedProducts: products || []
            }
        });
        
    } catch (error) {
        console.error('Błąd pobierania szczegółów materiału:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd pobierania szczegółów materiału',
            details: error.message
        });
    }
});

// ============================================
// POST /api/production/materials
// Dodaj nowy materiał
// ============================================
router.post('/', requireRole(['ADMIN', 'WAREHOUSE']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { materialCode, name, description, quantity, unit, minThreshold, maxThreshold, autoOrderEnabled, autoOrderQuantity } = req.body;
    const userId = req.user?.id;
    
    // Walidacja
    if (!materialCode || !name) {
        return res.status(400).json({
            success: false,
            error: 'Wymagane pola: materialCode, name'
        });
    }
    
    try {
        const { data, error } = await supabase
            .from('MaterialStock')
            .insert({
                materialCode,
                name,
                description: description || null,
                quantity: quantity || 0,
                unit: unit || 'szt',
                minThreshold: minThreshold || 0,
                maxThreshold: maxThreshold || null,
                autoOrderEnabled: autoOrderEnabled || false,
                autoOrderQuantity: autoOrderQuantity || null,
                updatedBy: userId,
                isActive: true
            })
            .select()
            .single();
        
        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({
                    success: false,
                    error: `Materiał o kodzie ${materialCode} już istnieje`
                });
            }
            throw error;
        }
        
        res.status(201).json({
            success: true,
            data,
            message: `Materiał ${name} został dodany`
        });
        
    } catch (error) {
        console.error('Błąd dodawania materiału:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd dodawania materiału',
            details: error.message
        });
    }
});

// ============================================
// PATCH /api/production/materials/:id/stock
// Aktualizuj stan magazynowy (przyjęcie/wydanie)
// ============================================
router.patch('/:id/stock', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'WAREHOUSE']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { quantity, changeType, notes, orderId } = req.body;
    const userId = req.user?.id;
    
    // Walidacja
    if (quantity === undefined || quantity === null) {
        return res.status(400).json({
            success: false,
            error: 'Wymagane pole: quantity'
        });
    }
    
    const validChangeTypes = ['receipt', 'issue', 'adjustment', 'return', 'scrap'];
    if (changeType && !validChangeTypes.includes(changeType)) {
        return res.status(400).json({
            success: false,
            error: `Nieprawidłowy typ zmiany. Dozwolone: ${validChangeTypes.join(', ')}`
        });
    }
    
    try {
        // Pobierz aktualny stan
        const { data: current, error: currentError } = await supabase
            .from('MaterialStock')
            .select('*')
            .eq('id', id)
            .single();
        
        if (currentError || !current) {
            return res.status(404).json({
                success: false,
                error: 'Materiał nie znaleziony'
            });
        }
        
        const newQuantity = parseFloat(quantity);
        if (newQuantity < 0) {
            return res.status(400).json({
                success: false,
                error: 'Stan magazynowy nie może być ujemny'
            });
        }
        
        // Aktualizuj stan
        const { data: updated, error: updateError } = await supabase
            .from('MaterialStock')
            .update({
                quantity: newQuantity,
                updatedBy: userId
            })
            .eq('id', id)
            .select()
            .single();
        
        if (updateError) throw updateError;
        
        // Dodaj wpis do logu (jeśli podano changeType)
        if (changeType) {
            await supabase
                .from('MaterialStockLog')
                .insert({
                    materialId: id,
                    previousQuantity: current.quantity,
                    newQuantity: newQuantity,
                    changeType,
                    orderId: orderId || null,
                    notes: notes || null,
                    changedBy: userId
                });
        }
        
        // Sprawdź czy jest brak i emituj SSE
        const isShortage = newQuantity < current.minThreshold;
        const wasShortage = current.quantity < current.minThreshold;
        
        const sseModule = req.app.locals.sse;
        if (sseModule && isShortage && !wasShortage) {
            sseModule.broadcastEvent({
                type: 'material_shortage',
                data: {
                    materialId: id,
                    materialCode: current.materialCode,
                    materialName: current.name,
                    currentQty: newQuantity,
                    threshold: current.minThreshold,
                    shortageAmount: current.minThreshold - newQuantity,
                    timestamp: new Date().toISOString()
                }
            });
        }
        
        res.json({
            success: true,
            data: {
                ...updated,
                isShortage,
                shortageAmount: Math.max(0, current.minThreshold - newQuantity)
            },
            message: `Stan materiału zaktualizowany: ${newQuantity} ${current.unit}`
        });
        
    } catch (error) {
        console.error('Błąd aktualizacji stanu magazynowego:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd aktualizacji stanu magazynowego',
            details: error.message
        });
    }
});

// ============================================
// GET /api/production/materials/consumption-report
// Raport zużycia materiałów za ostatnie 30 dni
// ============================================
router.get('/consumption-report', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { days = 30 } = req.query;
        
        const { data, error } = await supabase
            .from('MaterialStockLog')
            .select(`
                *,
                MaterialStock!inner(materialCode, name)
            `)
            .gte('createdAt', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
            .order('createdAt', { ascending: false });
        
        if (error) throw error;
        
        // Agreguj zużycie per materiał
        const consumption = (data || []).reduce((acc, log) => {
            const key = log.MaterialStock.materialCode;
            if (!acc[key]) {
                acc[key] = {
                    materialCode: log.MaterialStock.materialCode,
                    name: log.MaterialStock.name,
                    issued: 0,
                    received: 0,
                    netChange: 0
                };
            }
            
            if (log.changeType === 'issue') {
                acc[key].issued += log.newQuantity - log.previousQuantity;
            } else if (log.changeType === 'receipt') {
                acc[key].received += log.newQuantity - log.previousQuantity;
            }
            
            acc[key].netChange = acc[key].received - acc[key].issued;
            return acc;
        }, {});
        
        res.json({
            success: true,
            data: Object.values(consumption),
            period: `Ostatnie ${days} dni`
        });
        
    } catch (error) {
        console.error('Błąd generowania raportu zużycia:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd generowania raportu zużycia',
            details: error.message
        });
    }
});

module.exports = router;

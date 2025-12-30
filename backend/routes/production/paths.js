/**
 * Router ścieżek produkcyjnych i mapowań
 */

const express = require('express');
const { requireRole } = require('../../modules/auth');

const router = express.Router();

/**
 * GET /api/production/paths
 * Lista ścieżek produkcyjnych
 */
router.get('/paths', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        // Najpierw sprawdź czy tabela istnieje
        const { data: paths, error } = await supabase
            .from('ProductionPath')
            .select('*')
            .order('name');

        if (error) {
            console.error('[GET /api/production/paths] Error:', error);
            // Jeśli tabela nie istnieje, zwróć pustą listę zamiast błędu
            if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
                console.warn('[GET /api/production/paths] Tabela ProductionPath nie istnieje - zwracam pustą listę');
                return res.json({
                    status: 'success',
                    data: [],
                    warning: 'Tabela ProductionPath nie została jeszcze utworzona'
                });
            }
            return res.status(500).json({ 
                status: 'error', 
                message: 'Błąd pobierania ścieżek produkcyjnych',
                details: error.message
            });
        }

        // Filtruj tylko aktywne (jeśli kolumna isActive istnieje)
        const activePaths = (paths || []).filter(p => p.isActive !== false);

        res.json({
            status: 'success',
            data: activePaths
        });

    } catch (error) {
        console.error('[GET /api/production/paths] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera',
            details: error.message
        });
    }
});

/**
 * GET /api/production/path-codes
 * Pobiera wszystkie kody ścieżek z aktywnych produktów
 */
router.get('/path-codes', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const tag = '[GET /api/production/path-codes]';
    
    try {
        // Pobierz wszystkie aktywne produkty z productionPath
        const { data: products, error } = await supabase
            .from('Product')
            .select('"productionPath"')
            .eq('isActive', true)
            .not('productionPath', 'is', null)
            .limit(1000);

        if (error) {
            console.error(`${tag} Błąd pobierania produktów:`, error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania produktów' });
        }

        // Funkcja do parsowania wyrażenia ścieżki produktu
        function parsePathExpression(expr) {
            if (!expr) return [];
            // Traktujemy %, $, & jako separatory
            const normalized = expr.replace(/[%$&]/g, '|');
            return normalized.split('|').map(s => s.trim()).filter(Boolean);
        }

        const pathCodesSet = new Set();
        const pathDetails = [];

        for (const product of products || []) {
            if (!product.productionPath) continue;
            const codes = parsePathExpression(product.productionPath);
            for (const code of codes) {
                if (!pathCodesSet.has(code)) {
                    pathCodesSet.add(code);
                    pathDetails.push({
                        code,
                        baseCode: code.split('.')[0], // np. 5.1 -> 5
                        examplePath: product.productionPath
                    });
                }
            }
        }

        // Sortuj: najpierw numeryczne, potem alfabetycznie
        pathDetails.sort((a, b) => {
            const aNum = parseFloat(a.code);
            const bNum = parseFloat(b.code);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.code.localeCompare(b.code);
        });

        res.json({
            status: 'success',
            data: pathDetails,
            count: pathDetails.length
        });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * GET /api/production/workcenters/:workCenterId/path-mappings
 * Pobiera mapowania ścieżek dla gniazda produkcyjnego
 */
router.get('/workcenters/:workCenterId/path-mappings', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const tag = '[GET /api/production/workcenters/:workCenterId/path-mappings]';
    const workCenterId = parseInt(req.params.workCenterId);
    
    try {
        const { data: mappings, error } = await supabase
            .from('WorkCenterPathMapping')
            .select('*')
            .eq('workcenterid', workCenterId)
            .eq('isactive', true)
            .order('pathcode');

        if (error) {
            console.error(`${tag} Błąd pobierania mapowań:`, error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania mapowań' });
        }

        console.log(`${tag} WorkCenter ${workCenterId}: ${mappings?.length || 0} mapowań`);

        return res.json({
            status: 'success',
            data: {
                workCenterId,
                mappings: mappings || []
            }
        });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * POST /api/production/workcenters/:workCenterId/path-mappings
 * Dodaje mapowanie ścieżki do gniazda
 */
router.post('/workcenters/:workCenterId/path-mappings', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const tag = '[POST /api/production/workcenters/:workCenterId/path-mappings]';
    const workCenterId = parseInt(req.params.workCenterId);
    const { pathCode } = req.body;
    
    if (!pathCode || typeof pathCode !== 'string') {
        return res.status(400).json({ status: 'error', message: 'pathCode jest wymagany' });
    }

    try {
        const { data: mapping, error } = await supabase
            .from('WorkCenterPathMapping')
            .insert({
                id: require('crypto').randomUUID(),
                workcenterid: workCenterId,
                pathcode: pathCode.trim(),
                isactive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error(`${tag} Błąd tworzenia mapowania:`, error);
            return res.status(500).json({ status: 'error', message: 'Błąd tworzenia mapowania' });
        }

        console.log(`${tag} Dodano mapowanie: WorkCenter ${workCenterId} -> ${pathCode}`);

        return res.json({
            status: 'success',
            message: 'Mapowanie ścieżki dodane',
            data: mapping
        });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * DELETE /api/production/workcenters/:workCenterId/path-mappings/:pathCode
 * Usuwa mapowanie ścieżki z gniazda
 */
router.delete('/workcenters/:workCenterId/path-mappings/:pathCode', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const tag = '[DELETE /api/production/workcenters/:workCenterId/path-mappings/:pathCode]';
    const workCenterId = parseInt(req.params.workCenterId);
    const pathCode = req.params.pathCode;
    
    try {
        const { error } = await supabase
            .from('WorkCenterPathMapping')
            .delete()
            .eq('workcenterid', workCenterId)
            .eq('pathcode', pathCode);

        if (error) {
            console.error(`${tag} Błąd usuwania mapowania:`, error);
            return res.status(500).json({ status: 'error', message: 'Błąd usuwania mapowania' });
        }

        console.log(`${tag} Usunięto mapowanie: WorkCenter ${workCenterId} -> ${pathCode}`);

        return res.json({
            status: 'success',
            message: 'Mapowanie ścieżki usunięte'
        });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

module.exports = router;

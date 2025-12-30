/**
 * Moduł zarządzania operatorami - umiejętności, przypisania, przenoszenia
 * Endpointy: GET/POST /api/production/operators
 */

const express = require('express');
const router = express.Router();
const { requireRole } = require('../../modules/auth');

// ============================================
// GET /api/production/operators/skills
// Pobierz umiejętności operatorów
// ============================================
router.get('/skills', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { operatorId, workCenterType } = req.query;
        
        let query = supabase
            .from('OperatorSkill')
            .select(`
                *,
                operator:User!operatorId(id, name, email, role),
                certifiedByUser:User!certifiedBy(id, name)
            `);
        
        if (operatorId) {
            query = query.eq('operatorId', operatorId);
        }
        
        if (workCenterType) {
            query = query.eq('workCenterType', workCenterType);
        }
        
        const { data, error } = await query.order('operatorId').order('workCenterType');
        
        if (error) throw error;
        
        // Grupuj po operatorach dla łatwiejszego wyświetlania
        const grouped = (data || []).reduce((acc, skill) => {
            const operatorId = skill.operatorId;
            if (!acc[operatorId]) {
                acc[operatorId] = {
                    operatorId,
                    operatorName: skill.operator?.name,
                    operatorEmail: skill.operator?.email,
                    role: skill.operator?.role,
                    skills: []
                };
            }
            acc[operatorId].skills.push({
                workCenterType: skill.workCenterType,
                level: skill.level,
                certifiedAt: skill.certifiedAt,
                certifiedBy: skill.certifiedByUser?.name,
                notes: skill.notes
            });
            return acc;
        }, {});
        
        res.json({
            success: true,
            data: Object.values(grouped),
            count: Object.keys(grouped).length
        });
        
    } catch (error) {
        console.error('Błąd pobierania umiejętności operatorów:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd pobierania umiejętności operatorów',
            details: error.message
        });
    }
});

// ============================================
// POST /api/production/operators/skills
// Dodaj lub zaktualizuj umiejętności operatora
// ============================================
router.post('/skills', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { operatorId, workCenterType, level, notes } = req.body;
    const userId = req.user?.id;
    
    // Walidacja
    if (!operatorId || !workCenterType || !level) {
        return res.status(400).json({
            success: false,
            error: 'Wymagane pola: operatorId, workCenterType, level'
        });
    }
    
    if (level < 1 || level > 5) {
        return res.status(400).json({
            success: false,
            error: 'Poziom umiejętności musi być między 1 a 5'
        });
    }
    
    try {
        // Sprawdź czy operator istnieje
        const { data: operator, error: operatorError } = await supabase
            .from('User')
            .select('id, name')
            .eq('id', operatorId)
            .single();
        
        if (operatorError || !operator) {
            return res.status(404).json({
                success: false,
                error: 'Operator nie znaleziony'
            });
        }
        
        // Upsert umiejętności
        const { data, error } = await supabase
            .from('OperatorSkill')
            .upsert({
                operatorId,
                workCenterType,
                level,
                notes: notes || null,
                certifiedAt: new Date().toISOString(),
                certifiedBy: userId
            })
            .select(`
                *,
                operator:User!operatorId(name),
                certifiedByUser:User!certifiedBy(name)
            `)
            .single();
        
        if (error) throw error;
        
        res.json({
            success: true,
            data,
            message: `Umiejętność ${workCenterType} dla operatora ${operator.name} została zaktualizowana`
        });
        
    } catch (error) {
        console.error('Błąd zapisu umiejętności:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd zapisu umiejętności',
            details: error.message
        });
    }
});

// ============================================
// GET /api/production/operators/assignments
// Pobierz aktualne przypisania operatorów
// ============================================
router.get('/assignments', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { roomId, active = 'true' } = req.query;
        
        // Użyj widoku CurrentOperatorAssignments
        let query = supabase
            .from('CurrentOperatorAssignments')
            .select('*');
        
        if (roomId) {
            query = query.eq('roomId', roomId);
        }
        
        const { data, error } = await query.order('roomName').order('operatorName');
        
        if (error) throw error;
        
        res.json({
            success: true,
            data: data || [],
            count: data?.length || 0
        });
        
    } catch (error) {
        console.error('Błąd pobierania przypisań operatorów:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd pobierania przypisań operatorów',
            details: error.message
        });
    }
});

// ============================================
// POST /api/production/operators/transfer
// Przenieś operatora do innego pokoju/stanowiska
// ============================================
router.post('/transfer', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { operatorId, targetRoomId, targetWorkStationId, reason } = req.body;
    const userId = req.user?.id;
    
    // Walidacja
    if (!operatorId || !targetRoomId) {
        return res.status(400).json({
            success: false,
            error: 'Wymagane pola: operatorId, targetRoomId'
        });
    }
    
    try {
        // Sprawdź czy operator i pokój istnieją
        const [{ data: operator }, { data: room }] = await Promise.all([
            supabase.from('User').select('id, name').eq('id', operatorId).single(),
            supabase.from('ProductionRoom').select('id, name, code').eq('id', targetRoomId).single()
        ]);
        
        if (!operator) {
            return res.status(404).json({
                success: false,
                error: 'Operator nie znaleziony'
            });
        }
        
        if (!room) {
            return res.status(404).json({
                success: false,
                error: 'Pokój nie znaleziony'
            });
        }
        
        // Sprawdź czy operator ma umiejętności dla gniazd w docelowym pokoju
        const { data: roomWorkCenters } = await supabase
            .from('WorkCenter')
            .select('type')
            .eq('roomId', targetRoomId);
        
        const roomTypes = [...new Set(roomWorkCenters?.map(wc => wc.type) || [])];
        
        if (roomTypes.length > 0) {
            const { data: skills } = await supabase
                .from('OperatorSkill')
                .select('workCenterType, level')
                .eq('operatorId', operatorId)
                .in('workCenterType', roomTypes);
            
            if (!skills || skills.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: `Operator nie ma wymaganych umiejętności dla pokoju ${room.name}. Wymagane: ${roomTypes.join(', ')}`,
                    requiredSkills: roomTypes
                });
            }
        }
        
        // Zakończ poprzednie przypisanie i utwórz nowe w transakcji
        try {
            // Rozpocznij transakcję (Supabase RPC)
            const { data: assignment, error: assignError } = await supabase
                .rpc('transfer_operator', {
                    p_operator_id: operatorId,
                    p_target_room_id: targetRoomId,
                    p_target_workstation_id: targetWorkStationId || null,
                    p_assigned_by: userId,
                    p_reason: reason || null
                });
            
            if (assignError) throw assignError;
            
            // Pobierz szczegóły przypisania
            const { data: assignmentDetails } = await supabase
                .from('OperatorAssignment')
                .select(`
                    *,
                    operator:User!operatorId(name),
                    room:ProductionRoom!roomId(name, code),
                    workStation:WorkStation!workStationId(name),
                    assignedByUser:User!assignedBy(name)
                `)
                .eq('id', assignment)
                .single();
            
            // Emituj zdarzenie SSE
            const sseModule = req.app.locals.sse;
            if (sseModule) {
                sseModule.broadcastEvent({
                    type: 'operator_transferred',
                    data: {
                        operatorId,
                        operatorName: operator.name,
                        fromRoomId: assignmentDetails?.previousRoomId || null,
                        toRoomId: targetRoomId,
                        toRoomName: room.name,
                        toRoomCode: room.code,
                        workStationId: targetWorkStationId || null,
                        reason,
                        transferredBy: userId,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            
            res.json({
                success: true,
                data: assignmentDetails || assignment,
                message: `Operator ${operator.name} został przeniesiony do pokoju ${room.name}`
            });
            
        } catch (error) {
            console.error('Błąd przenoszenia operatora:', error);
            
            // Fallback: wykonaj bez transakcji jeśli RPC nie istnieje
            if (error.message?.includes('function transfer_operator') || error.code === 'PGRST202') {
                try {
                    // Zakończ poprzednie przypisanie
                    await supabase
                        .from('OperatorAssignment')
                        .update({ toTime: new Date().toISOString() })
                        .eq('operatorId', operatorId)
                        .is('toTime', null);
                    
                    // Utwórz nowe przypisanie
                    const { data: assignment, error: assignError } = await supabase
                        .from('OperatorAssignment')
                        .insert({
                            operatorId,
                            roomId: targetRoomId,
                            workStationId: targetWorkStationId || null,
                            fromTime: new Date().toISOString(),
                            assignedBy: userId,
                            reason: reason || null
                        })
                        .select(`
                            *,
                            operator:User!operatorId(name),
                            room:ProductionRoom!roomId(name, code),
                            workStation:WorkStation!workStationId(name),
                            assignedByUser:User!assignedBy(name)
                        `)
                        .single();
                    
                    if (assignError) throw assignError;
                    
                    // Emituj SSE
                    const sseModule = req.app.locals.sse;
                    if (sseModule) {
                        sseModule.broadcastEvent({
                            type: 'operator_transferred',
                            data: {
                                operatorId,
                                operatorName: operator.name,
                                fromRoomId: null,
                                toRoomId: targetRoomId,
                                toRoomName: room.name,
                                toRoomCode: room.code,
                                workStationId: targetWorkStationId || null,
                                reason,
                                transferredBy: userId,
                                timestamp: new Date().toISOString()
                            }
                        });
                    }
                    
                    res.json({
                        success: true,
                        data: assignment,
                        message: `Operator ${operator.name} został przeniesiony do pokoju ${room.name}`
                    });
                    
                } catch (fallbackError) {
                    console.error('Błąd fallback transferu operatora:', fallbackError);
                    res.status(500).json({
                        success: false,
                        error: 'Błąd przenoszenia operatora',
                        details: fallbackError.message
                    });
                }
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Błąd przenoszenia operatora',
                    details: error.message
                });
            }
        }
        
    } catch (error) {
        console.error('Błąd przenoszenia operatora:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd przenoszenia operatora',
            details: error.message
        });
    }
});

// ============================================
// GET /api/production/operators/suggestions
// Sugestie przenoszenia operatorów w celu usunięcia zatorów
// ============================================
router.get('/suggestions', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        // Oblicz pilność dla każdego pokoju (kolejka × średni czas oczekiwania)
        const { data: roomUrgency, error: urgencyError } = await supabase
            .from('ProductionRoom')
            .select(`
                id,
                name,
                code,
                WorkCenter!inner(
                    id,
                    type,
                    ProductionOperation!inner(
                        id,
                        status,
                        createdAt,
                        estimatedDuration
                    )
                )
            `)
            .eq('isActive', true);
        
        if (urgencyError) throw urgencyError;
        
        // Agreguj dane per pokój
        const roomStats = {};
        roomUrgency.forEach(room => {
            if (!roomStats[room.id]) {
                roomStats[room.id] = {
                    roomId: room.id,
                    roomName: room.name,
                    roomCode: room.code,
                    queueSize: 0,
                    totalWaitTime: 0,
                    workCenterTypes: new Set()
                };
            }
            
            room.WorkCenter.forEach(wc => {
                wc.ProductionOperation.forEach(op => {
                    if (['pending', 'active', 'paused'].includes(op.status)) {
                        roomStats[room.id].queueSize++;
                        const waitMinutes = (Date.now() - new Date(op.createdAt)) / (1000 * 60);
                        roomStats[room.id].totalWaitTime += waitMinutes;
                    }
                });
                roomStats[room.id].workCenterTypes.add(wc.type);
            });
        });
        
        // Konwertuj na tablicę i oblicz pilność
        const roomsWithUrgency = Object.values(roomStats).map(room => ({
            ...room,
            workCenterTypes: Array.from(room.workCenterTypes),
            avgWaitTime: room.queueSize > 0 ? room.totalWaitTime / room.queueSize : 0,
            urgencyScore: room.queueSize * (room.queueSize > 0 ? room.totalWaitTime / room.queueSize : 0)
        })).filter(room => room.queueSize > 2).sort((a, b) => b.urgencyScore - a.urgencyScore);
        
        // Pobierz dostępnych operatorów
        const { data: availableOperators, error: opError } = await supabase
            .from('CurrentOperatorAssignments')
            .select(`
                operatorId,
                operatorName,
                roomId,
                roomName,
                OperatorSkill!inner(workCenterType, level)
            `);
        
        if (opError) throw opError;
        
        // Generuj sugestie
        const suggestions = [];
        roomsWithUrgency.forEach(targetRoom => {
            targetRoom.workCenterTypes.forEach(requiredType => {
                // Znajdź operatorów z odpowiednimi umiejętnościami w pokojach z mniejszą kolejką
                const suitableOperators = availableOperators.filter(op => {
                    const hasSkill = op.OperatorSkill.some(skill => skill.workCenterType === requiredType);
                    const currentRoom = roomStats[op.roomId];
                    const currentRoomUrgency = currentRoom ? currentRoom.urgencyScore : 0;
                    
                    return hasSkill && currentRoomUrgency < targetRoom.urgencyScore;
                });
                
                // Wybierz najlepszych (najwyższy poziom umiejętności)
                const bestOperators = suitableOperators
                    .sort((a, b) => {
                        const aMaxLevel = Math.max(...a.OperatorSkill.map(s => s.level));
                        const bMaxLevel = Math.max(...b.OperatorSkill.map(s => s.level));
                        return bMaxLevel - aMaxLevel;
                    })
                    .slice(0, 2); // Max 2 sugestie na pokój/typ
                
                bestOperators.forEach(op => {
                    suggestions.push({
                        operatorId: op.operatorId,
                        operatorName: op.operatorName,
                        fromRoomId: op.roomId,
                        fromRoomName: op.roomName,
                        toRoomId: targetRoom.roomId,
                        toRoomName: targetRoom.roomName,
                        toRoomCode: targetRoom.roomCode,
                        workCenterType: requiredType,
                        skillLevel: Math.max(...op.OperatorSkill.map(s => s.level)),
                        urgencyScore: targetRoom.urgencyScore,
                        queueSize: targetRoom.queueSize,
                        avgWaitTime: Math.round(targetRoom.avgWaitTime),
                        impact: `Odblokuje ${targetRoom.queueSize} zadań`,
                        estimatedTimeSave: Math.round(targetRoom.avgWaitTime * targetRoom.queueSize / 60 * 10) / 10 // w godzinach
                    });
                });
            });
        });
        
        // Sortuj po pilności i ogranicz do 10 sugestii
        const topSuggestions = suggestions
            .sort((a, b) => b.urgencyScore - a.urgencyScore)
            .slice(0, 10);
        
        res.json({
            success: true,
            data: topSuggestions,
            count: topSuggestions.length,
            totalRoomsAnalyzed: Object.keys(roomStats).length,
            roomsWithBottlenecks: roomsWithUrgency.length
        });
        
    } catch (error) {
        console.error('Błąd generowania sugestii:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd generowania sugestii',
            details: error.message
        });
    }
});

module.exports = router;

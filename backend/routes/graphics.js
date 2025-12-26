/**
 * Router dla endpointów graficznych
 * Zarządzanie zadaniami graficznymi
 */

const express = require('express');
const { requireRole } = require('../modules/auth');
const { normalizeProjectViewUrl } = require('../services/productionService');

const router = express.Router();

// Helper function to check if all graphic tasks for an order are ready
async function checkAndCompleteOrderGraphics(supabase, orderId) {
    const { data: tasks } = await supabase
        .from('GraphicTask')
        .select('status')
        .eq('orderId', orderId);
        
    if (!tasks || tasks.length === 0) return;
    
    const allReady = tasks.every(t => ['ready_for_production', 'archived'].includes(t.status));
    
    if (allReady) {
        await supabase
            .from('Order')
            .update({ projectsReady: true })
            .eq('id', orderId);
        console.log(`Zamówienie ${orderId}: projectsReady = true`);
    }
}

// Lista zadań graficznych
router.get('/tasks', requireRole(['GRAPHICS', 'GRAPHIC_DESIGNER', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    console.log('[GET /api/graphics/tasks] Request received');
    
    const { status, orderId, assignedTo, mine } = req.query;
    const { role, id: userId } = req.user;
    
    console.log('[GET /api/graphics/tasks] Query params:', { status, orderId, assignedTo, mine });
    console.log('[GET /api/graphics/tasks] User:', { role, userId });

    try {
        let query = supabase
            .from('GraphicTask')
            .select(`
                *,
                Order (
                    orderNumber,
                    orderType:ordertype,
                    Customer:customerId (
                        name
                    )
                ),
                OrderItem (
                    productName:projectName,
                    quantity,
                    productionNotes,
                    projectviewurl,
                    Product:Product (
                        name,
                        identifier,
                        index
                    )
                ),
                Assignee:User!assignedTo (
                    name
                )
            `)
            .order('priority', { ascending: true })
            .order('dueDate', { ascending: true });

        if (status) query = query.eq('status', status);
        if (orderId) query = query.eq('orderId', orderId);
        if (assignedTo) query = query.eq('assignedTo', assignedTo);
        
        if (mine === 'true') {
            query = query.eq('assignedTo', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Błąd pobierania zadań graficznych:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać zadań', details: error.message });
        }

        const normalized = (data || []).map(task => {
            if (!task || !task.OrderItem) return task;
            return {
                ...task,
                OrderItem: {
                    ...task.OrderItem,
                    projectviewurl: normalizeProjectViewUrl(task.OrderItem.projectviewurl)
                }
            };
        });

        return res.json({ status: 'success', data: normalized });
    } catch (err) {
        console.error('Wyjątek w GET /api/graphics/tasks:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Szczegóły zadania
router.get('/tasks/:id', requireRole(['GRAPHICS', 'GRAPHIC_DESIGNER', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('GraphicTask')
            .select(`
                *,
                Order (
                    orderNumber,
                    orderType:ordertype,
                    notes,
                    Customer:customerId (
                        name
                    )
                ),
                OrderItem (
                    productName:projectName,
                    quantity,
                    productionNotes,
                    projectviewurl,
                    Product:Product (
                        name,
                        identifier,
                        index
                    )
                ),
                Assignee:User!assignedTo (
                    name,
                    id
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            return res.status(404).json({ status: 'error', message: 'Zadanie nie znalezione', details: error.message });
        }

        if (data && data.OrderItem) {
            data.OrderItem.projectviewurl = normalizeProjectViewUrl(data.OrderItem.projectviewurl);
        }

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w GET /api/graphics/tasks/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Aktualizacja zadania (przypisanie, status, checklista)
router.patch('/tasks/:id', requireRole(['GRAPHICS', 'GRAPHIC_DESIGNER', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { status, assignedTo, checklist, projectNumbers, filesLocation, approvalStatus, approvalRequired } = req.body;
    const { role, id: userId } = req.user;

    try {
        const { data: task, error: fetchError } = await supabase
            .from('GraphicTask')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !task) {
            return res.status(404).json({ status: 'error', message: 'Zadanie nie znalezione' });
        }

        const updates = { updatedAt: new Date().toISOString() };

        if (role === 'GRAPHICS' || role === 'GRAPHIC_DESIGNER') {
            if (assignedTo !== undefined) updates.assignedTo = assignedTo;
            if (status !== undefined) {
                 if (['todo', 'in_progress', 'waiting_approval', 'ready_for_production'].includes(status)) {
                     updates.status = status;
                 }
            }
            if (checklist !== undefined) updates.checklist = checklist;
            if (projectNumbers !== undefined) updates.projectNumbers = projectNumbers;
            if (filesLocation !== undefined) updates.filesLocation = filesLocation;
            if (approvalRequired !== undefined) updates.approvalRequired = approvalRequired;
            
            if (status === 'waiting_approval') {
                updates.approvalStatus = 'pending';
            }
        } else if (role === 'SALES_DEPT' || role === 'SALES_REP') {
            if (approvalStatus !== undefined) {
                updates.approvalStatus = approvalStatus;
                if (approvalStatus === 'approved') {
                    updates.status = 'ready_for_production';
                } else if (approvalStatus === 'rejected') {
                    updates.status = 'rejected';
                }
            }
        } else if (role === 'PRODUCTION_MANAGER' || role === 'ADMIN') {
            Object.assign(updates, req.body);
            delete updates.id;
        }

        const { data, error } = await supabase
            .from('GraphicTask')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować zadania', details: error.message });
        }
        
        if (data.status === 'ready_for_production') {
            await checkAndCompleteOrderGraphics(supabase, data.orderId);
        }

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/graphics/tasks/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Druk zadania graficznego
router.get('/tasks/:id/print', requireRole(['ADMIN', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'GRAPHICS', 'GRAPHIC_DESIGNER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: userId } = req.user;
    
    try {
        const taskId = parseInt(req.params.id, 10);
        if (isNaN(taskId)) {
            return res.status(400).json({ status: 'error', message: 'Nieprawidłowe ID zadania' });
        }

        // Pobierz dane zadania graficznego
        const { data: task, error: taskError } = await supabase
            .from('GraphicTask')
            .select(`
                *,
                Order(orderNumber, Customer(name)),
                OrderItem(Product(name, identifier)),
                AssignedUser:User!GraphicTask_assignedTo_fkey(name)
            `)
            .eq('id', taskId)
            .single();

        if (taskError || !task) {
            return res.status(404).json({ status: 'error', message: 'Nie znaleziono zadania graficznego' });
        }

        // Przygotuj dane do PDF
        const pdfData = {
            id: task.id,
            orderNumber: task.Order?.orderNumber || '-',
            customerName: task.Order?.Customer?.name || '-',
            productName: task.OrderItem?.Product?.name || task.OrderItem?.Product?.identifier || '-',
            status: task.status,
            dueDate: task.dueDate,
            assignedToName: task.AssignedUser?.name || '-',
            galleryContext: task.galleryContext,
            filesLocation: task.filesLocation,
            projectNumbers: task.projectNumbers,
            checklist: task.checklist
        };

        // TODO: Implementuj createGraphicsTaskPDF
        res.status(501).json({ 
            status: 'error', 
            message: 'Generowanie PDF nie jest jeszcze zaimplementowane',
            data: pdfData 
        });

    } catch (error) {
        console.error('[GET /api/graphics/tasks/:id/print] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd generowania PDF' });
    }
});

module.exports = router;

const { PDFDocument } = require('pdf-lib');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createProductionWorkOrderPDF } = require('./pdfGenerator');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

/**
 * Generuje połączony PDF ze wszystkimi zleceniami produkcyjnymi dla zamówienia
 * Używa istniejącej funkcji createProductionWorkOrderPDF dla zachowania formatowania
 */
async function createCombinedProductionWorkOrdersPDF(orderId) {
    // Pobierz zamówienie, aby dostać uwagi
    const { data: order, error: orderError } = await supabase
        .from('Order')
        .select('orderNumber, notes, Customer(name)')
        .eq('id', orderId)
        .single();
    
    if (orderError || !order) {
        throw new Error(`Błąd pobierania zamówienia: ${orderError?.message || 'Nie znaleziono'}`);
    }
    
    // Pobierz wszystkie ProductionWorkOrder dla zamówienia
    const { data: workOrders, error } = await supabase
        .from('ProductionWorkOrder')
        .select(`
            *,
            ProductionOrder(
                id, ordernumber, quantity, productionnotes, status,
                product:Product(name, identifier, code),
                sourceOrderItem:OrderItem(source, locationName, projectviewurl, selectedProjects, projectQuantities)
            )
        `)
        .eq('sourceOrderId', orderId)
        .order('workOrderNumber');
    
    if (error) {
        throw new Error(`Błąd pobierania zleceń: ${error.message}`);
    }
    
    if (!workOrders || workOrders.length === 0) {
        throw new Error('Brak zleceń produkcyjnych dla tego zamówienia');
    }
    
    console.log(`[createCombinedProductionWorkOrdersPDF] Łączenie ${workOrders.length} zleceń produkcyjnych`);
    
    // Wygeneruj PDF dla każdego zlecenia używając istniejącej funkcji
    const pdfBuffers = [];
    for (const workOrder of workOrders) {
        console.log(`[createCombinedProductionWorkOrdersPDF] Generowanie PDF dla: ${workOrder.workOrderNumber}`);
        
        // Przygotuj dane w formacie oczekiwanym przez createProductionWorkOrderPDF
        const items = [];
        for (const po of (workOrder.ProductionOrder || [])) {
            let locationName = '-';
            let source = 'MIEJSCOWOSCI';
            let selectedProjects = '-';
            let projectQuantities = '-';
            let totalQuantity = po.quantity || 0;
            let quantitySource = 'total';
            
            if (po.sourceOrderItem) {
                locationName = po.sourceOrderItem.locationName || '-';
                source = po.sourceOrderItem.source || 'MIEJSCOWOSCI';
                selectedProjects = po.sourceOrderItem.selectedProjects || '-';
                projectQuantities = po.sourceOrderItem.projectQuantities || '-';
                totalQuantity = po.sourceOrderItem.totalQuantity ?? po.quantity ?? 0;
                quantitySource = po.sourceOrderItem.quantitySource || 'total';
            }

            items.push({
                productName: po.product?.name || po.product?.identifier || '-',
                identifier: po.product?.identifier || '-',
                locationName,
                source,
                quantity: po.quantity || 0,
                selectedProjects,
                projectQuantities,
                totalQuantity,
                quantitySource,
                productionNotes: po.productionnotes || ''
            });
        }
        
        // Przygotuj dane do PDF
        const pdfData = {
            workOrderNumber: workOrder.workOrderNumber || `PW-${workOrder.id}`,
            orderNumber: order.orderNumber || 'ZLECENIA PRODUKCYJNE',
            customerName: order.Customer?.name || '-',
            roomName: workOrder.roomName || 'Pokój produkcyjny',
            status: workOrder.status,
            priority: workOrder.priority || 3,
            plannedDate: workOrder.plannedDate,
            notes: order.notes, // Użyj uwag z zamówienia, nie z zlecenia
            items
        };
        
        const pdfBuffer = await createProductionWorkOrderPDF(pdfData);
        pdfBuffers.push(pdfBuffer);
    }
    
    // Połącz wszystkie PDF-y
    const mergedPdf = await PDFDocument.create();
    
    for (const pdfBuffer of pdfBuffers) {
        const pdf = await PDFDocument.load(pdfBuffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
    }
    
    // Zapisz połączony PDF
    const mergedPdfBytes = await mergedPdf.save();
    
    return Buffer.from(mergedPdfBytes);
}

module.exports = { createCombinedProductionWorkOrdersPDF };

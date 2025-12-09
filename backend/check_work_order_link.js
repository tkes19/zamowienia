const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkWorkOrderLink() {
    console.log('=== Sprawdzanie połączenia ProductionOrder z ProductionWorkOrder ===');
    
    // Sprawdź strukturę ProductionOrder
    console.log('\n--- Struktura ProductionOrder ---');
    const { data: prodOrderColumns, error: columnsError } = await supabase
        .from('ProductionOrder')
        .select('*')
        .limit(1);
    
    if (columnsError) {
        console.error('Błąd pobierania struktury ProductionOrder:', columnsError);
    } else if (prodOrderColumns && prodOrderColumns.length > 0) {
        console.log('Kolumny ProductionOrder:', Object.keys(prodOrderColumns[0]));
    }
    
    // Sprawdź strukturę ProductionWorkOrder
    console.log('\n--- Struktura ProductionWorkOrder ---');
    const { data: workOrderColumns, error: workError } = await supabase
        .from('ProductionWorkOrder')
        .select('*')
        .limit(1);
    
    if (workError) {
        console.error('Błąd pobierania struktury ProductionWorkOrder:', workError);
    } else if (workOrderColumns && workOrderColumns.length > 0) {
        console.log('Kolumny ProductionWorkOrder:', Object.keys(workOrderColumns[0]));
    }
    
    // Sprawdź ostatnie ProductionOrder i ich workOrderId
    console.log('\n--- Ostatnie ProductionOrder ---');
    const { data: recentOrders, error: recentError } = await supabase
        .from('ProductionOrder')
        .select('id, workOrderId, sourceorderid, productid, status')
        .order('id', { ascending: false })
        .limit(5);
    
    if (recentError) {
        console.error('Błąd pobierania ostatnich ProductionOrder:', recentError);
    } else {
        console.log('Ostatnie ProductionOrder:');
        recentOrders.forEach(order => {
            console.log(`- ID: ${order.id}, workOrderId: ${order.workOrderId}, sourceorderid: ${order.sourceorderid}, status: ${order.status}`);
        });
    }
    
    // Sprawdź ostatnie ProductionWorkOrder
    console.log('\n--- Ostatnie ProductionWorkOrder ---');
    const { data: recentWorkOrders, error: recentWorkError } = await supabase
        .from('ProductionWorkOrder')
        .select('id, sourceOrderId, workOrderNumber, status')
        .order('id', { ascending: false })
        .limit(5);
    
    if (recentWorkError) {
        console.error('Błąd pobierania ostatnich ProductionWorkOrder:', recentWorkError);
    } else {
        console.log('Ostatnie ProductionWorkOrder:');
        recentWorkOrders.forEach(workOrder => {
            console.log(`- ID: ${workOrder.id}, sourceOrderId: ${workOrder.sourceOrderId}, numer: ${workOrder.workOrderNumber}, status: ${workOrder.status}`);
        });
    }
    
    // Test zapytania z PDF endpoint
    console.log('\n--- Test zapytania PDF endpoint ---');
    const workOrderId = 3; // z poprzedniego testu
    const { data: pdfOrders, error: pdfError } = await supabase
        .from('ProductionOrder')
        .select(`
            id, quantity, productionNotes, status,
            sourceOrderItemId,
            Product(name, identifier)
        `)
        .eq('workOrderId', workOrderId);
    
    if (pdfError) {
        console.error('Błąd zapytania PDF:', pdfError);
    } else {
        console.log(`Znaleziono ${pdfOrders.length} ProductionOrder dla workOrderId=${workOrderId}:`);
        pdfOrders.forEach(order => {
            console.log(`- ID: ${order.id}, produkt: ${order.Product?.name || 'BRAK'}`);
        });
    }
}

checkWorkOrderLink()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Błąd:', err);
        process.exit(1);
    });

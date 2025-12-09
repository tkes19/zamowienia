const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function debugGrouping() {
    console.log('=== Debugowanie grupowania pozycji ===');
    
    // Sprawdź ile ProductionOrder jest powiązanych z każdym ProductionWorkOrder
    const { data: workOrders, error: woError } = await supabase
        .from('ProductionWorkOrder')
        .select('id, workOrderNumber, sourceOrderId, roomName')
        .order('id', { ascending: false })
        .limit(10);
    
    if (woError) {
        console.error('Błąd:', woError);
        return;
    }
    
    console.log('\n--- ProductionWorkOrder z liczbą powiązanych ProductionOrder ---');
    for (const wo of workOrders) {
        const { data: prodOrders, error: poError } = await supabase
            .from('ProductionOrder')
            .select('id, productid, quantity, productionpathexpression')
            .eq('workOrderId', wo.id);
        
        console.log(`\nWorkOrder ID: ${wo.id}, numer: ${wo.workOrderNumber}, pokój: ${wo.roomName}`);
        console.log(`  Powiązanych ProductionOrder: ${prodOrders?.length || 0}`);
        
        if (prodOrders && prodOrders.length > 0) {
            for (const po of prodOrders) {
                // Pobierz nazwę produktu
                const { data: product } = await supabase
                    .from('Product')
                    .select('name, code')
                    .eq('id', po.productid)
                    .single();
                
                console.log(`    - ID: ${po.id}, produkt: ${product?.name || 'BRAK'}, ilość: ${po.quantity}, ścieżka: ${po.productionpathexpression}`);
            }
        }
    }
    
    // Sprawdź zamówienie 2025/91/ATU
    console.log('\n\n=== Szczegóły zamówienia 2025/91/ATU ===');
    const { data: order91 } = await supabase
        .from('Order')
        .select('id, orderNumber')
        .eq('orderNumber', '2025/91/ATU')
        .single();
    
    if (order91) {
        console.log(`Zamówienie ID: ${order91.id}`);
        
        // Pobierz pozycje zamówienia
        const { data: items } = await supabase
            .from('OrderItem')
            .select(`
                id, quantity,
                Product(id, name, productionPath)
            `)
            .eq('orderId', order91.id);
        
        console.log(`\nPozycje zamówienia (${items?.length || 0}):`);
        items?.forEach((item, i) => {
            console.log(`  ${i+1}. ${item.Product?.name || 'BRAK'}, ilość: ${item.quantity}, ścieżka: ${item.Product?.productionPath || 'BRAK'}`);
        });
        
        // Pobierz zlecenia produkcyjne dla tego zamówienia
        const { data: prodOrders } = await supabase
            .from('ProductionOrder')
            .select('id, workOrderId, quantity, productionpathexpression')
            .eq('sourceorderid', order91.id);
        
        console.log(`\nZlecenia produkcyjne (${prodOrders?.length || 0}):`);
        prodOrders?.forEach((po, i) => {
            console.log(`  ${i+1}. ID: ${po.id}, workOrderId: ${po.workOrderId}, ilość: ${po.quantity}, ścieżka: ${po.productionpathexpression}`);
        });
    }
}

debugGrouping()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Błąd:', err);
        process.exit(1);
    });

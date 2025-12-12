const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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
    
    // Najpierw znajdź ostatnie zamówienia
    console.log('\n\n=== Ostatnie zamówienia ===');
    const { data: recentOrders } = await supabase
        .from('Order')
        .select('id, orderNumber, "createdAt"')
        .order('createdAt', { ascending: false })
        .limit(10);
    
    if (recentOrders && recentOrders.length > 0) {
        console.log('Ostatnie zamówienia:');
        recentOrders.forEach((order, i) => {
            console.log(`  ${i+1}. ID: ${order.id}, numer: ${order.orderNumber}, data: ${order.createdAt}`);
        });
        
        // Użyj najnowszego zamówienia do dalszych testów
        const testOrder = recentOrders[0];
        console.log(`\n=== Szczegóły zamówienia ${testOrder.orderNumber} ===`);
        
        const { data: order } = await supabase
            .from('Order')
            .select('id, orderNumber')
            .eq('id', testOrder.id)
            .single();
    
        if (order) {
            console.log(`Zamówienie ID: ${order.id}`);
            
            // Pobierz pozycje zamówienia
            const { data: items } = await supabase
                .from('OrderItem')
                .select(`
                    id, quantity,
                    Product(id, name, productionPath)
                `)
                .eq('orderId', order.id);
            
            console.log(`\nPozycje zamówienia (${items?.length || 0}):`);
            items?.forEach((item, i) => {
                console.log(`  ${i+1}. ${item.Product?.name || 'BRAK'}, ilość: ${item.quantity}, ścieżka: ${item.Product?.productionPath || 'BRAK'}`);
            });
            
            // Pobierz zlecenia produkcyjne dla tego zamówienia
            const { data: prodOrders } = await supabase
                .from('ProductionOrder')
                .select('id, workOrderId, quantity, productionpathexpression')
                .eq('sourceorderid', order.id);
            
            console.log(`\nZlecenia produkcyjne (${prodOrders?.length || 0}):`);
            prodOrders?.forEach((po, i) => {
                console.log(`  ${i+1}. ID: ${po.id}, workOrderId: ${po.workOrderId}, ilość: ${po.quantity}, ścieżka: ${po.productionpathexpression}`);
            });
            
            // Pobierz ProductionWorkOrder dla tego zamówienia
            const { data: workOrdersForOrder } = await supabase
                .from('ProductionWorkOrder')
                .select('id, workOrderNumber, roomName, status')
                .eq('sourceOrderId', order.id)
                .order('workOrderNumber');
            
            console.log(`\nProductionWorkOrder dla zamówienia (${workOrdersForOrder?.length || 0}):`);
            workOrdersForOrder?.forEach((wo, i) => {
                console.log(`  ${i+1}. ID: ${wo.id}, numer: ${wo.workOrderNumber}, pokój: ${wo.roomName}, status: ${wo.status}`);
            });
        }
    }
}

debugGrouping()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Błąd:', err);
        process.exit(1);
    });

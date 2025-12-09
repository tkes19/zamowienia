const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkProducts() {
    console.log('=== Sprawdzanie produktów i ich ścieżek ===');
    
    // Sprawdź produkty używane w zamówieniu 2025/92/ATU
    const { data: order } = await supabase
        .from('Order')
        .select('id, orderNumber')
        .eq('orderNumber', '2025/92/ATU')
        .single();
    
    if (!order) {
        console.log('Nie znaleziono zamówienia 2025/92/ATU');
        return;
    }
    
    console.log(`Zamówienie: ${order.orderNumber} (ID: ${order.id})`);
    
    // Pobierz pozycje zamówienia z produktami
    const { data: items, error: itemsError } = await supabase
        .from('OrderItem')
        .select(`
            id, quantity, productId,
            Product(id, name, code, productionPath)
        `)
        .eq('orderId', order.id);
    
    if (itemsError) {
        console.error('Błąd pobierania pozycji:', itemsError);
        return;
    }
    
    console.log(`\nPozycje zamówienia (${items.length}):`);
    items.forEach((item, i) => {
        console.log(`\n${i+1}. OrderItem ID: ${item.id}`);
        console.log(`   Product ID: ${item.productId}`);
        console.log(`   Product name: ${item.Product?.name || 'BRAK'}`);
        console.log(`   Product code: ${item.Product?.code || 'BRAK'}`);
        console.log(`   productionPath: "${item.Product?.productionPath || 'BRAK'}"`);
        console.log(`   quantity: ${item.quantity}`);
    });
    
    // Sprawdź ProductionOrder dla tego zamówienia
    console.log('\n\n=== ProductionOrder dla tego zamówienia ===');
    const { data: prodOrders } = await supabase
        .from('ProductionOrder')
        .select('id, workOrderId, sourceorderitemid, productid, quantity, productionpathexpression')
        .eq('sourceorderid', order.id);
    
    console.log(`Znaleziono ${prodOrders?.length || 0} ProductionOrder:`);
    prodOrders?.forEach((po, i) => {
        console.log(`\n${i+1}. ProductionOrder ID: ${po.id}`);
        console.log(`   workOrderId: ${po.workOrderId}`);
        console.log(`   sourceorderitemid: ${po.sourceorderitemid}`);
        console.log(`   productid: ${po.productid}`);
        console.log(`   quantity: ${po.quantity}`);
        console.log(`   productionpathexpression: ${po.productionpathexpression}`);
    });
    
    // Sprawdź które OrderItem NIE mają ProductionOrder
    console.log('\n\n=== OrderItem bez ProductionOrder ===');
    const prodOrderItemIds = new Set(prodOrders?.map(po => po.sourceorderitemid) || []);
    const missingItems = items.filter(item => !prodOrderItemIds.has(item.id));
    
    if (missingItems.length === 0) {
        console.log('Wszystkie pozycje mają ProductionOrder');
    } else {
        console.log(`Brakuje ProductionOrder dla ${missingItems.length} pozycji:`);
        missingItems.forEach((item, i) => {
            console.log(`\n${i+1}. OrderItem ID: ${item.id}`);
            console.log(`   Product: ${item.Product?.name || 'BRAK'}`);
            console.log(`   productionPath: "${item.Product?.productionPath || 'BRAK'}"`);
        });
    }
}

checkProducts()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Błąd:', err);
        process.exit(1);
    });

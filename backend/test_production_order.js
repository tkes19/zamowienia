const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testProductionOrderCreation() {
    console.log('=== Test tworzenia zleceń produkcyjnych ===');
    
    // Pobierz ostatnie zamówienie APPROVED
    const { data: orders, error: ordersError } = await supabase
        .from('Order')
        .select('*')
        .eq('status', 'APPROVED')
        .order('createdAt', { ascending: false })
        .limit(3);
    
    if (ordersError) {
        console.error('Błąd pobierania zamówień:', ordersError);
        return;
    }
    
    if (!orders || orders.length === 0) {
        console.log('Brak zamówień APPROVED do testowania');
        return;
    }
    
    const order = orders[0];
    console.log(`Testuję zamówienie: ${order.id}, numer: ${order.orderNumber}`);
    
    // Sprawdź czy istnieją zlecenia produkcyjne
    const { data: existingOrders, error: existingError } = await supabase
        .from('ProductionOrder')
        .select('id, sourceorderid')
        .eq('sourceorderid', order.id);
    
    if (existingError) {
        console.error('Błąd sprawdzania istniejących zleceń:', existingError);
    } else {
        console.log(`Istniejące zlecenia produkcyjne: ${existingOrders.length}`);
        existingOrders.forEach(o => console.log(`- ID: ${o.id}`));
    }
    
    // Sprawdź czy istnieją zlecenia robocze
    const { data: existingWorkOrders, error: workError } = await supabase
        .from('ProductionWorkOrder')
        .select('id, sourceOrderId, workOrderNumber')
        .eq('sourceOrderId', order.id);
    
    if (workError) {
        console.error('Błąd sprawdzania zleceń roboczych:', workError);
    } else {
        console.log(`Istniejące zlecenia robocze: ${existingWorkOrders.length}`);
        existingWorkOrders.forEach(w => console.log(`- ID: ${w.id}, numer: ${w.workOrderNumber}`));
    }
    
    // Sprawdź pozycje zamówienia z produktami
    const { data: orderItems, error: itemsError } = await supabase
        .from('OrderItem')
        .select(`
            id, productId, quantity, productionNotes,
            product:Product(id, name, code, productionPath)
        `)
        .eq('orderid', order.id);
    
    if (itemsError) {
        console.error('Błąd pobierania pozycji zamówienia:', itemsError);
    } else {
        console.log(`Pozycje zamówienia: ${orderItems.length}`);
        orderItems.forEach((item, index) => {
            console.log(`${index + 1}. ID: ${item.id}`);
            console.log(`   Produkt ID: ${item.productId}`);
            console.log(`   Produkt: ${item.product?.code || 'BRAK'}`);
            console.log(`   Ścieżka: ${item.product?.productionPath || 'BRAK'}`);
            console.log(`   Ilość: ${item.quantity}`);
            console.log('');
        });
    }
}

testProductionOrderCreation()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Błąd:', err);
        process.exit(1);
    });
